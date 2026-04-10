"""
Price service — vnstock + CoinGecko price fetching.
Port of api/main.py helper functions into the unified backend.
"""
import os
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import requests

from app.config import settings
from app.utils.cache import cache

logger = logging.getLogger("price_service")

# ── Symbol Classification ──

FUND_SYMBOLS = {
    "VFF", "VESAF", "DCBF", "DCDS", "DCIP", "DCDE", "DCAF",
    "SSISCA", "BVPF", "VEOF", "VCBFTBF", "VNDCF", "MBVF",
    "TCBF", "VIBF", "VFMVSF", "VFMVF1", "VFMVF4", "HDBOND"
}

# Known crypto ticker → CoinGecko ID mappings
CRYPTO_MAPPING = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "PAXG": "pax-gold",
    "USDT": "tether",
    "USDC": "usd-coin",
    "BNB": "binancecoin",
    "SOL": "solana",
    "XRP": "ripple",
    "ADA": "cardano",
    "DOGE": "dogecoin",
    "DOT": "polkadot",
    "AVAX": "avalanche-2",
    "LINK": "chainlink",
    "MATIC": "matic-network",
    "UNI": "uniswap",
    "AAVE": "aave",
    "ATOM": "cosmos",
    "NEAR": "near",
    "ARB": "arbitrum",
    "OP": "optimism",
    "SUI": "sui",
    "APT": "aptos",
    "INJ": "injective-protocol",
    "FTM": "fantom",
    "HYPE": "hyperliquid",
}

# Cache for CoinGecko search results to avoid repeated lookups
_coingecko_id_cache = {}


def _init_vnstock_api_key():
    """Initialize vnstock API key if available."""
    api_key = settings.VNSTOCK_API_KEY
    if not api_key:
        return
    try:
        from vnstock import set_api_key
        set_api_key(api_key)
    except ImportError:
        try:
            from vnstock import register_user
            register_user(api_key=api_key)
        except Exception as e:
            logger.error(f"Cannot initialize vnstock API key: {e}")
    except Exception as e:
        logger.error(f"Failed to set vnstock API key: {e}")


# Initialize on module load
_init_vnstock_api_key()


