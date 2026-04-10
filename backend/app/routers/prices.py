"""
Prices router — vnstock + CoinGecko price fetching + market prices management.
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional

from app.models.schemas import DailyPricesCreate, MarketPricesUpdate, APIResponse
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


@router.post("/market", response_model=APIResponse)
async def save_market_prices(req: MarketPricesUpdate):
    """Save/update market prices (batch)."""
    fs.batch_update_market_prices(req.prices)
    return APIResponse(data={"updated": len(req.prices)})


@router.get("/daily", response_model=APIResponse)
async def get_daily_prices(user: dict = Depends(get_current_user)):
    """Get daily price entries (user-scoped)."""
    data = fs.get_daily_prices(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("/daily", response_model=APIResponse)
async def save_daily_prices(req: DailyPricesCreate,
                            user: dict = Depends(get_current_user)):
    """Save daily prices for a date (prices is a dict map like {USDT: 26500})."""
    fs.save_daily_prices(user["sub"], user["type"], req.date, req.prices)

    # Sync to global market prices
    market_update = {}
    for ticker, price_val in req.prices.items():
        if ticker and price_val is not None:
            if ticker == "USDT":
                market_update[ticker] = {
                    "price": 1,
                    "exchangeRate": price_val,
                    "date": req.date,
                    "source": "manual",
                }
            else:
                market_update[ticker] = {
                    "price": price_val,
                    "date": req.date,
                    "source": "manual",
                }
    if market_update:
        fs.batch_update_market_prices(market_update)

    return APIResponse(data={"saved": req.date, "count": len(req.prices)})


@router.get("/daily/latest", response_model=APIResponse)
async def get_latest_daily(user: dict = Depends(get_current_user)):
    """Get the latest daily prices entry."""
    data = fs.get_latest_daily_prices(user["sub"], user["type"])
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
