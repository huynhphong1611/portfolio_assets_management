"""
Dashboard router — Aggregated portfolio data computed server-side.
"""
from fastapi import APIRouter, Depends

from app.models.schemas import APIResponse
from app.routers.auth import get_current_user
from app.services import firestore_service as fs
from app.services import portfolio_service as ps

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=APIResponse)
async def get_dashboard(user: dict = Depends(get_current_user)):
    """
    Get fully computed dashboard data:
    - holdings, portfolio (with market prices), netWorth, pnlSummary, rebalanceData
    """
    user_id = user["sub"]
    user_type = user["type"]

    # Fetch raw data from Firestore
    transactions = fs.get_transactions(user_id, user_type)
    external_assets = fs.get_external_assets(user_id, user_type)
    liabilities = fs.get_liabilities(user_id, user_type)
    market_prices = fs.get_market_prices()
    rebalance_targets = fs.get_rebalance_targets(user_id, user_type)
    funds = fs.get_funds(user_id, user_type)

    # Calculate
    holdings = ps.calculate_holdings(transactions)
    portfolio = ps.calculate_portfolio(holdings, market_prices)
    net_worth = ps.calculate_net_worth(portfolio, external_assets, liabilities)
    pnl_summary = ps.calculate_total_pnl(portfolio)
    rebalance_data = ps.calculate_rebalance(portfolio, rebalance_targets)

    return APIResponse(data={
        "holdings": holdings,
        "portfolio": portfolio,
        "netWorth": net_worth,
        "pnlSummary": pnl_summary,
        "rebalanceData": rebalance_data,
    })
