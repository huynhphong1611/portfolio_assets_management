"""
Snapshots router — Daily net worth snapshots.
"""
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models.schemas import SnapshotCreate, APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs
from app.services import portfolio_service as ps

logger = logging.getLogger("snapshots")

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


@router.get("", response_model=APIResponse)
async def list_snapshots(user: dict = Depends(get_current_user)):
    """List all daily snapshots (ordered by date asc)."""
    data = fs.get_snapshots(user["sub"], user["type"])
    return APIResponse(data=data)


@router.post("", response_model=APIResponse)
async def save_snapshot(snapshot: SnapshotCreate,
                        user: dict = Depends(get_current_user)):
    """Save or update daily snapshot for a date."""
    fs.save_snapshot(user["sub"], user["type"],
                     snapshot.date, snapshot.model_dump())
    return APIResponse(data={"saved": snapshot.date})


# ── Historical Backfill ───────────────────────────────────────────────────────

class BackfillRequest(BaseModel):
    start_date: str                  # YYYY-MM-DD
    end_date: Optional[str] = None   # YYYY-MM-DD, defaults to start_date (single day)
    overwrite: bool = True           # overwrite existing snapshots for the date range


@router.post("/backfill", response_model=APIResponse)
async def backfill_snapshots(
    req: BackfillRequest,
    user: dict = Depends(get_current_user),
):
    """
    Reconstruct historical snapshots for a date range.

    For each date in [start_date, end_date]:
      1. Filter transactions to only those on or before the date.
      2. Replay holdings calculation as of that date.
      3. Look up system daily prices for that date (fallback: current marketPrices).
      4. Save the resulting snapshot.

    This allows users to fill gaps in their historical performance chart.
    """
    uid   = user["sub"]
    utype = user["type"]

    # Validate and build date range
    try:
        d_start = datetime.strptime(req.start_date, "%Y-%m-%d").date()
        d_end   = datetime.strptime(req.end_date or req.start_date, "%Y-%m-%d").date()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

    if d_start > d_end:
        raise HTTPException(status_code=400, detail="start_date must be ≤ end_date")

    today = datetime.now().date()
    if d_end > today:
        raise HTTPException(status_code=400, detail="end_date cannot be in the future")

    # Load all user data once
    all_transactions  = fs.get_transactions(uid, utype)
    all_external      = fs.get_external_assets(uid, utype)
    all_liabilities   = fs.get_liabilities(uid, utype)

    # Current market prices as ultimate fallback
    current_market_prices = fs.get_market_prices()

    saved_dates  = []
    skipped_dates = []

    from datetime import timedelta

    cur = d_start
    while cur <= d_end:
        date_str = cur.isoformat()

        # Skip if snapshot already exists and overwrite=False
        if not req.overwrite:
            existing = fs.get_snapshot_by_date(uid, utype, date_str)
            if existing:
                skipped_dates.append(date_str)
                cur += timedelta(days=1)
                continue

        # 1. Filter transactions up to and including target date
        txs_as_of = [
            t for t in all_transactions
            if _tx_date_str(t) <= date_str
        ]

        if not txs_as_of:
            cur += timedelta(days=1)
            continue
        
        # Calculate holdings early so we know which tickers we need
        holdings = ps.calculate_holdings(txs_as_of)

        # 2. Resolve prices for the target date
        #    Priority: system daily prices for date → API fetch → current marketPrices
        system_prices_doc = fs.get_system_daily_prices(date_str)
        if system_prices_doc and system_prices_doc.get("prices"):
            raw_prices = system_prices_doc["prices"]     # {ticker: price_vnd}
            usdt_vnd   = system_prices_doc.get("usdt_vnd_rate", 0)

            # Build market_prices dict compatible with calculate_portfolio
            market_prices = {}
            for ticker, price_vnd in raw_prices.items():
                if ticker in {"USDT", "USDC"}:
                    market_prices[ticker] = {
                        "price": price_vnd,
                        "exchangeRate": price_vnd,
                    }
                else:
                    market_prices[ticker] = {"price": price_vnd}
        else:
            logger.info(f"  No system prices for {date_str}, fetching from API...")
            ticker_config = fs.get_supported_tickers()
            all_tickers = (
                ticker_config.get("stocks", []) +
                ticker_config.get("crypto", []) +
                ticker_config.get("funds", [])
            )
            ticker_type_map = {}
            for t in ticker_config.get("stocks", []): ticker_type_map[t] = "stock"
            for t in ticker_config.get("crypto", []): ticker_type_map[t] = "crypto"
            for t in ticker_config.get("funds", []): ticker_type_map[t] = "fund"
            
            # Ensure all tickers from user's holdings are included
            for h in holdings:
                ticker = h.get("ticker")
                if ticker and ticker not in all_tickers and ticker != "VNĐ":
                    all_tickers.append(ticker)

            from app.services import price_service
            results = price_service.fetch_all_portfolio_prices(all_tickers, target_date=date_str, ticker_type_map=ticker_type_map)
            
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
            
            # Save fetched prices for future use
            if prices_vnd:
                fs.save_system_daily_prices(date_str, prices_vnd, usdt_vnd)

            market_prices = {}
            for ticker, price_vnd in prices_vnd.items():
                if ticker in {"USDT", "USDC"}:
                    market_prices[ticker] = {
                        "price": price_vnd,
                        "exchangeRate": price_vnd,
                    }
                else:
                    market_prices[ticker] = {"price": price_vnd}

            # Fallback to current market prices for missing ones
            for ticker, current_price in current_market_prices.items():
                if ticker not in market_prices:
                    market_prices[ticker] = current_price
                    logger.warning(f"  Missing API price for {ticker} at {date_str}, fallback to current")

        # 3. Calculate portfolio as of that date
        portfolio = ps.calculate_portfolio(holdings, market_prices)
        snapshot  = ps.generate_snapshot(portfolio, all_external, all_liabilities, txs_as_of)

        # 4. Save
        fs.save_snapshot(uid, utype, date_str, snapshot)
        saved_dates.append(date_str)
        logger.info(f"  ✅ Backfill {uid} @ {date_str}: netWorth={snapshot.get('netWorth', 0):,.0f}")

        cur += timedelta(days=1)

    return APIResponse(data={
        "saved":   saved_dates,
        "skipped": skipped_dates,
        "total":   len(saved_dates),
    })


def _tx_date_str(tx: dict) -> str:
    """Normalise transaction date to YYYY-MM-DD for comparison."""
    raw = tx.get("date", "")
    if not raw:
        return "1970-01-01"
    # Vietnamese format: dd/MM/yyyy or dd/MM/yyyy HH:mm:ss
    if "/" in raw:
        try:
            parts = raw.split(" ")[0].split("/")
            if len(parts) == 3:
                return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        except (IndexError, ValueError):
            pass
    # ISO format already
    return raw[:10]