def resolve_coingecko_id(symbol: str) -> Optional[str]:
    """
    Auto-detect CoinGecko coin ID from a ticker symbol.
    Uses the known mapping first, then falls back to CoinGecko search API.
    Results are cached in-memory.
    """
    symbol_upper = symbol.upper()

    # 1. Check known mapping
    if symbol_upper in CRYPTO_MAPPING:
        return CRYPTO_MAPPING[symbol_upper]

    # 2. Check cache
    if symbol_upper in _coingecko_id_cache:
        return _coingecko_id_cache[symbol_upper]

    # 3. Search CoinGecko API
    try:
        headers = {}
        if settings.COINGECKO_API_KEY:
            headers["x-cg-demo-api-key"] = settings.COINGECKO_API_KEY

        url = "https://api.coingecko.com/api/v3/search"
        resp = requests.get(url, headers=headers, params={"query": symbol_upper}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            coins = data.get("coins", [])
            # Find exact symbol match
            for coin in coins:
                if coin.get("symbol", "").upper() == symbol_upper:
                    coin_id = coin["id"]
                    _coingecko_id_cache[symbol_upper] = coin_id
                    # Also add to mapping for future use
                    CRYPTO_MAPPING[symbol_upper] = coin_id
                    logger.info(f"  🔍 Auto-detected CoinGecko ID: {symbol_upper} → {coin_id}")
                    return coin_id
            logger.warning(f"  ⚠️ No exact CoinGecko match for {symbol_upper}")
        else:
            logger.warning(f"  ⚠️ CoinGecko search API returned {resp.status_code}")
    except Exception as e:
        logger.warning(f"  ⚠️ CoinGecko search failed for {symbol_upper}: {e}")

    _coingecko_id_cache[symbol_upper] = None
    return None


def get_fund_listing_cached():
    """Retrieve fmarket's fund listing with a 60-second TTL cache."""
    cached = cache.get("fund_listing", ttl=60)
    if cached is not None:
        logger.info("  ⚡ Fund listing from cache")
        return cached

    from vnstock import Fund
    fund = Fund()
    df = fund.listing()
    cache.set("fund_listing", df)
    return df


def get_fund_nav(symbol: str, target_date: str = None) -> Optional[dict]:
    """Get NAV for an open-ended fund, falling back to historical if needed."""
    from vnstock import Fund
    fund = Fund()

    if not target_date or target_date == datetime.now().strftime("%Y-%m-%d"):
        try:
            listing_df = get_fund_listing_cached()
            if listing_df is not None and not listing_df.empty:
                match = listing_df[listing_df['short_name'].str.upper() == symbol.upper()]
                if not match.empty:
                    nav = float(match.iloc[0]['nav'])
                    date = str(match.iloc[0].get('nav_update_at', ''))
                    logger.info(f"  ✅ Fund {symbol} NAV = {nav} (listing, date: {date})")
                    return {"symbol": symbol, "price": nav, "date": date,
                            "source": "fund_listing", "type": "fund"}
        except (Exception, SystemExit) as e:
            err = str(e)
            if any(kw in err for kw in ["GIỚI HẠN API", "Rate Limit", "20 requests/phút"]):
                logger.error(f"  [RATE_LIMIT] Fund listing for {symbol}")
            else:
                logger.warning(f"  ⚠️ Fund listing failed for {symbol}: {err}")

    try:
        nav_df = fund.details.nav_report(symbol)
        if nav_df is not None and not nav_df.empty:
            if target_date:
                nav_df = nav_df[nav_df['date'] <= target_date]
            if not nav_df.empty:
                latest = nav_df.iloc[-1]
                nav = float(latest['nav_per_unit'])
                date = str(latest.get('date', ''))
                logger.info(f"  ✅ Fund {symbol} NAV = {nav} (nav_report, date: {date})")
                return {"symbol": symbol, "price": nav, "date": date,
                        "source": "fund_nav_report", "type": "fund"}
    except (Exception, SystemExit) as e:
        err = str(e)
        if any(kw in err for kw in ["GIỚI HẠN API", "Rate Limit", "20 requests/phút"]):
            logger.error(f"  [RATE_LIMIT] Fund nav_report for {symbol}")
        else:
            logger.warning(f"  ⚠️ Fund nav_report failed for {symbol}: {err}")

    return None


def get_stock_price(symbol: str, source: str = "VCI",
                    target_date: str = None) -> Optional[dict]:
    """Get latest price for a stock/ETF traded on exchange."""
    from vnstock import Vnstock

    if target_date:
        end_date = target_date
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
        raw_price = float(latest.get("close", 0))
        price = raw_price * 1000  # vnstock returns x1000 VND

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
            "type": "stock",
        }
    except (Exception, SystemExit) as e:
        err = str(e)
        if any(kw in err for kw in ["GIỚI HẠN API", "Rate Limit", "20 requests/phút"]):
            logger.error(f"  [RATE_LIMIT] Stock {symbol}")
        else:
            logger.warning(f"  ⚠️ Stock quote failed for {symbol}: {err}")
        return None


