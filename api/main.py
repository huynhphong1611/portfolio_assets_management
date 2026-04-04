"""
vnstock API Proxy — FastAPI service for fetching Vietnamese stock market data.

Supports:
- Stock prices (ETFs traded on exchange): Vnstock().stock().quote.history()
- Fund NAV (open-ended funds): Fund().listing() + Fund().details.nav_report()

Config: Set VNSTOCK_API_ENABLED=true in .env to enable. Logs all requests.
"""

import os
import logging
import time
from datetime import datetime, timedelta
from typing import Optional
import requests
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ============================================================
# CONFIG
# ============================================================

try:
    from dotenv import load_dotenv
    load_dotenv()  # Load .env explicitly for cross-environment compatibility
except ImportError:
    pass # Docker-compose natively injects `.env` to `os.environ`, so dotenv is optional

API_ENABLED = os.getenv("VNSTOCK_API_ENABLED", "true").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FILE = os.getenv("LOG_FILE", "/app/logs/vnstock_api.log")
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")

# Load API key explicitly and push to vnstock session memory setup
VNSTOCK_API_KEY = os.getenv("VNSTOCK_API_KEY", "")
if VNSTOCK_API_KEY:
    try:
        from vnstock import set_api_key
        set_api_key(VNSTOCK_API_KEY)
    except ImportError:
        try:
            from vnstock import register_user
            register_user(api_key=VNSTOCK_API_KEY)
        except Exception as e:
            logging.error(f"Cannot initialize API key via register_user: {e}")
    except Exception as e:
        logging.error(f"Failed to authenticate vnstock API key: {e}")

# ============================================================
# Fund symbols (quỹ mở) vs Stock symbols (ETF giao dịch trên sàn)
# ============================================================

FUND_SYMBOLS = {
    "VFF", "VESAF", "DCBF", "DCDS", "DCIP", "DCDE", "DCAF",
    "SSISCA", "BVPF", "VEOF", "VCBFTBF", "VNDCF", "MBVF",
    "TCBF", "VIBF", "VFMVSF", "VFMVF1", "VFMVF4", "HDBOND"
}

# ============================================================
# Crypto mapping (Symbol to CoinGecko ID)
# ============================================================

