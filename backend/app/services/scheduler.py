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
    For each user: fetch prices, save daily prices, update market, create snapshot.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    logger.info(f"🕘 === DAILY SCHEDULER START === {today}")

    users = _get_all_user_ids()
    if not users:
        logger.warning("No users found, skipping scheduler run.")
        return

    logger.info(f"Found {len(users)} users to process")

    # Collect all unique tickers across all users
    all_tickers = set()
    user_tickers_map = {}

    for user_info in users:
        uid = user_info["user_id"]
        utype = user_info["user_type"]
        try:
            transactions = fs.get_transactions(uid, utype)
            tickers = _extract_tickers(transactions)
            user_tickers_map[(uid, utype)] = tickers
            all_tickers.update(tickers)
            logger.info(f"  User {uid} ({utype}): {len(tickers)} tickers: {tickers}")
        except Exception as e:
            logger.error(f"  Error fetching transactions for {uid}: {e}")

    if not all_tickers:
        logger.warning("No tickers found across all users, skipping.")
        return

    # Batch fetch all prices once
    logger.info(f"📈 Fetching prices for {len(all_tickers)} tickers: {sorted(all_tickers)}")
    price_results = price_service.fetch_all_portfolio_prices(sorted(all_tickers), today)
    logger.info(f"  Got {len(price_results)} price results")

    # Update global market prices
    market_update = {}
    stablecoin_tickers = {"USDT", "USDC"}
    for ticker, result in price_results.items():
        if ticker in stablecoin_tickers:
            # Stablecoins: price=1 (in USD), exchangeRate=VND rate
            market_update[ticker] = {
                "price": 1,
                "exchangeRate": result.get("price", 1),
                "date": today,
                "source": result.get("source", "auto"),
            }
        elif ticker == "GOLD":
            # Gold SJC: price in VND per lượng
            market_update[ticker] = {
                "price": result.get("price", 0),
                "buy": result.get("buy", 0),
                "sell": result.get("sell", 0),
                "date": today,
                "source": result.get("source", "vang.today"),
            }
        else:
            market_update[ticker] = {
                "price": result.get("price", 0),
                "date": today,
                "source": result.get("source", "auto"),
            }

    if market_update:
        fs.batch_update_market_prices(market_update)
        logger.info(f"  ✅ Updated {len(market_update)} market prices")

    # Get updated market prices for portfolio calculations
    market_prices = fs.get_market_prices()

    # For each user: save daily prices + snapshot
    for user_info in users:
        uid = user_info["user_id"]
        utype = user_info["user_type"]

        try:
            tickers = user_tickers_map.get((uid, utype), [])
            if not tickers:
                continue

            # Build daily prices dict for this user
            daily_prices_dict = {}
            for ticker in tickers:
                if ticker in price_results:
                    daily_prices_dict[ticker] = price_results[ticker].get("price", 0)
                else:
                    # Fallback to latest known market price if API fetch failed
                    last_known = market_prices.get(ticker, {})
                    fallback_price = last_known.get("exchangeRate") or last_known.get("price", 0)
                    daily_prices_dict[ticker] = fallback_price
                    logger.warning(f"  ⚠️ User {uid}: API fetch failed for {ticker}, using fallback: {fallback_price}")

            # Save daily prices
            if daily_prices_dict:
                fs.save_daily_prices(uid, utype, today, daily_prices_dict)
                logger.info(f"  ✅ User {uid}: saved {len(daily_prices_dict)} daily prices")

            # Calculate portfolio and generate snapshot
            transactions = fs.get_transactions(uid, utype)
            external_assets = fs.get_external_assets(uid, utype)
            liabilities = fs.get_liabilities(uid, utype)
            funds = fs.get_funds(uid, utype)

            holdings = ps.calculate_holdings(transactions)
            portfolio = ps.calculate_portfolio(holdings, market_prices)
            snapshot = ps.generate_snapshot(portfolio, external_assets, liabilities, funds)

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

