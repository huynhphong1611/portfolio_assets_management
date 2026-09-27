from app.services import portfolio_service as ps

SYSTEM = {"VNM": {"price": 70000}, "USDT": {"price": 25500, "exchangeRate": 25500}}
SECURITIES = [{"ticker": "NHAN9999", "feed": "MANUAL"}, {"ticker": "VNM", "feed": "AUTO"},
              {"ticker": "USDT", "feed": "MANUAL"}]
USER = {
    "NHAN9999": {"2026-09-01": 8_400_000, "2026-09-20": 8_450_000, "2026-10-01": 9_000_000},
    "VNM": {"2026-09-20": 71000},
    "FPT": {"2026-09-10": 120000},
    "USDT": {"2026-09-01": 26000},
}


def test_latest_price_on_or_before():
    assert ps.latest_price_on_or_before(USER["NHAN9999"], "2026-09-27") == ("2026-09-20", 8_450_000)
    assert ps.latest_price_on_or_before(USER["NHAN9999"], "2026-08-01") == (None, None)


def test_manual_feed_wins_and_auto_only_fills_gaps():
    prices = ps.apply_user_prices(SYSTEM, SECURITIES, USER, "2026-09-27")
    assert prices["NHAN9999"] == {"price": 8_450_000, "date": "2026-09-20", "source": "user"}
    assert prices["VNM"] == {"price": 70000}                       # AUTO: system price kept
    assert prices["FPT"]["price"] == 120000                         # no security doc = AUTO, system has no price
    assert prices["USDT"]["exchangeRate"] == 26000                   # stablecoins keep the rate field
    assert SYSTEM["VNM"] == {"price": 70000}                        # input not mutated


def test_overlay_can_be_limited_to_holdings():
    prices = ps.apply_user_prices({}, SECURITIES, USER, "2026-09-27", tickers=["NHAN9999"])
    assert set(prices) == {"NHAN9999"}


def test_auto_priced_tickers_skip_user_priced_securities():
    txs = [{"ticker": "VNM"}, {"ticker": "NHAN9999"}, {"ticker": ""}, {"ticker": "VNĐ"}, {"ticker": "fpt"}]
    secs = [{"ticker": "NHAN9999", "feed": "MANUAL"}, {"ticker": "GOLDJSON", "feed": "GENERIC-JSON"},
            {"ticker": "ETF1", "feed": "AUTO"}]
    assert ps.auto_priced_tickers(txs, secs) == ["ETF1", "FPT", "VNM"]
