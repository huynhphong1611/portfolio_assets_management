"""
Data import / export router — the user owns their data.

  POST /api/data/import/transactions   CSV → preview (dryRun) → import
  POST /api/data/import/prices         CSV of historical prices → user price history
  GET  /api/data/export                full backup of the user's workspace (one JSON file)
  POST /api/data/import/workspace      restore a backup (merge by id, idempotent)
"""
import re
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError

from app.models.schemas import (
    APIResponse, ExternalAssetCreate, LiabilityCreate, SnapshotCreate, TransactionCreate,
)
from app.routers.auth import get_current_user
from app.routers.securities import SecurityUpsert
from app.services import csv_import_service as csvi
from app.services import firestore_service as fs

router = APIRouter(prefix="/api/data", tags=["data"])

MAX_CONTENT = 5_000_000
EXPORT_VERSION = 1
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class TransactionsImport(BaseModel):
    content: str = Field(..., max_length=MAX_CONTENT)
    numberFormat: Literal["auto", "vi", "en"] = "auto"
    dryRun: bool = True


class PricesImport(BaseModel):
    content: str = Field(..., max_length=MAX_CONTENT)
    ticker: Optional[str] = Field(default=None, max_length=20)
    numberFormat: Literal["auto", "vi", "en"] = "auto"
    replace: bool = False
    dryRun: bool = True


class WorkspaceImport(BaseModel):
    data: dict
    dryRun: bool = True


@router.post("/import/transactions", response_model=APIResponse)
async def import_transactions(req: TransactionsImport, user: dict = Depends(get_current_user)):
    existing = fs.get_transactions(user["sub"], user["type"])
    result = csvi.parse_transactions_csv(req.content, req.numberFormat, existing)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    valid = result.pop("valid")
    imported = 0
    if not req.dryRun and valid:
        imported = fs.add_transactions_bulk(
            user["sub"], user["type"], [{k: v for k, v in tx.items() if k != "line"} for tx in valid])
    return APIResponse(data={
        **result,
        "validCount": len(valid),
        "preview": valid[:csvi.PREVIEW_ROWS],
        "imported": imported,
        "dryRun": req.dryRun,
    })


@router.post("/import/prices", response_model=APIResponse)
async def import_prices(req: PricesImport, user: dict = Depends(get_current_user)):
    result = csvi.parse_prices_csv(req.content, req.ticker, req.numberFormat)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    prices = result.pop("prices")
    imported = 0
    if not req.dryRun:
        for ticker, series in prices.items():
            if req.replace:
                imported += fs.replace_security_prices(user["sub"], user["type"], ticker, series)
            else:
                imported += fs.merge_security_prices(user["sub"], user["type"], ticker, series)
    return APIResponse(data={**result, "imported": imported, "dryRun": req.dryRun})


@router.get("/export", response_model=APIResponse)
async def export_workspace(user: dict = Depends(get_current_user)):
    workspace = fs.export_user_workspace(user["sub"], user["type"])
    return APIResponse(data={
        "format": "portfolio-manager-backup",
        "version": EXPORT_VERSION,
        "exportedAt": datetime.now().isoformat(timespec="seconds"),
        "username": user.get("username", ""),
        **workspace,
    })


def _validated_restore(data: dict) -> tuple[dict, list]:
    """Validate a backup file. Returns (clean collections, errors)."""
    if data.get("format") != "portfolio-manager-backup":
        raise HTTPException(status_code=400, detail="File không phải bản sao lưu của Portfolio Manager")
    errors, clean = [], {}

    def validate(items, model, label, keep=("id",)):
        out = []
        for i, item in enumerate(items or []):
            if not isinstance(item, dict):
                errors.append(f"{label} #{i + 1}: không hợp lệ")
                continue
            try:
                doc = model(**item).model_dump()
            except ValidationError as e:
                errors.append(f"{label} #{i + 1}: {e.errors()[0].get('msg')}")
                continue
            for k in keep:
                if item.get(k):
                    doc[k] = str(item[k])
            out.append(doc)
        return out

    clean["transactions"] = validate(data.get("transactions"), TransactionCreate, "Giao dịch")
    clean["externalAssets"] = validate(data.get("externalAssets"), ExternalAssetCreate, "Tài sản ngoài")
    clean["liabilities"] = validate(data.get("liabilities"), LiabilityCreate, "Khoản nợ")
    clean["snapshots"] = [
        s for s in validate(data.get("snapshots"), SnapshotCreate, "Snapshot", keep=())
        if ISO_DATE_RE.match(s.get("date", ""))
    ]

    securities = []
    for i, item in enumerate(data.get("securities") or []):
        ticker = str((item or {}).get("ticker") or (item or {}).get("id") or "").strip().upper()
        if not csvi.TICKER_RE.match(ticker):
            errors.append(f"Chứng khoán #{i + 1}: mã không hợp lệ")
            continue
        try:
            doc = SecurityUpsert(**{k: v for k, v in item.items() if k in SecurityUpsert.model_fields}).model_dump()
        except ValidationError as e:
            errors.append(f"Chứng khoán {ticker}: {e.errors()[0].get('msg')}")
            continue
        securities.append({**doc, "ticker": ticker})
    clean["securities"] = securities

    prices = {}
    for ticker, series in (data.get("securityPrices") or {}).items():
        t = str(ticker).strip().upper()
        if not csvi.TICKER_RE.match(t) or not isinstance(series, dict):
            errors.append(f"Giá {ticker}: không hợp lệ")
            continue
        good = {d: float(v) for d, v in series.items()
                if ISO_DATE_RE.match(str(d)) and isinstance(v, (int, float)) and v > 0}
        if good:
            prices[t] = good
    clean["securityPrices"] = prices

    targets = (data.get("settings") or {}).get("rebalanceTargets") or {}
    clean["rebalanceTargets"] = {k: float(v) for k, v in targets.items() if isinstance(v, (int, float))}
    return clean, errors


@router.post("/import/workspace", response_model=APIResponse)
async def import_workspace(req: WorkspaceImport, user: dict = Depends(get_current_user)):
    clean, errors = _validated_restore(req.data)
    counts = {
        "transactions": len(clean["transactions"]),
        "securities": len(clean["securities"]),
        "securityPrices": sum(len(p) for p in clean["securityPrices"].values()),
        "externalAssets": len(clean["externalAssets"]),
        "liabilities": len(clean["liabilities"]),
        "snapshots": len(clean["snapshots"]),
    }
    if not req.dryRun:
        uid, utype = user["sub"], user["type"]
        fs.upsert_documents(uid, utype, "transactions", clean["transactions"])
        fs.upsert_documents(uid, utype, "securities", clean["securities"], id_key="ticker")
        for ticker, series in clean["securityPrices"].items():
            fs.merge_security_prices(uid, utype, ticker, series)
        fs.upsert_documents(uid, utype, "externalAssets", clean["externalAssets"])
        fs.upsert_documents(uid, utype, "liabilities", clean["liabilities"])
        fs.upsert_documents(uid, utype, "dailySnapshots", clean["snapshots"], id_key="date")
        if clean["rebalanceTargets"]:
            fs.save_rebalance_targets(uid, utype, clean["rebalanceTargets"])
    return APIResponse(data={"counts": counts, "errors": errors[:csvi.MAX_ERRORS], "dryRun": req.dryRun})
