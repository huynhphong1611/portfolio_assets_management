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


def update_transaction(user_id: str, user_type: str, tx_id: str, data: dict) -> None:
    doc = _user_doc(user_id, user_type, "transactions", tx_id)
    data["updatedAt"] = SERVER_TIMESTAMP
    doc.update(data)


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


# ── Fund Cash History ──

def get_fund_cash_history(user_id: str, user_type: str, fund_id: str) -> list[dict]:
    """Get deposit/withdrawal history for a specific fund."""
    col = _user_col(user_id, user_type, "fundCashHistory")
    # Use only where() without order_by to avoid needing a composite index.
    # Sort in Python instead.
    docs = col.where("fundId", "==", fund_id).stream()
    result = []
    for d in docs:
        entry = {"id": d.id, **d.to_dict()}
        # Convert Firestore timestamps to ISO strings for JSON serialization
        if entry.get("createdAt") and hasattr(entry["createdAt"], "isoformat"):
            entry["createdAt"] = entry["createdAt"].isoformat()
        result.append(entry)
    # Sort by createdAt descending (newest first)
    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


def add_fund_cash_history(user_id: str, user_type: str, data: dict) -> str:
    """Add a deposit/withdrawal record to fund cash history."""
    col = _user_col(user_id, user_type, "fundCashHistory")
    data["createdAt"] = SERVER_TIMESTAMP
    _, doc_ref = col.add(data)
    return doc_ref.id


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


# ── System Daily Prices (Admin-controlled, replaces user-scoped) ──

def get_system_daily_prices(date_str: str) -> Optional[dict]:
    """Get system daily prices for a specific date."""
    db = get_db()
    doc = db.collection("system").document("prices").collection("daily").document(date_str)
    snap = doc.get()
    if snap.exists:
        data = snap.to_dict()
        # Serialize timestamps
        if data.get("updatedAt") and hasattr(data["updatedAt"], "isoformat"):
            data["updatedAt"] = data["updatedAt"].isoformat()
        return data
    return None


def get_latest_system_daily_prices() -> Optional[dict]:
    """Get the most recent system daily prices entry."""
    db = get_db()
    col = db.collection("system").document("prices").collection("daily")
    docs = list(col.order_by("date", direction=Query.DESCENDING).limit(1).stream())
    if not docs:
        return None
    data = docs[0].to_dict()
    if data.get("updatedAt") and hasattr(data["updatedAt"], "isoformat"):
        data["updatedAt"] = data["updatedAt"].isoformat()
    return data


def get_system_daily_prices_history(limit_count: int = 30) -> list[dict]:
    """Get recent system daily price entries (admin price board history)."""
    db = get_db()
    col = db.collection("system").document("prices").collection("daily")
    docs = col.order_by("date", direction=Query.DESCENDING).limit(limit_count).stream()
    results = []
    for d in docs:
        entry = {"id": d.id, **d.to_dict()}
        if entry.get("updatedAt") and hasattr(entry["updatedAt"], "isoformat"):
            entry["updatedAt"] = entry["updatedAt"].isoformat()
        results.append(entry)
    return results


def save_system_daily_prices(date_str: str, prices: dict, usdt_vnd_rate: float = 0) -> None:
    """Save system-wide daily prices (admin writes only)."""
    db = get_db()
    doc = db.collection("system").document("prices").collection("daily").document(date_str)
    doc.set({
        "date": date_str,
        "prices": prices,
        "usdt_vnd_rate": usdt_vnd_rate,
        "updatedAt": SERVER_TIMESTAMP,
    })


# ── Supported Tickers Config (Admin-managed) ──

_DEFAULT_TICKERS = {
    "stocks": [],
    "crypto": ["BTC", "ETH", "USDT", "USDC"],
    "funds": [],
}