def get_crypto_price_coingecko(symbol: str,
                               target_date: str = None) -> Optional[dict]:
    """Get crypto price in USD via CoinGecko. Auto-detects coin ID."""
    coin_id = resolve_coingecko_id(symbol.upper())
    if not coin_id:
        logger.warning(f"  ⚠️ Cannot resolve CoinGecko ID for {symbol}")
        return None

    headers = {}
    if settings.COINGECKO_API_KEY:
        headers["x-cg-demo-api-key"] = settings.COINGECKO_API_KEY

    is_historical = target_date and target_date != datetime.now().strftime("%Y-%m-%d")

    try:
        if not is_historical:
            url = "https://api.coingecko.com/api/v3/simple/price"
            params = {"ids": coin_id, "vs_currencies": "usd", "include_24hr_vol": "true"}
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()

            if resp.status_code == 200 and coin_id in data:
                price = float(data[coin_id].get("usd", 0))
                volume = float(data[coin_id].get("usd_24h_vol", 0))
                logger.info(f"  ✅ Crypto {symbol} = {price} USD (latest)")
                return {
                    "symbol": symbol, "price": price, "price_usdt": price,
                    "volume": volume, "date": datetime.now().strftime("%Y-%m-%d"),
                    "source": "CoinGecko", "type": "crypto",
                }
            else:
                logger.warning(f"  ⚠️ CoinGecko latest fail {resp.status_code}: {data}")
        else:
            dt_obj = datetime.strptime(target_date, "%Y-%m-%d")
            cg_date = dt_obj.strftime("%d-%m-%Y")
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/history"
            params = {"date": cg_date, "localization": "false"}
            resp = requests.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()

            if resp.status_code == 200 and "market_data" in data:
                price = float(data["market_data"]["current_price"].get("usd", 0))
                volume = float(data["market_data"]["total_volume"].get("usd", 0))
                logger.info(f"  ✅ Crypto {symbol} = {price} USD (history {target_date})")
                return {
                    "symbol": symbol, "price": price, "price_usdt": price,
                    "volume": volume, "date": target_date,
                    "source": "CoinGecko", "type": "crypto",
                }
            else:
                logger.warning(f"  ⚠️ CoinGecko historical fail {resp.status_code}: {data}")

    except Exception as e:
        logger.warning(f"  ⚠️ CoinGecko request failed for {symbol}: {e}")

    return None


def is_crypto_ticker(symbol: str) -> bool:
    """Check if a symbol is a crypto ticker (in mapping or looks like crypto)."""
    s = symbol.upper()
    if s in CRYPTO_MAPPING:
        return True
    # Try auto-detect via cache
    if s in _coingecko_id_cache:
        return _coingecko_id_cache[s] is not None
    return False


def get_price(symbol: str, source: str = "VCI",
              target_date: str = None) -> Optional[dict]:
    """
    Unified price fetcher — auto-detects asset type (fund/crypto/stock).
    For unknown tickers, tries CoinGecko auto-detect before falling back to stock.
    """
    symbol = symbol.strip().upper()
    logger.info(f"📈 Fetching price for {symbol} (date: {target_date or 'latest'})")

    if symbol in FUND_SYMBOLS:
        logger.info(f"  🏦 {symbol} → Fund module")
        return get_fund_nav(symbol, target_date)
    elif symbol in CRYPTO_MAPPING:
        logger.info(f"  💸 {symbol} → CoinGecko API (known)")
        return get_crypto_price_coingecko(symbol, target_date)
    else:
        # Try stock first, fall back to CoinGecko auto-detect
        logger.info(f"  📊 {symbol} → trying Stock module first")
        result = get_stock_price(symbol, source, target_date)
        if result:
            return result

        # If stock failed, try CoinGecko auto-detect
        logger.info(f"  🔍 {symbol} → trying CoinGecko auto-detect")
        coin_id = resolve_coingecko_id(symbol)
        if coin_id:
            return get_crypto_price_coingecko(symbol, target_date)

        return None


def fetch_all_portfolio_prices(tickers: list, target_date: str = None) -> dict:
    """
    Batch fetch prices for a list of tickers.
    Returns {ticker: price_result_dict}.
    Used by the scheduler for automated daily price fetching.
    """
    results = {}
    for ticker in tickers:
        if ticker in ("VNĐ", "USDT_RATE"):
            continue
        try:
            result = get_price(ticker, "VCI", target_date)
            if result:
                results[ticker] = result
            else:
                logger.warning(f"  ⚠️ No price data for {ticker}")
        except Exception as e:
            logger.error(f"  ❌ Error fetching {ticker}: {e}")
        # Small delay to avoid rate limits
        time.sleep(0.5)
    return results


def get_fund_listing(fund_type: str = "") -> list:
    """List all available open-ended funds from fmarket."""
    from vnstock import Fund
    fund = Fund()
    df = fund.listing(fund_type=fund_type) if fund_type else fund.listing()

    if df is None or df.empty:
        return []

    cols = ['short_name', 'name', 'fund_type', 'nav', 'nav_change_previous',
            'nav_change_1m', 'nav_change_3m', 'nav_change_12m', 'nav_update_at']
    available_cols = [c for c in cols if c in df.columns]
    return df[available_cols].to_dict(orient='records')
