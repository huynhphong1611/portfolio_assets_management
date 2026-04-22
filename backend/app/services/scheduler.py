"""
Scheduler service — APScheduler daily job for automated price fetching & snapshots.

Runs at 9:00 AM Asia/Ho_Chi_Minh daily:
1. For each user: get transactions → extract unique tickers
2. Fetch prices for all tickers (vnstock + CoinGecko)
3. Save daily prices + update market prices
4. Calculate portfolio + generate snapshot
"""
import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.services import firestore_service as fs
from app.services import price_service
from app.services import portfolio_service as ps

logger = logging.getLogger("scheduler")

# Global scheduler instance
scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")


def _get_all_user_ids() -> list[dict]:
    """
    Get all user IDs that have data.
    Guest users are found via the 'users' auth collection.
    Firebase users are found via Firebase Admin Auth SDK + Firestore fallback.
    Returns list of {user_id, user_type}.
    """
    from app.firebase_init import get_db
    db = get_db()
    users = []
    seen_ids = set()

    # Guest users — registered in 'users' collection, data in 'guest_users/{id}/...'
    try:
        auth_docs = db.collection("users").stream()
        for doc in auth_docs:
            users.append({"user_id": doc.id, "user_type": "guest"})
            seen_ids.add(doc.id)
        logger.info(f"  Found {len(users)} guest users from 'users' collection")
    except Exception as e:
        logger.error(f"Error listing guest users from 'users' collection: {e}")

    # System (Firebase Auth) users — discovered via Firebase Admin Auth SDK.
    # Firestore parent docs under system_users/{uid} may not exist if only
    # sub-collections were created, so we use Admin Auth as primary source.
    system_count = 0
    try:
        from app.firebase_init import get_firebase_auth
        firebase_auth = get_firebase_auth()
        # list_users returns paginated results; iterate all pages
        page = firebase_auth.list_users()
        while page:
            for firebase_user in page.users:
                uid = firebase_user.uid
                if uid not in seen_ids:
                    users.append({"user_id": uid, "user_type": "firebase"})
                    seen_ids.add(uid)
                    system_count += 1
            page = page.get_next_page()
        logger.info(f"  Found {system_count} system users from Firebase Auth")
    except Exception as e:
        logger.error(f"Error listing Firebase Auth users: {e}")
        # Fallback: try listing system_users collection documents
        logger.info("  Falling back to Firestore 'system_users' collection scan...")
        try:
            system_docs = db.collection("system_users").stream()
            for doc in system_docs:
                if doc.id not in seen_ids:
                    users.append({"user_id": doc.id, "user_type": "firebase"})
                    seen_ids.add(doc.id)
                    system_count += 1
            logger.info(f"  Fallback found {system_count} system users from Firestore")
        except Exception as e2:
            logger.error(f"Error in fallback system user listing: {e2}")

    return users


def _extract_tickers(transactions: list) -> list[str]:
    """Extract unique non-cash tickers from transactions."""
    tickers = set()
    for tx in transactions:
        ticker = tx.get("ticker", "")
        if ticker and ticker != "VNĐ":
            tickers.add(ticker)
    return sorted(tickers)