def get_supported_tickers() -> dict:
    """Get admin-managed list of supported tickers."""
    db = get_db()
    doc = db.collection("system").document("config").collection("tickers").document("supported")
    snap = doc.get()
    if snap.exists:
        data = snap.to_dict()
        return {
            "stocks": data.get("stocks", []),
            "crypto": data.get("crypto", []),
            "funds": data.get("funds", []),
        }
    return _DEFAULT_TICKERS.copy()


def save_supported_tickers(data: dict) -> None:
    """Save the admin-managed ticker configuration."""
    db = get_db()
    doc = db.collection("system").document("config").collection("tickers").document("supported")
    doc.set({**data, "updatedAt": SERVER_TIMESTAMP})


# ── Global Settings (Admin-managed) ──

_DEFAULT_SETTINGS = {
    "usdt_vnd_default": 26500.0,
    "auto_fetch_enabled": True,
}


def get_global_settings() -> dict:
    """Get global application settings."""
    db = get_db()
    doc = db.collection("system").document("config").collection("settings").document("global")
    snap = doc.get()
    if snap.exists:
        data = snap.to_dict()
        data.pop("updatedAt", None)
        return data
    return _DEFAULT_SETTINGS.copy()


def save_global_settings(data: dict) -> None:
    """Save global application settings (merge)."""
    db = get_db()
    doc = db.collection("system").document("config").collection("settings").document("global")
    doc.set({**data, "updatedAt": SERVER_TIMESTAMP}, merge=True)


# ── User Management (Admin) ──

def get_all_users() -> list[dict]:
    """Aggregate all users — guest (from 'users') + firebase (from Firebase Auth)."""
    db = get_db()
    users = []
    seen = set()

    # Guest users
    try:
        for doc in db.collection("users").stream():
            d = doc.to_dict()
            entry = {
                "id": doc.id,
                "username": d.get("username", doc.id),
                "type": "guest",
                "isActive": d.get("isActive", True),
                "createdAt": d["createdAt"].isoformat() if d.get("createdAt") and hasattr(d["createdAt"], "isoformat") else None,
            }
            users.append(entry)
            seen.add(doc.id)
    except Exception as e:
        logger.warning(f"Error loading guest users: {e}")

    # Firebase users via Admin SDK
    try:
        from app.firebase_init import get_firebase_auth
        firebase_auth = get_firebase_auth()
        page = firebase_auth.list_users()
        while page:
            for fb_user in page.users:
                if fb_user.uid not in seen:
                    users.append({
                        "id": fb_user.uid,
                        "username": fb_user.email or fb_user.uid,
                        "type": "firebase",
                        "isActive": not fb_user.disabled,
                        "createdAt": None,
                    })
                    seen.add(fb_user.uid)
            page = page.get_next_page()
    except Exception as e:
        logger.warning(f"Error loading Firebase users: {e}")

    return users


def get_user_detail(user_id: str) -> Optional[dict]:
    """Get summary detail for a user (transaction count, snapshot count)."""
    db = get_db()
    detail = {"user_id": user_id}

    # Try guest user data
    for utype, root in [("guest", "guest_users"), ("firebase", "system_users")]:
        try:
            tx_count = len(list(db.collection(root).document(user_id).collection("transactions").limit(9999).stream()))
            snap_count = len(list(db.collection(root).document(user_id).collection("dailySnapshots").limit(9999).stream()))
            if tx_count > 0 or snap_count > 0:
                detail["type"] = utype
                detail["transaction_count"] = tx_count
                detail["snapshot_count"] = snap_count
                break
        except Exception:
            continue

    return detail if "type" in detail else detail


def set_user_active(user_id: str, is_active: bool) -> None:
    """Set a guest user's isActive flag. For Firebase users, also disable via Admin SDK."""
    db = get_db()
    # Try guest user doc
    try:
        db.collection("users").document(user_id).set(
            {"isActive": is_active, "updatedAt": SERVER_TIMESTAMP}, merge=True
        )
    except Exception:
        pass
    # Try Firebase user
    try:
        from app.firebase_init import get_firebase_auth
        get_firebase_auth().update_user(user_id, disabled=not is_active)
    except Exception:
        pass


