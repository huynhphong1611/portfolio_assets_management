"""Holdings, cash and P&L rules of the portfolio engine (mirrors portfolioCalculator.test.js)."""
import pytest

from app.services import portfolio_service as ps


def tx(date, tx_type, ticker="", qty=0, total=0, asset="Cổ phiếu", storage=""):
    return {
        "date": date, "transactionType": tx_type, "ticker": ticker,
        "assetClass": "Tiền mặt VNĐ" if not ticker else asset,
        "quantity": qty, "totalVND": total, "storage": storage,
    }


def cash_of(holdings):
    return next((h for h in holdings if h["ticker"] == "VNĐ"), None)


def test_moving_average_cost_is_unchanged_by_sales():
    txs = [
        tx("01/01/2026 09:00:00", "Nạp tiền", qty=10_000_000, total=10_000_000),
        tx("02/01/2026 09:00:00", "Mua", "VNM", 100, 6_000_000),
        tx("03/01/2026 09:00:00", "Mua", "VNM", 100, 4_000_000),
        tx("04/01/2026 09:00:00", "Bán", "VNM", -50, 3_500_000),
    ]
    vnm = next(h for h in ps.calculate_holdings(txs) if h["ticker"] == "VNM")
    assert vnm["qty"] == 150
    assert vnm["avgCost"] == pytest.approx(50_000)          # (6M + 4M) / 200, unchanged by the sale
    assert vnm["totalCost"] == pytest.approx(7_500_000)


def test_purchase_without_enough_cash_is_not_floored():
    """A buy larger than the balance must not invent cash (the old floor at 0 did)."""
    txs = [
        tx("01/01/2026 09:00:00", "Nạp tiền", qty=100, total=100),
        tx("02/01/2026 09:00:00", "Mua", "VNM", 1, 150),
    ]
    holdings = ps.calculate_holdings(txs)
    assert cash_of(holdings)["qty"] == -50
    pnl = ps.calculate_total_pnl(ps.calculate_portfolio(holdings, {}), txs)
    assert pnl["totalValue"] == 100          # 150 of stock at cost − 50 overdrawn
    assert pnl["totalPnL"] == 0


def test_buy_recorded_before_its_deposit_reconciles_after_the_deposit():
    txs = [
        tx("03/02/2026 21:40:13", "Mua", "USDT", 350, 9_341_500, asset="Tiền mặt USD"),
        tx("03/02/2026 21:41:49", "Nạp tiền", qty=13_345_000, total=13_345_000),
    ]
    cash = ps.replay_cash(txs)
    assert cash["minBalance"] == -9_341_500
    assert cash["balance"] == 13_345_000 - 9_341_500
    assert cash["netCapital"] == 13_345_000


def test_same_timestamp_deposit_is_booked_before_the_purchase():
    txs = [
        tx("05/02/2026 10:00:00", "Mua", "VNM", 10, 500),
        tx("05/02/2026 10:00:00", "Nạp tiền", qty=500, total=500),
    ]
    assert ps.replay_cash(txs)["minBalance"] == 0


def test_trades_only_log_uses_implicit_capital():
    """No deposits at all: purchases beyond the balance are capital paid in."""
    txs = [
        tx("01/01/2026 09:00:00", "Mua", "VNM", 10, 100),
        tx("02/01/2026 09:00:00", "Cổ tức", "VNM", 10, 5),
        tx("03/01/2026 09:00:00", "Bán", "VNM", -10, 110),
        tx("04/01/2026 09:00:00", "Mua", "FPT", 1, 50),
    ]
    cash = ps.replay_cash(txs)
    assert cash["mode"] == "implicit"
    assert cash["netCapital"] == 100          # the FPT purchase was paid from the proceeds
    holdings = ps.calculate_holdings(txs)
    assert cash_of(holdings)["qty"] == 65      # 5 + 110 − 50
    pnl = ps.calculate_total_pnl(ps.calculate_portfolio(holdings, {}), txs)
    assert pnl["totalPnL"] == 15               # 10 realized + 5 dividend


def test_oversold_position_closes_at_zero():
    txs = [
        tx("01/01/2026 09:00:00", "Nạp tiền", qty=1000, total=1000),
        tx("02/01/2026 09:00:00", "Mua", "USDT", 10, 260, asset="Tiền mặt USD"),
        tx("03/01/2026 09:00:00", "Bán", "USDT", -12, 312, asset="Tiền mặt USD"),
        tx("04/01/2026 09:00:00", "Mua", "USDT", 5, 130, asset="Tiền mặt USD"),
    ]
    usdt = next(h for h in ps.calculate_holdings(txs) if h["ticker"] == "USDT")
    assert usdt["qty"] == 5
    assert usdt["avgCost"] == 26


def test_withdrawing_more_than_deposited_keeps_the_profit():
    txs = [
        tx("01/01/2026 09:00:00", "Nạp tiền", qty=100, total=100),
        tx("02/01/2026 09:00:00", "Mua", "VNM", 1, 100),
        tx("03/01/2026 09:00:00", "Bán", "VNM", -1, 300),
        tx("04/01/2026 09:00:00", "Rút tiền", qty=200, total=200),
    ]
    holdings = ps.calculate_holdings(txs)
    pnl = ps.calculate_total_pnl(ps.calculate_portfolio(holdings, {}), txs)
    assert pnl["totalCost"] == -100
    assert pnl["totalValue"] == 100
    assert pnl["totalPnL"] == 200
    assert pnl["totalPnLPercent"] == 0


def test_deposit_rows_always_move_vnd_cash():
    txs = [{"date": "01/01/2026 09:00:00", "transactionType": "Nạp tiền", "ticker": "USDT",
            "assetClass": "Tiền mặt USD", "quantity": 2_600_000, "totalVND": 2_600_000}]
    holdings = ps.calculate_holdings(txs)
    assert [h["ticker"] for h in holdings] == ["VNĐ"]
    assert cash_of(holdings)["qty"] == 2_600_000
    assert ps.calculate_total_pnl(ps.calculate_portfolio(holdings, {}), txs)["totalPnL"] == 0


def test_stablecoin_without_price_falls_back_to_rate_then_cost():
    holdings = [
        {"ticker": "USDT", "assetClass": "Tiền mặt USD", "qty": 10, "totalCost": 260_000, "avgCost": 26_000},
        {"ticker": "USDC", "assetClass": "Tiền mặt USD", "qty": 10, "totalCost": 250_000, "avgCost": 25_000},
    ]
    at_cost = {p["ticker"]: p for p in ps.calculate_portfolio(holdings, {})}
    assert at_cost["USDT"]["actualValue"] == 260_000
    assert at_cost["USDC"]["actualValue"] == 250_000
    with_usdt = {p["ticker"]: p for p in ps.calculate_portfolio(holdings, {"USDT": {"exchangeRate": 26_500}})}
    assert with_usdt["USDT"]["marketPrice"] == 26_500
    assert with_usdt["USDC"]["marketPrice"] == 26_500
