"""
Firestore CRUD service — port of frontend firestoreService.js to Python.
All user-scoped operations use {root}/{userId}/{collection} pattern.
"""
import logging
from typing import Optional
from google.cloud.firestore import SERVER_TIMESTAMP, Query
from app.firebase_init import get_db
from app.services.auth_service import get_user_collection_root

logger = logging.getLogger("firestore_service")


def _user_col(user_id: str, user_type: str, collection_name: str):
    """Get a user-scoped sub-collection reference."""
    db = get_db()
    root = get_user_collection_root(user_type)
    return db.collection(root).document(user_id).collection(collection_name)


def _user_doc(user_id: str, user_type: str, collection_name: str, doc_id: str):
    """Get a user-scoped document reference."""
    db = get_db()
    root = get_user_collection_root(user_type)
    return db.collection(root).document(user_id).collection(collection_name).document(doc_id)


# ── Transactions ──

def get_transactions(user_id: str, user_type: str) -> list[dict]:
    col = _user_col(user_id, user_type, "transactions")
    docs = col.order_by("date", direction=Query.DESCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def add_transaction(user_id: str, user_type: str, data: dict) -> str:
    col = _user_col(user_id, user_type, "transactions")
    data["createdAt"] = SERVER_TIMESTAMP
    _, doc_ref = col.add(data)
    return doc_ref.id


def delete_transaction(user_id: str, user_type: str, tx_id: str) -> None:
    doc = _user_doc(user_id, user_type, "transactions", tx_id)
    doc.delete()


# ── External Assets ──

def get_external_assets(user_id: str, user_type: str) -> list[dict]:
    col = _user_col(user_id, user_type, "externalAssets")
    docs = col.order_by("name", direction=Query.ASCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def add_external_asset(user_id: str, user_type: str, data: dict) -> str:
    col = _user_col(user_id, user_type, "externalAssets")
    data["createdAt"] = SERVER_TIMESTAMP
    _, doc_ref = col.add(data)
    return doc_ref.id


def update_external_asset(user_id: str, user_type: str, asset_id: str, data: dict) -> None:
    doc = _user_doc(user_id, user_type, "externalAssets", asset_id)
    data["updatedAt"] = SERVER_TIMESTAMP
    doc.update(data)


def delete_external_asset(user_id: str, user_type: str, asset_id: str) -> None:
    doc = _user_doc(user_id, user_type, "externalAssets", asset_id)
    doc.delete()


# ── Liabilities ──

def get_liabilities(user_id: str, user_type: str) -> list[dict]:
    col = _user_col(user_id, user_type, "liabilities")
    docs = col.order_by("name", direction=Query.ASCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def add_liability(user_id: str, user_type: str, data: dict) -> str:
    col = _user_col(user_id, user_type, "liabilities")
    data["createdAt"] = SERVER_TIMESTAMP
    _, doc_ref = col.add(data)
    return doc_ref.id


def update_liability(user_id: str, user_type: str, liability_id: str, data: dict) -> None:
    doc = _user_doc(user_id, user_type, "liabilities", liability_id)
    data["updatedAt"] = SERVER_TIMESTAMP
    doc.update(data)


def delete_liability(user_id: str, user_type: str, liability_id: str) -> None:
    doc = _user_doc(user_id, user_type, "liabilities", liability_id)
    doc.delete()


# ── Funds ──

def get_funds(user_id: str, user_type: str) -> list[dict]:
    col = _user_col(user_id, user_type, "funds")
    docs = col.order_by("name", direction=Query.ASCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def add_fund(user_id: str, user_type: str, data: dict) -> str:
    col = _user_col(user_id, user_type, "funds")
    data["createdAt"] = SERVER_TIMESTAMP
    _, doc_ref = col.add(data)
    return doc_ref.id


def update_fund(user_id: str, user_type: str, fund_id: str, data: dict) -> None:
    doc = _user_doc(user_id, user_type, "funds", fund_id)
    data["updatedAt"] = SERVER_TIMESTAMP
    doc.update(data)


def delete_fund(user_id: str, user_type: str, fund_id: str) -> None:
    doc = _user_doc(user_id, user_type, "funds", fund_id)
    doc.delete()


def initialize_default_funds(user_id: str, user_type: str) -> bool:
    """Create default fund categories if the user has none."""
    col = _user_col(user_id, user_type, "funds")
    existing = list(col.limit(1).stream())
    if existing:
        return False

    defaults = [
        {"name": "Quỹ Trái phiếu", "assetClass": "Trái phiếu", "cashBalance": 0,
         "description": "Đầu tư trái phiếu và chứng chỉ quỹ TP", "color": "#3b82f6"},
        {"name": "Quỹ Cổ phiếu", "assetClass": "Cổ phiếu", "cashBalance": 0,
         "description": "Đầu tư cổ phiếu và chứng chỉ quỹ CP", "color": "#10b981"},
        {"name": "Quỹ Crypto", "assetClass": "Tài sản mã hóa", "cashBalance": 0,
         "description": "Đầu tư tài sản mã hóa (BTC, ETH...)", "color": "#f59e0b"},
        {"name": "Quỹ Vàng", "assetClass": "Vàng", "cashBalance": 0,
         "description": "Đầu tư vàng vật chất và PAXG", "color": "#eab308"},
        {"name": "Quỹ Tiền mặt", "assetClass": "Tiền mặt", "cashBalance": 0,
         "description": "Tiền mặt VNĐ và USD dự trữ", "color": "#6366f1"},
    ]

    batch = get_db().batch()
    for fund_data in defaults:
        fund_data["createdAt"] = SERVER_TIMESTAMP
        ref = col.document()
        batch.set(ref, fund_data)
    batch.commit()
    return True


# ── Rebalance Targets (Settings) ──

DEFAULT_REBALANCE = {
    "Tiền mặt VNĐ": 0, "Tiền mặt USD": 0,
    "Vàng": 10, "Trái phiếu": 60, "Cổ phiếu": 20, "Tài sản mã hóa": 10,
}


def get_rebalance_targets(user_id: str, user_type: str) -> dict:
    doc = _user_doc(user_id, user_type, "settings", "rebalanceTargets")
    snap = doc.get()
    if snap.exists:
        raw = snap.to_dict()
        return {k: v for k, v in raw.items()
                if k not in ('updatedAt', 'createdAt') and isinstance(v, (int, float))}
    return DEFAULT_REBALANCE.copy()


def save_rebalance_targets(user_id: str, user_type: str, targets: dict) -> None:
    doc = _user_doc(user_id, user_type, "settings", "rebalanceTargets")
    doc.set({**targets, "updatedAt": SERVER_TIMESTAMP})


# ── Daily Snapshots ──

def get_snapshots(user_id: str, user_type: str) -> list[dict]:
    col = _user_col(user_id, user_type, "dailySnapshots")
    docs = col.order_by("date", direction=Query.ASCENDING).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def save_snapshot(user_id: str, user_type: str, date_str: str, data: dict) -> None:
    doc = _user_doc(user_id, user_type, "dailySnapshots", date_str)
    doc.set({**data, "date": date_str, "updatedAt": SERVER_TIMESTAMP})


# ── Daily Prices ──

def get_daily_prices(user_id: str, user_type: str, limit_count: int = 30) -> list[dict]:
    col = _user_col(user_id, user_type, "dailyPrices")
    docs = col.order_by("date", direction=Query.DESCENDING).limit(limit_count).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


def save_daily_prices(user_id: str, user_type: str, date_str: str, prices: list) -> None:
    doc = _user_doc(user_id, user_type, "dailyPrices", date_str)
    doc.set({"date": date_str, "prices": prices, "updatedAt": SERVER_TIMESTAMP})


def get_latest_daily_prices(user_id: str, user_type: str) -> Optional[dict]:
    col = _user_col(user_id, user_type, "dailyPrices")
    docs = list(col.order_by("date", direction=Query.DESCENDING).limit(1).stream())
    if not docs:
        return None
    data = docs[0].to_dict()
    return {"date": data.get("date"), "prices": data.get("prices")}


# ── Market Prices (Global) ──

def get_market_prices() -> dict:
    db = get_db()
    docs = db.collection("marketPrices").stream()
    return {d.id: d.to_dict() for d in docs}


def update_market_price(ticker: str, price_data: dict) -> None:
    db = get_db()
    doc = db.collection("marketPrices").document(ticker)
    doc.set({**price_data, "updatedAt": SERVER_TIMESTAMP}, merge=True)


def batch_update_market_prices(prices_map: dict) -> None:
    db = get_db()
    batch = db.batch()
    for ticker, data in prices_map.items():
        ref = db.collection("marketPrices").document(ticker)
        batch.set(ref, {**data, "updatedAt": SERVER_TIMESTAMP}, merge=True)
    batch.commit()
