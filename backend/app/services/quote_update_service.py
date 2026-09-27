"""
Quote updates, Portfolio Performance style ("Online → Update quotes").

- System feed (vnstock / CoinGecko / SJC): prices are identical for every user,
  so they are downloaded once and cached globally (system/prices/daily + marketPrices).
- User feeds: GENERIC-JSON securities are downloaded per user into the user's
  own price history (securityPrices/{ticker}). MANUAL securities are never downloaded.
"""
import logging
from datetime import datetime

from app.services import firestore_service as fs
from app.services import portfolio_service as ps
from app.services import price_service
from app.services.quote_feed_service import FeedError, read_json_feed

logger = logging.getLogger("quote_update")

STABLECOINS = {"USDT", "USDC"}


def ticker_type_map_for(transactions: list | None = None) -> dict:
    """Asset-type hints: admin ticker config first, then crypto asset classes from transactions."""
    config = fs.get_supported_tickers()
    hints = {}
    for t in config.get("stocks", []):
        hints[t] = "stock"
    for t in config.get("crypto", []):
        hints[t] = "crypto"
    for t in config.get("funds", []):
        hints[t] = "fund"
    for tx in transactions or []:
        t = (tx.get("ticker") or "").strip().upper()
        if t and t not in hints and tx.get("assetClass") == "Tài sản mã hóa":
            hints[t] = "crypto"
    return hints


def fetch_and_store_system_prices(tickers: list, target_date: str, ticker_type_map: dict) -> dict:
    """
    Download prices for `tickers` (USDT, USDC and GOLD are always included),
    convert them to VND, merge them into the system price cache and marketPrices.
    """
    results = price_service.fetch_all_portfolio_prices(tickers, target_date=target_date,
                                                        ticker_type_map=ticker_type_map)

    usdt_result = results.get("USDT") or {}
    usdt_vnd = usdt_result.get("price") or usdt_result.get("exchangeRate") or 0
    if not usdt_vnd:
        usdt_vnd = fs.get_global_settings().get("usdt_vnd_default", 26500)

    prices_vnd, market_update = {}, {}
    for ticker, result in results.items():
        raw = result.get("price") or 0
        if raw <= 0:
            continue
        kind = result.get("type", "stock")
        if ticker in STABLECOINS:
            prices_vnd[ticker] = raw
            market_update[ticker] = {"price": raw, "exchangeRate": raw, "date": target_date, "source": result.get("source", "auto")}
        elif ticker == "GOLD":
            sell = result.get("sell") or raw
            prices_vnd[ticker] = sell
            market_update[ticker] = {"price": sell, "buy": result.get("buy", 0), "sell": sell,
                                     "date": target_date, "source": result.get("source", "vang.today")}
        elif kind == "crypto":
            vnd = round(raw * usdt_vnd)
            prices_vnd[ticker] = vnd
            market_update[ticker] = {"price": vnd, "price_usd": raw, "usdt_vnd_rate": usdt_vnd,
                                     "date": target_date, "source": result.get("source", "CoinGecko")}
        else:
            prices_vnd[ticker] = raw
            market_update[ticker] = {"price": raw, "date": target_date, "source": result.get("source", "auto")}

    if prices_vnd:
        fs.save_system_daily_prices(target_date, prices_vnd, usdt_vnd)
    if market_update:
        fs.batch_update_market_prices(market_update)
    return {"prices": prices_vnd, "usdt_vnd_rate": usdt_vnd, "fetched": len(prices_vnd)}


def update_user_json_feeds(user_id: str, user_type: str, securities: list, cache: dict | None = None) -> dict:
    """Download every GENERIC-JSON security of one user into their price history."""
    cache = {} if cache is None else cache
    updated, errors = [], []
    for sec in securities or []:
        if (sec.get("feed") or "").upper() != ps.FEED_JSON or sec.get("isRetired"):
            continue
        ticker = sec.get("ticker") or sec.get("id")
        try:
            quotes = read_json_feed(sec, cache)
            fs.merge_security_prices(user_id, user_type, ticker, quotes)
            latest = max(quotes)
            updated.append({"ticker": ticker, "date": latest, "price": quotes[latest], "count": len(quotes)})
        except FeedError as e:
            errors.append({"ticker": ticker, "error": str(e)})
        except Exception as e:  # network or parsing surprises must not stop other feeds
            logger.warning(f"JSON feed failed for {user_id}/{ticker}: {e}")
            errors.append({"ticker": ticker, "error": "Lỗi không xác định khi đọc nguồn giá"})
    return {"updated": updated, "errors": errors}


def update_quotes_for_user(user_id: str, user_type: str) -> dict:
    """What the user's "Cập nhật giá" button does: system prices for their AUTO tickers + their JSON feeds."""
    today = datetime.now().strftime("%Y-%m-%d")
    transactions = fs.get_transactions(user_id, user_type)
    securities = fs.get_securities(user_id, user_type)
    tickers = ps.auto_priced_tickers(transactions, securities)

    system = fetch_and_store_system_prices(tickers, today, ticker_type_map_for(transactions))
    feeds = update_user_json_feeds(user_id, user_type, securities)
    return {
        "date": today,
        "fetched": system["fetched"],
        "total_tickers": len(set(tickers) | {"USDT", "USDC", "GOLD"}),
        "usdt_vnd_rate": system["usdt_vnd_rate"],
        "prices": system["prices"],
        "jsonFeeds": feeds,
    }
