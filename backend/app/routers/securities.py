"""
Securities router — each user's own security master data and price history
(Portfolio Performance: General Data → All Securities, quote feed, historical prices).
"""
import re
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.models.schemas import APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs
from app.services import portfolio_service as ps
from app.services import quote_update_service
from app.services.quote_feed_service import FeedError, preview_json_feed, validate_feed_url

router = APIRouter(prefix="/api/securities", tags=["securities"])

TICKER_RE = re.compile(r"^[A-Za-z0-9À-ỹ\-_]{1,20}$")
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_PRICES_PER_REQUEST = 20000

AssetClass = Literal["Tiền mặt VNĐ", "Tiền mặt USD", "Trái phiếu", "Cổ phiếu", "Tài sản mã hóa", "Vàng"]


class FeedProperties(BaseModel):
    closePath: Optional[str] = Field(default=None, max_length=500)
    datePath: Optional[str] = Field(default=None, max_length=500)
    factor: Optional[float] = Field(default=1.0, gt=0)
    numberFormat: Literal["auto", "vi", "en"] = "auto"


class SecurityUpsert(BaseModel):
    name: Optional[str] = Field(default="", max_length=200)
    assetClass: Optional[AssetClass] = None
    currency: Optional[str] = Field(default="VNĐ", max_length=10)
    feed: Literal["AUTO", "MANUAL", "GENERIC-JSON"] = "AUTO"
    feedURL: Optional[str] = Field(default="", max_length=2000)
    feedProperties: Optional[FeedProperties] = None
    note: Optional[str] = Field(default="", max_length=2000)
    isRetired: bool = False


class PricePoint(BaseModel):
    date: str
    close: float = Field(..., gt=0)


class PricesUpsert(BaseModel):
    prices: list[PricePoint] = Field(default_factory=list)
    replace: bool = False


class FeedTest(BaseModel):
    feedURL: str = Field(..., max_length=2000)
    feedProperties: FeedProperties = Field(default_factory=FeedProperties)


def _ticker(raw: str) -> str:
    ticker = (raw or "").strip().upper()
    if not TICKER_RE.match(ticker) or ticker == "VNĐ":
        raise HTTPException(status_code=400, detail="Mã chứng khoán không hợp lệ")
    return ticker


def _valid_iso(d: str) -> bool:
    if not ISO_DATE_RE.match(d or ""):
        return False
    try:
        datetime.strptime(d, "%Y-%m-%d")
        return True
    except ValueError:
        return False


@router.get("", response_model=APIResponse)
async def list_securities(user: dict = Depends(get_current_user)):
    return APIResponse(data=fs.get_securities(user["sub"], user["type"]))


@router.get("/prices", response_model=APIResponse)
async def list_all_prices(user: dict = Depends(get_current_user)):
    """All user-owned price histories: {ticker: {"YYYY-MM-DD": close}}."""
    return APIResponse(data=fs.get_security_prices(user["sub"], user["type"]))


@router.post("/feed/test", response_model=APIResponse)
async def test_feed(req: FeedTest, user: dict = Depends(get_current_user)):
    """Download a JSON feed once and show what would be imported (nothing is saved)."""
    security = {"feedURL": req.feedURL, "feedProperties": req.feedProperties.model_dump()}
    try:
        preview = preview_json_feed(security)
    except FeedError as e:
        return APIResponse(success=False, error=str(e))
    quotes = preview["quotes"]
    dates = sorted(quotes)
    return APIResponse(data={
        "count": len(quotes),
        "latest": {"date": dates[-1], "price": quotes[dates[-1]]} if dates else None,
        "sample": [{"date": d, "price": quotes[d]} for d in dates[-10:]],
        "excerpt": preview["excerpt"],
    })


@router.post("/update-quotes", response_model=APIResponse)
async def update_quotes(user: dict = Depends(get_current_user)):
    """Download today's prices for the user's AUTO securities and all their JSON feeds."""
    result = quote_update_service.update_quotes_for_user(user["sub"], user["type"])
    return APIResponse(data=result)


@router.put("/{ticker}", response_model=APIResponse)
async def upsert_security(ticker: str, req: SecurityUpsert, user: dict = Depends(get_current_user)):
    ticker = _ticker(ticker)
    data = req.model_dump()
    if req.feed == ps.FEED_JSON:
        props = req.feedProperties or FeedProperties()
        if not (props.closePath or "").strip():
            raise HTTPException(status_code=400, detail="Nguồn JSON cần JSONPath của giá")
        try:
            data["feedURL"] = validate_feed_url(req.feedURL or "")
        except FeedError as e:
            raise HTTPException(status_code=400, detail=str(e))
    fs.save_security(user["sub"], user["type"], ticker, data)
    return APIResponse(data={"ticker": ticker})


@router.delete("/{ticker}", response_model=APIResponse)
async def remove_security(ticker: str, user: dict = Depends(get_current_user)):
    ticker = _ticker(ticker)
    fs.delete_security(user["sub"], user["type"], ticker)
    return APIResponse(data={"deleted": ticker})


@router.get("/{ticker}/prices", response_model=APIResponse)
async def get_prices(ticker: str, user: dict = Depends(get_current_user)):
    ticker = _ticker(ticker)
    return APIResponse(data=fs.get_security_prices(user["sub"], user["type"], ticker).get(ticker, {}))


@router.put("/{ticker}/prices", response_model=APIResponse)
async def save_prices(ticker: str, req: PricesUpsert, user: dict = Depends(get_current_user)):
    """Add prices by hand (or replace the whole history)."""
    ticker = _ticker(ticker)
    if len(req.prices) > MAX_PRICES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Tối đa {MAX_PRICES_PER_REQUEST} giá mỗi lần")
    prices = {}
    for p in req.prices:
        if not _valid_iso(p.date):
            raise HTTPException(status_code=400, detail=f"Ngày không hợp lệ: {p.date}")
        prices[p.date] = p.close
    if req.replace:
        count = fs.replace_security_prices(user["sub"], user["type"], ticker, prices)
    else:
        count = fs.merge_security_prices(user["sub"], user["type"], ticker, prices)
    return APIResponse(data={"ticker": ticker, "saved": count})


@router.delete("/{ticker}/prices/{date}", response_model=APIResponse)
async def delete_price(ticker: str, date: str, user: dict = Depends(get_current_user)):
    ticker = _ticker(ticker)
    if not _valid_iso(date):
        raise HTTPException(status_code=400, detail="Ngày không hợp lệ")
    removed = fs.delete_security_price(user["sub"], user["type"], ticker, date)
    return APIResponse(data={"deleted": removed})