def get_user_tickers_stats() -> dict:
    """Scan all users' transactions, extract unique tickers, and compare with supported ones."""
    db = get_db()
    
    # Get supported tickers
    supported_config = get_supported_tickers()
    supported_set = set()
    for cat in ["stocks", "crypto", "funds"]:
        supported_set.update(supported_config.get(cat, []))
        
    traded_set = set()
    ticker_details = {}

    try:
        txs = db.collection_group("transactions").stream()
        for tx in txs:
            data = tx.to_dict()
            ticker = data.get("ticker")
            if ticker and isinstance(ticker, str):
                ticker = ticker.upper()
                traded_set.add(ticker)
                asset_class = data.get("assetClass", "Unknown")
                
                # Get the user ID from the path (e.g., guest_users/USER_ID/transactions/TX_ID)
                uid = tx.reference.parent.parent.id

                if ticker not in ticker_details:
                    ticker_details[ticker] = {"assetClass": asset_class, "user_count": set()}
                ticker_details[ticker]["user_count"].add(uid)
    except Exception as e:
        logger.warning(f"Error fetching user tickers via collection_group: {e}")

    # Build response lists
    traded_list = []
    for t in traded_set:
        details = ticker_details.get(t, {})
        traded_list.append({
            "ticker": t,
            "assetClass": details.get("assetClass", "Unknown"),
            "user_count": len(details.get("user_count", set())),
            "in_system": t in supported_set
        })
        
    return {
        "configured_count": len(supported_set),
        "traded_total": len(traded_list),
        "traded_list": sorted(traded_list, key=lambda x: x["user_count"], reverse=True)
    }


# ── Migration: user-scoped daily prices → system ──

def migrate_user_daily_prices_to_system() -> dict:
    """
    One-time migration: collect all user-scoped daily prices and merge into
    system/prices/daily/{date}. For each date, latest-write wins per ticker.
    Returns a summary dict.
    """
    db = get_db()
    merged: dict[str, dict] = {}  # date → prices dict

    roots = [("guest", "guest_users"), ("firebase", "system_users")]
    total_users = 0
    total_entries = 0

    for utype, root in roots:
        try:
            user_docs = db.collection(root).stream()
            for user_doc in user_docs:
                uid = user_doc.id
                total_users += 1
                col = db.collection(root).document(uid).collection("dailyPrices")
                for price_doc in col.stream():
                    data = price_doc.to_dict()
                    date_str = data.get("date") or price_doc.id
                    prices = data.get("prices", {})
                    if not isinstance(prices, dict) or not prices:
                        continue
                    if date_str not in merged:
                        merged[date_str] = {}
                    # Merge — last processed wins per ticker
                    merged[date_str].update({k: v for k, v in prices.items() if v and v > 0})
                    total_entries += 1
        except Exception as e:
            logger.warning(f"Migration error for {root}: {e}")

    # Write all to system collection in batches
    col_ref = db.collection("system").document("prices").collection("daily")
    batch = db.batch()
    batch_count = 0
    written = 0

    for date_str, prices in sorted(merged.items()):
        usdt_vnd = prices.get("USDT") or prices.get("USDC", 0)
        ref = col_ref.document(date_str)
        batch.set(ref, {
            "date": date_str,
            "prices": prices,
            "usdt_vnd_rate": usdt_vnd,
            "updatedAt": SERVER_TIMESTAMP,
            "source": "migrated",
        })
        batch_count += 1
        written += 1
        if batch_count >= 400:  # Firestore batch limit = 500
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    logger.info(f"Migration complete: {written} dates merged from {total_users} users ({total_entries} source entries)")
    return {
        "dates_written": written,
        "users_scanned": total_users,
        "source_entries": total_entries,
    }