def daily_price_snapshot_job():
    """
    Main scheduled job — runs daily at 9:00 AM.
    Fetches prices for admin-configured tickers, saves to system/prices/daily,
    updates marketPrices, then generates per-user snapshots from system prices.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    logger.info(f"🕘 === DAILY SCHEDULER START === {today}")

    # 1. Load admin-configured tickers
    ticker_config = fs.get_supported_tickers()
    all_tickers = list(set(
        ticker_config.get("stocks", []) +
        ticker_config.get("crypto", [])
    ))

    if not all_tickers:
        # Fallback: collect from all users if admin has not configured yet
        logger.warning("No admin tickers configured, falling back to user transaction tickers")
        users = _get_all_user_ids()
        fallback_tickers = set()
        for user_info in users:
            try:
                transactions = fs.get_transactions(user_info["user_id"], user_info["user_type"])
                fallback_tickers.update(_extract_tickers(transactions))
            except Exception:
                pass
        all_tickers = sorted(fallback_tickers)

    if not all_tickers:
        logger.warning("No tickers found at all, skipping.")
        return

    logger.info(f"📈 Fetching prices for {len(all_tickers)} tickers: {sorted(all_tickers)}")
    
    ticker_type_map = {}
    for t in ticker_config.get("stocks", []): ticker_type_map[t] = "stock"
    for t in ticker_config.get("crypto", []): ticker_type_map[t] = "crypto"

    # 2. Batch fetch all prices
    price_results = price_service.fetch_all_portfolio_prices(all_tickers, target_date=today, ticker_type_map=ticker_type_map)
    logger.info(f"  Got {len(price_results)} price results")

    # 3. Get USDT VND rate for crypto conversion
    usdt_result = price_results.get("USDT", {})
    usdt_vnd = usdt_result.get("price", 0) or usdt_result.get("exchangeRate", 0)
    if not usdt_vnd:
        # Try fetching separately
        try:
            r = price_service.get_stablecoin_vnd_rate("USDT")
            usdt_vnd = r.get("price", 0) if r else 0
        except Exception:
            pass
    if not usdt_vnd:
        usdt_vnd = fs.get_global_settings().get("usdt_vnd_default", 26500)
    logger.info(f"  USDT/VNĐ rate: {usdt_vnd:,.0f}")

    # 4. Determine which tickers are crypto (for USD → VND conversion)
    crypto_tickers = set(ticker_config.get("crypto", []))
    stablecoin_tickers = {"USDT", "USDC"}

    # 5. Build system prices dict (ALL prices in VND)
    prices_vnd = {}
    market_update = {}

    for ticker, result in price_results.items():
        raw_price = result.get("price", 0)
        if not raw_price or raw_price <= 0:
            continue

        if ticker in stablecoin_tickers:
            # Stablecoin: raw_price IS the VND rate
            prices_vnd[ticker] = raw_price
            market_update[ticker] = {
                "price": raw_price,
                "exchangeRate": raw_price,
                "date": today,
                "source": result.get("source", "auto"),
            }
        elif ticker == "GOLD":
            sell_price = result.get("sell", 0) or raw_price
            if sell_price > 0:
                prices_vnd[ticker] = sell_price
                market_update[ticker] = {
                    "price": sell_price,
                    "buy": result.get("buy", 0),
                    "sell": sell_price,
                    "date": today,
                    "source": result.get("source", "vang.today"),
                }
        elif ticker in crypto_tickers:
            # Crypto from CoinGecko comes in USD — convert to VND
            price_usd = raw_price
            price_vnd = round(price_usd * usdt_vnd) if usdt_vnd else 0
            if price_vnd > 0:
                prices_vnd[ticker] = price_vnd
                market_update[ticker] = {
                    "price": price_vnd,
                    "price_usd": price_usd,
                    "usdt_vnd_rate": usdt_vnd,
                    "date": today,
                    "source": result.get("source", "CoinGecko"),
                }
        else:
            # Stocks and funds already in VND
            prices_vnd[ticker] = raw_price
            market_update[ticker] = {
                "price": raw_price,
                "date": today,
                "source": result.get("source", "auto"),
            }

    # 6. Save to system daily prices collection (replaces user-scoped)
    if prices_vnd:
        fs.save_system_daily_prices(today, prices_vnd, usdt_vnd)
        logger.info(f"  ✅ Saved {len(prices_vnd)} prices to system/prices/daily/{today}")
    else:
        logger.warning("  ⚠️ No valid prices to save in system daily prices")

    # 7. Update global marketPrices
    if market_update:
        fs.batch_update_market_prices(market_update)
        logger.info(f"  ✅ Updated {len(market_update)} market prices")

    # 8. Get effective market prices for portfolio calculation
    firestore_market_prices = fs.get_market_prices()
    effective_market_prices = dict(firestore_market_prices)
    effective_market_prices.update(market_update)

    # 9. For each user: calculate portfolio snapshot using system prices
    users = _get_all_user_ids()
    for user_info in users:
        uid = user_info["user_id"]
        utype = user_info["user_type"]
        try:
            transactions = fs.get_transactions(uid, utype)
            if not transactions:
                continue

            external_assets = fs.get_external_assets(uid, utype)
            liabilities = fs.get_liabilities(uid, utype)

            holdings = ps.calculate_holdings(transactions)
            portfolio = ps.calculate_portfolio(holdings, effective_market_prices)
            snapshot = ps.generate_snapshot(portfolio, external_assets, liabilities, transactions)

            fs.save_snapshot(uid, utype, today, snapshot)
            logger.info(f"  ✅ User {uid}: snapshot saved (netWorth={snapshot.get('netWorth', 0):,.0f})")
        except Exception as e:
            logger.error(f"  ❌ Error processing user {uid}: {e}", exc_info=True)

    logger.info(f"🕘 === DAILY SCHEDULER DONE === {today}")


def start_scheduler():
    """Start the background scheduler with the daily job."""
    if scheduler.running:
        logger.info("Scheduler already running")
        return

    # Daily at 9:00 AM Vietnam time
    trigger = CronTrigger(hour=9, minute=0, timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        daily_price_snapshot_job,
        trigger=trigger,
        id="daily_price_snapshot",
        name="Daily price fetch + snapshot",
        replace_existing=True,
    )

    scheduler.start()
    next_run = scheduler.get_job("daily_price_snapshot").next_run_time
    logger.info(f"✅ Scheduler started. Next run: {next_run}")


def stop_scheduler():
    """Gracefully stop the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Get current scheduler status."""
    from app.config import settings

    if settings.is_serverless:
        return {
            "running": False,
            "mode": "serverless",
            "next_run": None,
            "timezone": "Asia/Ho_Chi_Minh",
            "schedule": "Managed by external cron (e.g. Google Cloud Scheduler)",
            "trigger_endpoint": "POST /api/scheduler/trigger",
        }

    job = scheduler.get_job("daily_price_snapshot") if scheduler.running else None
    return {
        "running": scheduler.running,
        "mode": "standalone",
        "next_run": str(job.next_run_time) if job else None,
        "timezone": "Asia/Ho_Chi_Minh",
        "schedule": "Daily at 09:00",
    }

