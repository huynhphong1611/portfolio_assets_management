"""
vnstock API Proxy — FastAPI service for fetching Vietnamese stock market data.

Supports:
- Stock prices (ETFs traded on exchange): Vnstock().stock().quote.history()
- Fund NAV (open-ended funds): Fund().listing() + Fund().details.nav_report()

Config: Set VNSTOCK_API_ENABLED=true in .env to enable. Logs all requests.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ============================================================
# CONFIG
# ============================================================

API_ENABLED = os.getenv("VNSTOCK_API_ENABLED", "true").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE", "/app/logs/vnstock_api.log")

# ============================================================
# Fund symbols (quỹ mở) vs Stock symbols (ETF giao dịch trên sàn)
# ============================================================

FUND_SYMBOLS = {
    "VFF", "VESAF", "DCBF", "DCDS", "DCIP", "DCDE", "DCAF",
    "SSISCA", "BVPF", "VEOF", "VCBFTBF", "VNDCF", "MBVF",
    "TCBF", "VIBF", "VFMVSF", "VFMVF1", "VFMVF4", "HDBOND"
}

# ============================================================
# LOGGING
# ============================================================

os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("vnstock_api")

# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="vnstock API Proxy",
    description="Proxy service for Vietnamese stock market data (stocks + funds)",
    version="1.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# HELPER: Get fund NAV from Fund module
# ============================================================

def get_fund_nav(symbol: str):
    """Get latest NAV for an open-ended fund using Fund().listing()"""
    from vnstock import Fund
    fund = Fund()

    # Method 1: Try listing() which has current NAV for all funds
    try:
        listing_df = fund.listing()
        if listing_df is not None and not listing_df.empty:
            match = listing_df[listing_df['short_name'].str.upper() == symbol.upper()]
            if not match.empty:
                nav = float(match.iloc[0]['nav'])
                date = str(match.iloc[0].get('nav_update_at', ''))
                logger.info(f"  ✅ Fund {symbol} NAV = {nav} (from listing, date: {date})")
                return {"symbol": symbol, "price": nav, "date": date, "source": "fund_listing", "type": "fund"}
    except Exception as e:
        logger.warning(f"  ⚠️ Fund listing failed for {symbol}: {e}")

    # Method 2: Try nav_report for historical NAV, get latest
    try:
        nav_df = fund.details.nav_report(symbol)
        if nav_df is not None and not nav_df.empty:
            latest = nav_df.iloc[-1]
            nav = float(latest['nav_per_unit'])
            date = str(latest.get('date', ''))
            logger.info(f"  ✅ Fund {symbol} NAV = {nav} (from nav_report, date: {date})")
            return {"symbol": symbol, "price": nav, "date": date, "source": "fund_nav_report", "type": "fund"}
    except Exception as e:
        logger.warning(f"  ⚠️ Fund nav_report failed for {symbol}: {e}")

    return None


def get_stock_price(symbol: str, source: str = "VCI"):
    """Get latest price for a stock/ETF traded on exchange"""
    from vnstock import Vnstock

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

    stock = Vnstock().stock(symbol=symbol, source=source)
    df = stock.quote.history(start=start_date, end=end_date, interval="1D")

    if df is None or df.empty:
        return None

    latest = df.iloc[-1]
    # vnstock returns ETF/stock prices in x1000 VND (e.g. 24.73 = 24,730 VNĐ)
    raw_price = float(latest.get("close", 0))
    price = raw_price * 1000  # Convert to full VNĐ
    
    return {
        "symbol": symbol,
        "price": price,
        "price_raw_x1000": raw_price,
        "open": float(latest.get("open", 0)) * 1000,
        "high": float(latest.get("high", 0)) * 1000,
        "low": float(latest.get("low", 0)) * 1000,
        "volume": int(latest.get("volume", 0)),
        "date": str(latest.get("time", "")),
        "source": source,
        "type": "stock"
    }


# ============================================================
# ENDPOINTS
# ============================================================

@app.get("/")
def health():
    """Health check and config status"""
    return {
        "status": "ok",
        "api_enabled": API_ENABLED,
        "timestamp": datetime.now().isoformat(),
        "version": "1.1.0",
        "fund_symbols": list(FUND_SYMBOLS)
    }


@app.get("/api/status")
def api_status():
    """Check if vnstock API is enabled and working"""
    if not API_ENABLED:
        return {"enabled": False, "message": "API is disabled via VNSTOCK_API_ENABLED env var"}

    try:
        from vnstock import Vnstock, Fund
        return {"enabled": True, "message": "vnstock library loaded (stock + fund modules)"}
    except ImportError as e:
        return {"enabled": False, "message": f"vnstock import error: {e}"}


@app.get("/api/prices/stock")
def get_single_price(
    symbol: str = Query(..., description="Stock/Fund ticker (e.g. FUEVN100, VFF, VESAF)"),
    source: str = Query("VCI", description="Data source for stocks: VCI, TCBS, MSN")
):
    """Fetch latest price for a single symbol (auto-detects stock vs fund)"""
    if not API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    symbol = symbol.strip().upper()
    logger.info(f"📈 Fetching price for {symbol}")

    try:
        # Determine if this is a fund or a stock
        if symbol in FUND_SYMBOLS:
            logger.info(f"  🏦 {symbol} is a Fund — using Fund module")
            result = get_fund_nav(symbol)
        else:
            logger.info(f"  📊 {symbol} is a Stock/ETF — using Quote module")
            result = get_stock_price(symbol, source)

        if result is None:
            logger.warning(f"  ⚠️ No data for {symbol}")
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")

        logger.info(f"  ✅ {symbol} = {result['price']} ({result.get('date', 'N/A')})")
        return result

    except HTTPException:
        raise
    except ImportError:
        logger.error("❌ vnstock library not installed")
        raise HTTPException(status_code=500, detail="vnstock library not available")
    except Exception as e:
        logger.error(f"❌ Error fetching {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prices/stocks")
def get_multiple_prices(
    symbols: str = Query(..., description="Comma-separated symbols (e.g. FUEVN100,VFF,VESAF)"),
    source: str = Query("VCI", description="Data source for stocks")
):
    """Fetch prices for multiple symbols (auto-detects stock vs fund for each)"""
    if not API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    logger.info(f"📊 Batch fetch for: {symbol_list}")

    results = []
    for sym in symbol_list:
        try:
            if sym in FUND_SYMBOLS:
                logger.info(f"  🏦 {sym} → Fund module")
                result = get_fund_nav(sym)
            else:
                logger.info(f"  📊 {sym} → Stock module")
                result = get_stock_price(sym, source)

            if result:
                result["error"] = None
                results.append(result)
            else:
                results.append({"symbol": sym, "price": None, "error": "No data found", "type": "unknown"})

        except Exception as e:
            results.append({"symbol": sym, "price": None, "error": str(e), "type": "unknown"})
            logger.error(f"  ❌ {sym}: {str(e)}")

    logger.info(f"📊 Batch complete: {len(results)} symbols processed")
    return results


@app.get("/api/funds/listing")
def list_funds(
    fund_type: str = Query("", description="Filter: BOND, STOCK, BALANCED, or empty for all")
):
    """List all available open-ended funds from fmarket"""
    if not API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    logger.info(f"📋 Fetching fund listing (type={fund_type})")

    try:
        from vnstock import Fund
        fund = Fund()
        df = fund.listing(fund_type=fund_type) if fund_type else fund.listing()

        if df is None or df.empty:
            return []

        # Return key columns
        cols = ['short_name', 'name', 'fund_type', 'nav', 'nav_change_previous',
                'nav_change_1m', 'nav_change_3m', 'nav_change_12m', 'nav_update_at']
        available_cols = [c for c in cols if c in df.columns]
        result = df[available_cols].to_dict(orient='records')
        logger.info(f"✅ Found {len(result)} funds")
        return result

    except Exception as e:
        logger.error(f"❌ Fund listing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
