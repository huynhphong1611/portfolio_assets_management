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

    # Update global market prices — only update if we got a valid (non-zero) price
    # to avoid overwriting good prices with 0 from failed API calls.
    market_update = {}
    stablecoin_tickers = {"USDT", "USDC"}
    for ticker, result in price_results.items():
        fetched_price = result.get("price", 0)

        if ticker in stablecoin_tickers:
            vnd_rate = fetched_price  # price field = VND exchange rate for stablecoins
            if not vnd_rate or vnd_rate <= 0:
                logger.warning(f"  ⚠️ Skipping market update for {ticker}: invalid VND rate={vnd_rate}")
                continue
            # Stablecoins: price=1 (in USD), exchangeRate=VND rate
            market_update[ticker] = {
                "price": 1,
                "exchangeRate": vnd_rate,
                "date": today,
                "source": result.get("source", "auto"),
            }
        elif ticker == "GOLD":
            sell_price = result.get("sell", 0) or fetched_price
            if not sell_price or sell_price <= 0:
                logger.warning(f"  ⚠️ Skipping market update for GOLD: invalid price={sell_price}")
                continue
            # Gold SJC: price in VND per lượng
            market_update[ticker] = {
                "price": sell_price,
                "buy": result.get("buy", 0),
                "sell": sell_price,
                "date": today,
                "source": result.get("source", "vang.today"),
            }
        else:
            if not fetched_price or fetched_price <= 0:
                logger.warning(f"  ⚠️ Skipping market update for {ticker}: invalid price={fetched_price}")
                continue
            market_update[ticker] = {
                "price": fetched_price,
                "date": today,
                "source": result.get("source", "auto"),
            }

    if market_update:
        fs.batch_update_market_prices(market_update)
        logger.info(f"  ✅ Updated {len(market_update)} market prices ({len(price_results) - len(market_update)} skipped due to invalid prices)")
    else:
        logger.warning("  ⚠️ No valid prices to update in market — all API fetches may have failed!")

    # Get Firestore market prices (may still have stale/corrupt values for failed tickers)
    firestore_market_prices = fs.get_market_prices()

    # Build effective_market_prices = Firestore data, OVERLAID with fresh valid API results.
    # This ensures calculate_portfolio always uses the freshest correct price available,
    # even if Firestore was previously corrupted with 0s from past failed runs.
    effective_market_prices = dict(firestore_market_prices)
    for ticker, data in market_update.items():
        effective_market_prices[ticker] = data
    logger.info(f"  📊 Effective market prices built: {len(effective_market_prices)} tickers")

    # For each user: save daily prices + snapshot
    for user_info in users:
        uid = user_info["user_id"]
        utype = user_info["user_type"]

        try:
            tickers = user_tickers_map.get((uid, utype), [])
            if not tickers:
                continue

            # Fetch yesterday's daily prices as the primary fallback source.
            # "'Giá tốt'" = giá ngày hôm trước — not marketPrices which may be corrupt with 0s.
            prev_daily = fs.get_latest_daily_prices(uid, utype)
            prev_prices_map = {}
            if prev_daily and isinstance(prev_daily.get("prices"), list):
                for entry in prev_daily["prices"]:
                    t = entry.get("ticker") or entry.get("symbol", "")
                    p = entry.get("price", 0)
                    if t and p and p > 0:
                        prev_prices_map[t] = p
                logger.info(f"  📅 User {uid}: loaded {len(prev_prices_map)} prices from prev day ({prev_daily.get('date', '?')})")
            else:
                logger.info(f"  📅 User {uid}: no previous daily prices found, fallback chain: marketPrices (Firestore) only")

            # Build daily prices list for this user.
            # Priority: (1) fresh API price  →  (2) yesterday’s dailyPrice  →  (3) Firestore marketPrices
            daily_prices_list = []
            for ticker in tickers:
                raw_price = price_results.get(ticker, {}).get("price", 0)

                if raw_price and raw_price > 0:
                    # ✅ Fresh API price available
                    daily_prices_list.append({"ticker": ticker, "price": raw_price})
                else:
                    # ❌ API failed or returned 0 — use yesterday's price as first fallback
                    fallback_price = prev_prices_map.get(ticker, 0)

                    if fallback_price and fallback_price > 0:
                        prev_date = prev_daily.get("date", "?") if prev_daily else "?"
                        fallback_source = f"prev_daily ({prev_date})"
                    else:
                        # Last resort: Firestore marketPrices (may be stale but still > 0)
                        mkt = firestore_market_prices.get(ticker, {})
                        fallback_price = mkt.get("exchangeRate") or mkt.get("price", 0)
                        fallback_source = "marketPrices (Firestore)" if fallback_price else "none"

                    if fallback_price and fallback_price > 0:
                        daily_prices_list.append({"ticker": ticker, "price": fallback_price})
                        logger.warning(
                            f"  ⚠️ User {uid}: API failed for {ticker} "
                            f"(got {raw_price}), fallback → {fallback_source}: {fallback_price}"
                        )
                    else:
                        logger.error(
                            f"  ❌ User {uid}: No price available for {ticker} "
                            f"(API=0, yesterday=0, Firestore=0) — skipping ticker in daily prices"
                        )

            # Save daily prices
            if daily_prices_list:
                fs.save_daily_prices(uid, utype, today, daily_prices_list)
                logger.info(f"  ✅ User {uid}: saved {len(daily_prices_list)} daily prices")

            # Calculate portfolio and snapshot.
            # IMPORTANT: effective_market_prices from global scope might STILL have 0s 
            # if the API failed today AND the Firestore already had 0s from yesterday.
            # We MUST overlay the safely recovered per-user daily_prices_list onto it
            # so calculate_portfolio absolutely never receives a 0.
            user_effective_prices = dict(effective_market_prices)
            for dp in daily_prices_list:
                t = dp["ticker"]
                p = dp["price"]
                if t in {"USDT", "USDC"}:
                    user_effective_prices[t] = {"price": 1, "exchangeRate": p}
                else:
                    user_effective_prices[t] = {"price": p}

            transactions = fs.get_transactions(uid, utype)
            external_assets = fs.get_external_assets(uid, utype)
            liabilities = fs.get_liabilities(uid, utype)
            funds = fs.get_funds(uid, utype)

            holdings = ps.calculate_holdings(transactions)
            portfolio = ps.calculate_portfolio(holdings, user_effective_prices)
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

