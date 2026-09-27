"""
Prices router — vnstock + CoinGecko price fetching + market prices management.
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional

from app.models.schemas import APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs
from app.services import price_service
from app.config import settings

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/stock", response_model=APIResponse)
async def get_single_price(
    symbol: str = Query(..., description="Stock/Fund/Crypto ticker"),
    source: str = Query("VCI", description="Data source for stocks"),
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    """Fetch price for a single symbol (auto-detects stock vs fund vs crypto)."""
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    result = price_service.get_price(symbol, source, target_date)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return APIResponse(data=result)


@router.get("/stocks")
async def get_multiple_prices(
    symbols: str = Query(..., description="Comma-separated symbols"),
    source: str = Query("VCI", description="Data source for stocks"),
    target_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    """Fetch prices for multiple symbols (auto-detects type)."""
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results = []

    for sym in symbol_list:
        try:
            result = price_service.get_price(sym, source, target_date)
            if result:
                result["error"] = None
                results.append(result)
            else:
                results.append({"symbol": sym, "price": None,
                                "error": "No data found", "type": "unknown"})
        except (Exception, SystemExit) as e:
            results.append({"symbol": sym, "price": None,
                            "error": str(e), "type": "unknown"})

    return results


@router.get("/market", response_model=APIResponse)
async def get_market_prices():
    """Get all saved market prices (global, not user-scoped)."""
    data = fs.get_market_prices()
    return APIResponse(data=data)


@router.get("/daily", response_model=APIResponse)
async def get_daily_prices(
    limit: int = Query(30, ge=1, le=1000, description="Number of most recent daily entries"),
):
    """Get system daily price entries (admin-controlled, global), newest first.

    Used by the All Securities / Exchange Rates views to draw price history.
    """
    data = fs.get_system_daily_prices_history(limit)
    return APIResponse(data=data)


@router.get("/daily/latest", response_model=APIResponse)
async def get_latest_daily():
    """Get the latest system daily prices."""
    data = fs.get_latest_system_daily_prices()
    return APIResponse(data=data)


# ── Fund Listing (vnstock) ──

@router.get("/funds/listing")
async def list_available_funds(
    fund_type: str = Query("", description="Filter: BOND, STOCK, BALANCED, or empty"),
):
    """List all available open-ended funds from fmarket."""
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    try:
        result = price_service.get_fund_listing(fund_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/benchmarks/history", response_model=APIResponse)
async def get_benchmarks(days: int = Query(90, description="Number of days")):
    """Get history data for benchmarks (VNINDEX, BTC)."""
    data = price_service.get_benchmark_history(days)
    return APIResponse(data=data)


@router.get("/stablecoin-rate", response_model=APIResponse)
async def get_stablecoin_rate(
    symbol: str = Query("USDT", description="Stablecoin ticker: USDT or USDC"),
):
    """Get stablecoin (USDT/USDC) exchange rate to VND via CoinGecko."""
    symbol = symbol.strip().upper()
    if symbol not in {"USDT", "USDC"}:
        raise HTTPException(status_code=400, detail=f"Unsupported stablecoin: {symbol}")

    result = price_service.get_stablecoin_vnd_rate(symbol)
    if result is None:
        raise HTTPException(status_code=503, detail=f"Cannot fetch {symbol} VND rate")
    return APIResponse(data=result)


@router.get("/gold-sjc", response_model=APIResponse)
async def get_gold_sjc():
    """Get SJC gold price (per lượng) from vang.today API."""
    result = price_service.get_gold_sjc_price()
    if result is None:
        raise HTTPException(status_code=503, detail="Cannot fetch SJC gold price")
    return APIResponse(data=result)


@router.get("/system-tickers", response_model=APIResponse)
async def get_system_tickers():
    """Get system supported tickers."""
    data = fs.get_supported_tickers()
    return APIResponse(data=data)


@router.post("/fetch-live", response_model=APIResponse)
async def fetch_live_prices(user: dict = Depends(get_current_user)):
    """
    Backward-compatible alias of POST /api/securities/update-quotes:
    downloads prices for the caller's AUTO securities and JSON feeds only.
    """
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")
    from app.services import quote_update_service
    return APIResponse(data=quote_update_service.update_quotes_for_user(user["sub"], user["type"]))
