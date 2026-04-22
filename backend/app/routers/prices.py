"""
Prices router — vnstock + CoinGecko price fetching + market prices management.
"""
from fastapi import APIRouter, Query, Depends, HTTPException
from typing import Optional

from app.models.schemas import MarketPricesUpdate, APIResponse
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
async def save_market_prices(req: MarketPricesUpdate, user: dict = Depends(get_current_user)):
    """Save/update market prices (batch) — requires auth. Admin portal uses /api/admin/system-prices."""
    fs.batch_update_market_prices(req.prices)
    return APIResponse(data={"updated": len(req.prices)})


@router.get("/daily", response_model=APIResponse)
async def get_daily_prices():
    """Get system daily price entries (admin-controlled, global)."""
    data = fs.get_system_daily_prices_history(30)
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


@router.post("/system-tickers", response_model=APIResponse)
async def add_system_ticker(req: dict, user: dict = Depends(get_current_user)):
    """User adds a system ticker."""
    category = req.get("category", "stocks")
    ticker = req.get("ticker", "").strip().upper()
    config = fs.get_supported_tickers()
    if ticker:
        if category in config and ticker not in config[category]:
            config[category].append(ticker)
            fs.save_supported_tickers(config)
    return APIResponse(data=config)


@router.post("/fetch-live", response_model=APIResponse)
async def fetch_live_prices(user: dict = Depends(get_current_user)):
    """User triggers fetching live prices for all supported tickers."""
    from datetime import datetime
    if not settings.VNSTOCK_API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    target_date = datetime.now().strftime("%Y-%m-%d")
    ticker_config = fs.get_supported_tickers()
    all_tickers = (
        ticker_config.get("stocks", []) +
        ticker_config.get("crypto", []) +
        ticker_config.get("funds", [])
    )

    if not all_tickers:
        raise HTTPException(status_code=400, detail="No tickers configured.")

    ticker_type_map = {}
    for t in ticker_config.get("stocks", []): ticker_type_map[t] = "stock"
    for t in ticker_config.get("crypto", []): ticker_type_map[t] = "crypto"
    for t in ticker_config.get("funds", []): ticker_type_map[t] = "fund"

    results = price_service.fetch_all_portfolio_prices(all_tickers, target_date=target_date, ticker_type_map=ticker_type_map)

    prices_vnd = {}
    usdt_vnd = 0

    usdt_result = results.get("USDT")
    if usdt_result and usdt_result.get("price", 0) > 0:
        usdt_vnd = usdt_result["price"]
    if not usdt_vnd:
        usdt_vnd = usdt_result.get("exchangeRate", 25500) if usdt_result else 25500

    for ticker, result in results.items():
        raw_price = result.get("price", 0)
        if not raw_price or raw_price <= 0:
            continue
        ticker_type = result.get("type", "stock")
        if ticker_type == "crypto" and ticker not in {"USDT", "USDC"}:
            prices_vnd[ticker] = round(raw_price * usdt_vnd)
        else:
            prices_vnd[ticker] = raw_price

    market_update = {}
    stablecoin_keys = {"USDT", "USDC"}
    crypto_tickers = set(ticker_config.get("crypto", []))

    for ticker, price_vnd in prices_vnd.items():
        if ticker in stablecoin_keys:
            market_update[ticker] = {"price": price_vnd, "exchangeRate": price_vnd, "date": target_date, "source": "user_sync"}
        elif ticker in crypto_tickers:
            price_usd = round(price_vnd / usdt_vnd, 2) if usdt_vnd else 0
            market_update[ticker] = {"price": price_vnd, "price_usd": price_usd, "usdt_vnd_rate": usdt_vnd, "date": target_date, "source": "user_sync"}
        else:
            market_update[ticker] = {"price": price_vnd, "date": target_date, "source": "user_sync"}

    fs.save_system_daily_prices(target_date, prices_vnd, usdt_vnd)
    fs.batch_update_market_prices(market_update)

    return APIResponse(data={
        "prices": prices_vnd,
        "date": target_date,
        "fetched": len(prices_vnd),
        "total_tickers": len(all_tickers),
        "usdt_vnd_rate": usdt_vnd,
    })
