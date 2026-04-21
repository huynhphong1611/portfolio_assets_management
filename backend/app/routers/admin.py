"""
Admin router — Separate admin login, system price management, user listing, settings.
All endpoints require admin JWT (separate from user JWT).
"""
import time
import logging
import jwt as pyjwt
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from app.config import settings
from app.services import firestore_service as fs
from app.services import price_service

logger = logging.getLogger("admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── Admin JWT ───────────────────────────────────────────────────────────────

def create_admin_jwt() -> str:
    """Create a short-lived admin JWT."""
    payload = {
        "sub": settings.ADMIN_USERNAME,
        "role": "admin",
        "iat": int(time.time()),
        "exp": int(time.time()) + (settings.ADMIN_JWT_EXPIRE_HOURS * 3600),
    }
    return pyjwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm="HS256")


def verify_admin_jwt(token: str) -> dict:
    """Verify admin JWT and return payload."""
    payload = pyjwt.decode(token, settings.ADMIN_JWT_SECRET, algorithms=["HS256"])
    if payload.get("role") != "admin":
        raise pyjwt.InvalidTokenError("Not an admin token")
    return payload


async def get_admin_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency: verify admin JWT from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required")
    token = authorization.replace("Bearer ", "").strip()
    try:
        return verify_admin_jwt(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str


class SystemPricesUpdate(BaseModel):
    prices: dict  # {ticker: price_vnd_value}
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today


class TickerConfigUpdate(BaseModel):
    stocks: list[str] = []
    crypto: list[str] = []
    funds: list[str] = []


class GlobalSettingsUpdate(BaseModel):
    usdt_vnd_default: Optional[float] = None
    auto_fetch_enabled: Optional[bool] = None
    extra: Optional[dict] = None


# ─── Admin Auth ───────────────────────────────────────────────────────────────

@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    """Authenticate admin with username/password from .env."""
    if not settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Admin not configured")

    if req.username != settings.ADMIN_USERNAME or req.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Sai tài khoản hoặc mật khẩu admin")

    token = create_admin_jwt()
    logger.info(f"Admin login: {req.username}")
    return {
        "success": True,
        "data": {
            "token": token,
            "username": settings.ADMIN_USERNAME,
            "role": "admin",
            "expire_hours": settings.ADMIN_JWT_EXPIRE_HOURS,
        }
    }


@router.get("/me")
async def admin_me(admin: dict = Depends(get_admin_user)):
    """Get current admin info."""
    return {"success": True, "data": {"username": admin["sub"], "role": "admin"}}


# ─── System Prices ────────────────────────────────────────────────────────────

@router.get("/system-prices")
async def get_system_prices(
    date: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Get system daily prices for a specific date (or latest)."""
    if date:
        data = fs.get_system_daily_prices(date)
    else:
        data = fs.get_latest_system_daily_prices()
    return {"success": True, "data": data}


@router.get("/system-prices/history")
async def get_system_prices_history(
    limit: int = 30,
    admin: dict = Depends(get_admin_user)
):
    """Get history of system daily prices."""
    data = fs.get_system_daily_prices_history(limit)
    return {"success": True, "data": data}


@router.post("/system-prices")
async def save_system_prices(
    req: SystemPricesUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Save system daily prices and sync to global marketPrices."""
    from datetime import datetime
    date = req.date or datetime.now().strftime("%Y-%m-%d")

    # Get the USDT rate from prices
    usdt_vnd = req.prices.get("USDT") or req.prices.get("USDC", 25500)

    # Determine which tickers are crypto for price_usd calculation
    ticker_config = fs.get_supported_tickers()
    crypto_tickers = set(ticker_config.get("crypto", []))

    # Build market prices update (VND-first)
    market_update = {}
    stablecoin_keys = {"USDT", "USDC"}

    for ticker, price_vnd in req.prices.items():
        if ticker in stablecoin_keys:
            market_update[ticker] = {
                "price": price_vnd,        # VNĐ rate
                "exchangeRate": price_vnd, # legacy compat
                "date": date,
                "source": "admin",
            }
        elif ticker in crypto_tickers:
            price_usd = round(price_vnd / usdt_vnd, 2) if usdt_vnd else 0
            market_update[ticker] = {
                "price": price_vnd,
                "price_usd": price_usd,
                "usdt_vnd_rate": usdt_vnd,
                "date": date,
                "source": "admin",
            }
        else:
            market_update[ticker] = {
                "price": price_vnd,
                "date": date,
                "source": "admin",
            }

    # Save system daily snapshot
    fs.save_system_daily_prices(date, req.prices, usdt_vnd)

    # Sync to global marketPrices
    fs.batch_update_market_prices(market_update)

    logger.info(f"Admin saved system prices for {date}: {len(req.prices)} tickers")
    return {"success": True, "data": {"saved": date, "count": len(req.prices)}}


@router.post("/system-prices/fetch-api")
async def fetch_prices_from_api(
    date: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Trigger real-time price fetch from vnstock + CoinGecko for all configured tickers."""
    from datetime import datetime
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    target_date = date or datetime.now().strftime("%Y-%m-%d")
    ticker_config = fs.get_supported_tickers()
    all_tickers = (
        ticker_config.get("stocks", []) +
        ticker_config.get("crypto", []) +
        ticker_config.get("funds", [])
    )

    if not all_tickers:
        raise HTTPException(status_code=400, detail="No tickers configured. Add tickers in Admin > Ticker Config first.")

    ticker_type_map = {}
    for t in ticker_config.get("stocks", []): ticker_type_map[t] = "stock"
    for t in ticker_config.get("crypto", []): ticker_type_map[t] = "crypto"
    for t in ticker_config.get("funds", []): ticker_type_map[t] = "fund"

    logger.info(f"Admin triggered API fetch for {len(all_tickers)} tickers on {target_date}")
    results = price_service.fetch_all_portfolio_prices(all_tickers, target_date=target_date, ticker_type_map=ticker_type_map)

    # Build VND prices dict from results
    prices_vnd = {}
    usdt_vnd = 0

    # Get USDT rate first
    usdt_result = results.get("USDT")
    if usdt_result and usdt_result.get("price", 0) > 0:
        usdt_vnd = usdt_result["price"]

    # Also check if USDT result has exchangeRate
    if not usdt_vnd:
        usdt_vnd = usdt_result.get("exchangeRate", 25500) if usdt_result else 25500

    for ticker, result in results.items():
        raw_price = result.get("price", 0)
        if not raw_price or raw_price <= 0:
            continue

        ticker_type = result.get("type", "stock")
        if ticker_type == "crypto" and ticker not in {"USDT", "USDC"}:
            # price from CoinGecko is USD — convert to VND
            prices_vnd[ticker] = round(raw_price * usdt_vnd)
        else:
            prices_vnd[ticker] = raw_price

    return {
        "success": True,
        "data": {
            "prices": prices_vnd,
            "date": target_date,
            "fetched": len(prices_vnd),
            "total_tickers": len(all_tickers),
            "usdt_vnd_rate": usdt_vnd,
        }
    }


# ─── Ticker Config ────────────────────────────────────────────────────────────

@router.get("/tickers")
async def get_tickers(admin: dict = Depends(get_admin_user)):
    """Get admin-managed supported ticker list."""
    data = fs.get_supported_tickers()
    return {"success": True, "data": data}


@router.put("/tickers")
async def save_tickers(
    req: TickerConfigUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Save the supported ticker configuration."""
    data = {
        "stocks": [t.upper().strip() for t in req.stocks if t.strip()],
        "crypto": [t.upper().strip() for t in req.crypto if t.strip()],
        "funds": [t.upper().strip() for t in req.funds if t.strip()],
    }
    fs.save_supported_tickers(data)
    logger.info(f"Admin updated tickers: {data}")
    return {"success": True, "data": data}


@router.get("/tickers/stats")
async def get_tickers_stats(admin: dict = Depends(get_admin_user)):
    """Scan all users and return tickers they are trading vs system supported."""
    result = fs.get_user_tickers_stats()
    return {"success": True, "data": result}


# ─── User Management ──────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(admin: dict = Depends(get_admin_user)):
    """List all users (guest + firebase)."""
    users = fs.get_all_users()
    return {"success": True, "data": users}


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Get user detail (transaction count, snapshot count, etc.)."""
    detail = fs.get_user_detail(user_id)
    if not detail:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "data": detail}


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    payload: dict,
    admin: dict = Depends(get_admin_user)
):
    """Enable or disable a user account (isActive flag)."""
    is_active = payload.get("isActive", True)
    fs.set_user_active(user_id, is_active)
    logger.info(f"Admin set user {user_id} isActive={is_active}")
    return {"success": True, "data": {"user_id": user_id, "isActive": is_active}}


# ─── Global Settings ──────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(admin: dict = Depends(get_admin_user)):
    """Get global application settings."""
    data = fs.get_global_settings()
    return {"success": True, "data": data}


@router.put("/settings")
async def save_settings(
    req: GlobalSettingsUpdate,
    admin: dict = Depends(get_admin_user)
):
    """Save global application settings."""
    data = {}
    if req.usdt_vnd_default is not None:
        data["usdt_vnd_default"] = req.usdt_vnd_default
    if req.auto_fetch_enabled is not None:
        data["auto_fetch_enabled"] = req.auto_fetch_enabled
    if req.extra:
        data.update(req.extra)

    fs.save_global_settings(data)
    logger.info(f"Admin updated global settings: {data}")
    return {"success": True, "data": data}


# ─── Migration ────────────────────────────────────────────────────────────────

@router.post("/migrate/daily-prices")
async def migrate_daily_prices(admin: dict = Depends(get_admin_user)):
    """
    One-time migration: merge all user-scoped daily prices into system/prices/daily.
    Takes the latest price for each date across all users.
    """
    result = fs.migrate_user_daily_prices_to_system()
    return {"success": True, "data": result}