CRYPTO_MAPPING = {
    "BTC": "bitcoin", 
    "ETH": "ethereum", 
    "PAXG": "pax-gold", 
    "USDT": "tether", 
    "USDC": "usd-coin", 
    "BNB": "binancecoin"
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
# CACHE (TTL)
# ============================================================

_CACHE = {}

def get_fund_listing_cached():
    """Retrieve fmarket's fund listing with a 60-second TTL cache."""
    now = time.time()
    if "fund_listing" in _CACHE and now - _CACHE["fund_listing"]["time"] < 60:
        logger.info("  ⚡ Fund listing fetched from In-Memory Cache")
        return _CACHE["fund_listing"]["data"]
    
    from vnstock import Fund
    fund = Fund()
    df = fund.listing()
    _CACHE["fund_listing"] = {"data": df, "time": now}
    return df

# ============================================================
# HELPER: Get fund NAV from Fund module
# ============================================================

def get_fund_nav(symbol: str, target_date: str = None):
    """Get NAV for an open-ended fund, falling back to historical if needed"""
    from vnstock import Fund
    fund = Fund()

    # If asking for today/latest, try the fast listing() method first
    if not target_date or target_date == datetime.now().strftime("%Y-%m-%d"):
        try:
            listing_df = get_fund_listing_cached()
            if listing_df is not None and not listing_df.empty:
                match = listing_df[listing_df['short_name'].str.upper() == symbol.upper()]
                if not match.empty:
                    nav = float(match.iloc[0]['nav'])
                    date = str(match.iloc[0].get('nav_update_at', ''))
                    logger.info(f"  ✅ Fund {symbol} NAV = {nav} (from listing, date: {date})")
                    return {"symbol": symbol, "price": nav, "date": date, "source": "fund_listing", "type": "fund"}
        except (Exception, SystemExit) as e:
            err_msg = str(e)
            if "GIỚI HẠN API" in err_msg or "Rate Limit" in err_msg or "20 requests/phút" in err_msg:
                logger.error(f"  [RATE_LIMIT_ERROR] vnstock API rate limit hit while fetching {symbol} listing.")
            else:
                logger.warning(f"  ⚠️ Fund listing failed for {symbol}: {err_msg}")

    # Fallback to historical nav_report for specific date or if listing fails
    try:
        nav_df = fund.details.nav_report(symbol)
        if nav_df is not None and not nav_df.empty:
            if target_date:
                nav_df = nav_df[nav_df['date'] <= target_date]
            
            if not nav_df.empty:
                # Based on check, nav_report is sorted ascending (oldest to newest)
                latest = nav_df.iloc[-1]
                nav = float(latest['nav_per_unit'])
                date = str(latest.get('date', ''))
                logger.info(f"  ✅ Fund {symbol} NAV = {nav} (from nav_report, date: {date})")
                return {"symbol": symbol, "price": nav, "date": date, "source": "fund_nav_report", "type": "fund"}
            else:
                logger.warning(f"  ⚠️ No nav_report data before {target_date} for {symbol}")
    except (Exception, SystemExit) as e:
        err_msg = str(e)
        if "GIỚI HẠN API" in err_msg or "Rate Limit" in err_msg or "20 requests/phút" in err_msg:
            logger.error(f"  [RATE_LIMIT_ERROR] vnstock API rate limit hit while fetching {symbol} nav_report.")
        else:
            logger.warning(f"  ⚠️ Fund nav_report failed for {symbol}: {err_msg}")

    return None


def get_stock_price(symbol: str, source: str = "VCI", target_date: str = None):
    """Get latest price for a stock/ETF traded on exchange (or fallback 1D backwards to nearest session)"""
    from vnstock import Vnstock

    # If target_date is given, we scan backward up to 7 days before it
    if target_date:
        end_date = target_date
        # Convert to datetime to subtract 7 days
        tgt_dt = datetime.strptime(target_date, "%Y-%m-%d")
        start_date = (tgt_dt - timedelta(days=7)).strftime("%Y-%m-%d")
    else:
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

    try:
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
    except (Exception, SystemExit) as e:
        err_msg = str(e)
        if "GIỚI HẠN API" in err_msg or "Rate Limit" in err_msg or "20 requests/phút" in err_msg:
            logger.error(f"  [RATE_LIMIT_ERROR] vnstock API rate limit hit while fetching stock {symbol}.")
        else:
            logger.warning(f"  ⚠️ Stock quote failed for {symbol}: {err_msg}")
        return None


def get_crypto_price_coingecko(symbol: str, target_date: str = None):
    """Get crypto price in USD via CoinGecko. Supports historical dates!"""
    coin_id = CRYPTO_MAPPING.get(symbol.upper())
    if not coin_id:
        logger.warning(f"  ⚠️ No CoinGecko ID mapping found for {symbol}")
        return None
        
    headers = {}
    if COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = COINGECKO_API_KEY
        
    is_historical = target_date and target_date != datetime.now().strftime("%Y-%m-%d")
    
    try:
        if not is_historical:
            # Latest price logic
            url = "https://api.coingecko.com/api/v3/simple/price"
            parameters = {
                "ids": coin_id,
                "vs_currencies": "usd",
                "include_24hr_vol": "true"
            }
            response = requests.get(url, headers=headers, params=parameters, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and coin_id in data:
                price = float(data[coin_id].get("usd", 0))
                volume = float(data[coin_id].get("usd_24h_vol", 0))
                
                logger.info(f"  ✅ Crypto {symbol} = {price} USD (from CoinGecko latest)")
                return {
                    "symbol": symbol,
                    "price": price,
                    "price_usdt": price, 
                    "volume": volume,
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "source": "CoinGecko",
                    "type": "crypto"
                }
            else:
                logger.warning(f"  ⚠️ CoinGecko latest fail {response.status_code}: {data}")
        else:
            # Historical price logic
            # CoinGecko expects DD-MM-YYYY
            dt_obj = datetime.strptime(target_date, "%Y-%m-%d")
            cg_date = dt_obj.strftime("%d-%m-%Y")
            
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/history"
            parameters = {
                "date": cg_date,
                "localization": "false"
            }
            response = requests.get(url, headers=headers, params=parameters, timeout=10)
            data = response.json()
            
            if response.status_code == 200 and "market_data" in data:
                price = float(data["market_data"]["current_price"].get("usd", 0))
                volume = float(data["market_data"]["total_volume"].get("usd", 0))
                
                logger.info(f"  ✅ Crypto {symbol} = {price} USD (from CoinGecko history {target_date})")
                return {
                    "symbol": symbol,
                    "price": price,
                    "price_usdt": price, 
                    "volume": volume,
                    "date": target_date,
                    "source": "CoinGecko",
                    "type": "crypto"
                }
            else:
                logger.warning(f"  ⚠️ CoinGecko historical fail {response.status_code}: {data}")
            
    except Exception as e:
        logger.warning(f"  ⚠️ CoinGecko API request failed for {symbol}: {e}")
        
    return None


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
    source: str = Query("VCI", description="Data source for stocks: VCI, TCBS, MSN"),
    target_date: Optional[str] = Query(None, description="Optional target date (YYYY-MM-DD)")
):
    """Fetch price for a single symbol (auto-detects stock vs fund vs crypto). Uses historical if target_date provided."""
    if not API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    symbol = symbol.strip().upper()
    logger.info(f"📈 Fetching price for {symbol} (date: {target_date or 'latest'})")

    try:
        # Determine if this is a fund, crypto, or stock
        if symbol in FUND_SYMBOLS:
            logger.info(f"  🏦 {symbol} is a Fund — using Fund module")
            result = get_fund_nav(symbol, target_date)
        elif symbol in CRYPTO_MAPPING.keys():
            logger.info(f"  💸 {symbol} is a Crypto — using CoinGecko API")
            result = get_crypto_price_coingecko(symbol, target_date)
        else:
            logger.info(f"  📊 {symbol} is a Stock/ETF — using Quote module")
            result = get_stock_price(symbol, source, target_date)

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
    except (Exception, SystemExit) as e:
        logger.error(f"❌ Error fetching {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/prices/stocks")
def get_multiple_prices(
    symbols: str = Query(..., description="Comma-separated symbols (e.g. FUEVN100,VFF,VESAF)"),
    source: str = Query("VCI", description="Data source for stocks"),
    target_date: Optional[str] = Query(None, description="Optional target date (YYYY-MM-DD)")
):
    """Fetch prices for multiple symbols (auto-detects stock vs fund vs crypto). Uses historical if target_date provided."""
    if not API_ENABLED:
        raise HTTPException(status_code=503, detail="API is disabled")

    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    logger.info(f"📊 Batch fetch for: {symbol_list} (date: {target_date or 'latest'})")

    results = []
    for sym in symbol_list:
        try:
            if sym in FUND_SYMBOLS:
                logger.info(f"  🏦 {sym} → Fund module")
                result = get_fund_nav(sym, target_date)
            elif sym in CRYPTO_MAPPING.keys():
                logger.info(f"  💸 {sym} → CoinGecko API")
                result = get_crypto_price_coingecko(sym, target_date)
            else:
                logger.info(f"  📊 {sym} → Stock module")
                result = get_stock_price(sym, source, target_date)

            if result:
                result["error"] = None
                results.append(result)
            else:
                results.append({"symbol": sym, "price": None, "error": "No data found/RATE_LIMIT_ERROR", "type": "unknown"})

        except (Exception, SystemExit) as e:
            err_msg = str(e)
            if "GIỚI HẠN API" in err_msg or "Rate Limit" in err_msg or "20 requests/phút" in err_msg:
                err_msg = "[RATE_LIMIT_ERROR] " + err_msg
            results.append({"symbol": sym, "price": None, "error": err_msg, "type": "unknown"})
            logger.error(f"  ❌ {sym}: {err_msg}")

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
