"""
Portfolio Calculator Engine v4 — Python port of portfolioCalculator.js.

Securities — moving average cost:
  - Mua  qty += q, cost += amount, avgCost = cost / qty
  - Bán  cost −= avgCost × q, qty −= q (a sale larger than the position closes it)

Cash (the VNĐ deposit account) — see replay_cash():
  - Nạp tiền  → cash ↑, net capital ↑
  - Rút tiền  → cash ↓, net capital ↓
  - Mua       → cash ↓ (capital unchanged)
  - Bán       → cash ↑ (capital unchanged)
  - Cổ tức    → cash ↑ (earnings: dividend / interest; capital unchanged)
Total P&L = all holdings at market − net capital

Handles: Holdings, Portfolio valuation, Net Worth, Rebalance, P&L, Snapshot generation.
"""
from datetime import datetime


# ── Asset Class Mapping ──

ASSET_CLASS_GROUPS = {
    "Tiền mặt VNĐ": "Thanh khoản",
    "Tiền mặt USD": "Thanh khoản",
    "Trái phiếu": "Đầu tư",
    "Cổ phiếu": "Đầu tư",
    "Tài sản mã hóa": "Đầu tư",
    "Vàng": "Đầu tư",
}

ASSET_CLASS_LABELS = {
    "Tiền mặt VNĐ": "Tiền mặt VNĐ",
    "Tiền mặt USD": "Tiền mặt USD (USDT)",
    "Trái phiếu": "Trái phiếu / CCQ TP",
    "Cổ phiếu": "Cổ phiếu / CCQ CP",
    "Tài sản mã hóa": "Crypto",
    "Vàng": "Vàng đầu tư",
}


def parse_vietnamese_date(date_str: str) -> datetime:
    """Parse Vietnamese date format 'dd/MM/yyyy HH:mm:ss' to datetime."""
    if not date_str:
        return datetime(1970, 1, 1)
    try:
        parts = date_str.split(' ')
        date_parts = parts[0].split('/')
        time_parts = (parts[1] if len(parts) > 1 else '00:00:00').split(':')
        if len(date_parts) == 3:
            return datetime(
                int(date_parts[2]), int(date_parts[1]), int(date_parts[0]),
                int(time_parts[0] if time_parts else 0),
                int(time_parts[1] if len(time_parts) > 1 else 0),
                int(time_parts[2] if len(time_parts) > 2 else 0),
            )
    except (ValueError, IndexError):
        pass
    try:
        return datetime.fromisoformat(date_str)
    except ValueError:
        return datetime(1970, 1, 1)


EPS = 1e-4
DEPOSIT, REMOVAL, BUY, SELL, EARNINGS = "Nạp tiền", "Rút tiền", "Mua", "Bán", "Cổ tức"
_SAME_TIME_RANK = {DEPOSIT: 0, REMOVAL: 2}
STABLECOINS = {"USDT", "USDC"}


def _is_cash_ticker(ticker) -> bool:
    return not ticker or ticker == "VNĐ"


def _num(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def sort_transactions(transactions: list | None) -> list:
    """
    Chronological order used by every engine (mirrors JS sortTransactions()).
    Rows with the same timestamp keep their order, except that deposits come
    first and removals last.
    """
    keyed = [
        (parse_vietnamese_date(t.get("date", "")), _SAME_TIME_RANK.get(t.get("transactionType"), 1), i, t)
        for i, t in enumerate(transactions or []) if t
    ]
    keyed.sort(key=lambda k: (k[0], k[1], k[2]))
    return [k[3] for k in keyed]


def replay_cash(transactions: list | None) -> dict:
    """
    Replay of the VNĐ deposit account (mirrors JS replayCash()).

    tracked   the log has deposits / removals: every purchase debits and every
              sale credits the account in full; the balance may go negative
              (a purchase recorded before, or without, the deposit paying for it).
    implicit  no deposits / removals at all (trades-only import): proceeds and
              earnings pay for later purchases; whatever a purchase needs beyond
              the balance counts as capital paid in (implicit deposit).
    """
    sorted_txs = sort_transactions(transactions)
    mode = "tracked" if any(t.get("transactionType") in (DEPOSIT, REMOVAL) for t in sorted_txs) else "implicit"
    balance = deposits = removals = implicit = earnings = min_balance = 0.0
    moves = 0
    storage = None

    for tx in sorted_txs:
        tx_type = tx.get("transactionType", "")
        cash_row = _is_cash_ticker((tx.get("ticker") or "").strip())
        amount = abs(_num(tx.get("totalVND")))
        cash_amount = abs(_num(tx.get("totalVND")) or _num(tx.get("quantity")))
        delta = None

        if tx_type in (DEPOSIT, REMOVAL):
            if tx_type == DEPOSIT:
                deposits += cash_amount
                delta = cash_amount
            else:
                removals += cash_amount
                delta = -cash_amount
            if storage is None:
                storage = tx.get("storage") or ""
        elif tx_type == EARNINGS:
            delta = cash_amount if cash_row else amount
            earnings += delta
        elif cash_row:
            continue
        elif tx_type == BUY:
            shortfall = amount - balance
            if mode == "implicit" and shortfall > 0:
                implicit += shortfall
                balance += shortfall
            delta = -amount
        elif tx_type == SELL:
            delta = amount

        if delta is None:
            continue
        moves += 1
        balance += delta
        min_balance = min(min_balance, balance)

    return {
        "mode": mode, "balance": balance, "netCapital": deposits - removals + implicit,
        "deposits": deposits, "removals": removals, "implicitDeposits": implicit,
        "earnings": earnings, "minBalance": min_balance, "moves": moves, "storage": storage or "",
    }


def calculate_holdings(transactions: list) -> list:
    """
    Current holdings (mirrors JS calculateHoldings()): one row per security at
    moving average cost, plus the VNĐ row whose qty is the cash balance and
    totalCost the net capital.
    """
    if not transactions:
        return []

    holdings_map = {}
    for tx in sort_transactions(transactions):
        ticker = (tx.get("ticker") or "").strip()
        tx_type = tx.get("transactionType", "")
        if _is_cash_ticker(ticker) or tx_type not in (BUY, SELL):
            continue

        storage = tx.get("storage", "")
        if ticker not in holdings_map:
            holdings_map[ticker] = {
                "ticker": ticker, "assetClass": tx.get("assetClass") or "Khác",
                "qty": 0.0, "totalCost": 0.0, "avgCost": 0.0,
                "storage": storage or "", "currency": tx.get("currency") or "VNĐ",
            }
        entry = holdings_map[ticker]
        qty = abs(_num(tx.get("quantity")))
        cost = abs(_num(tx.get("totalVND")))

        if tx_type == BUY:
            entry["totalCost"] += cost
            entry["qty"] += qty
            entry["avgCost"] = entry["totalCost"] / entry["qty"] if entry["qty"] > 0 else 0
            if storage:
                entry["storage"] = storage
        else:
            sold = min(qty, entry["qty"])
            entry["totalCost"] -= entry["avgCost"] * sold
            entry["qty"] -= sold
            if entry["qty"] <= EPS:
                entry["qty"] = entry["totalCost"] = entry["avgCost"] = 0.0

    result = []
    cash = replay_cash(transactions)
    if cash["moves"] and (abs(cash["balance"]) > EPS or abs(cash["netCapital"]) > EPS):
        result.append({
            "ticker": "VNĐ", "assetClass": "Tiền mặt VNĐ",
            "qty": cash["balance"], "totalCost": cash["netCapital"], "avgCost": 1,
            "storage": cash["storage"], "currency": "VNĐ",
        })
    for h in holdings_map.values():
        if h["qty"] > EPS:
            h["avgCost"] = h["totalCost"] / h["qty"]
            result.append(h)
    return result


def calculate_portfolio(holdings: list, market_prices: dict = None) -> list:
    """
    Value every holding (mirrors JS calculatePortfolio()). Prices are VND per
    unit; without a market price a holding is valued at its average cost, a
    stablecoin at its exchange rate, then the USDT rate, then its average cost.
    """
    if market_prices is None:
        market_prices = {}

    usdt_data = market_prices.get("USDT") or {}
    usdt_rate = usdt_data.get("price") or usdt_data.get("exchangeRate") or 0

    result = []
    for h in holdings:
        market = market_prices.get(h["ticker"]) or {}
        if h["ticker"] == "VNĐ":
            market_price = 1
        elif h["ticker"] in STABLECOINS:
            market_price = market.get("price") or market.get("exchangeRate") or usdt_rate or h["avgCost"]
        else:
            market_price = market.get("price") or h["avgCost"]
        actual_value = h["qty"] * market_price

        pnl = actual_value - h["totalCost"]
        pnl_percent = (pnl / h["totalCost"]) * 100 if h["totalCost"] > 0 else 0

        result.append({
            "ticker": h["ticker"],
            "assetClass": h["assetClass"],
            "qty": h["qty"],
            "avgCost": h["avgCost"],
            "marketPrice": market_price,
            "totalCost": h["totalCost"],
            "actualValue": actual_value,
            "pnl": pnl,
            "pnlPercent": pnl_percent,
            "storage": h.get("storage", ""),
            "currency": h.get("currency", "VNĐ"),
        })
    return result


def calculate_net_worth(portfolio: list, external_assets: list = None,
                        liabilities: list = None) -> dict:
    """
    Calculate net worth from portfolio, external assets, and liabilities.
    Equivalent to JS calculateNetWorth().
    """
    if external_assets is None:
        external_assets = []
    if liabilities is None:
        liabilities = []

    liquid_assets = []
    invest_assets = []

    for item in portfolio:
        group = ASSET_CLASS_GROUPS.get(item.get("assetClass"), "Đầu tư")
        entry = {
            "id": f"portfolio_{item['ticker']}",
            "name": f"{item['ticker']} ({ASSET_CLASS_LABELS.get(item['assetClass'], item['assetClass'])})",
            "value": item.get("actualValue", 0),
            "source": "portfolio",
        }
        if group == "Thanh khoản":
            liquid_assets.append(entry)
        else:
            invest_assets.append(entry)

    for ext in external_assets:
        entry = {
            "id": f"external_{ext.get('id', '')}",
            "name": ext.get("name", ""),
            "value": ext.get("value", 0),
            "source": "external",
        }
        if ext.get("group") == "Thanh khoản":
            liquid_assets.append(entry)
        else:
            invest_assets.append(entry)

    total_liquid = sum(a["value"] for a in liquid_assets)
    total_invest = sum(a["value"] for a in invest_assets)
    total_assets = total_liquid + total_invest
    total_liabilities = sum(float(l.get("amount", 0) or 0) for l in liabilities)
    total_net_worth = total_assets - total_liabilities

    return {
        "liquidAssets": sorted(liquid_assets, key=lambda a: a["value"], reverse=True),
        "investAssets": sorted(invest_assets, key=lambda a: a["value"], reverse=True),
        "totalLiquid": total_liquid,
        "totalInvest": total_invest,
        "totalAssets": total_assets,
        "totalLiabilities": total_liabilities,
        "totalNetWorth": total_net_worth,
    }


def calculate_rebalance(portfolio: list, target_weights: dict = None) -> list:
    """
    Calculate rebalance recommendations.
    Equivalent to JS calculateRebalance().
    """
    if target_weights is None:
        target_weights = {}

    asset_class_totals = {}
    total_invest_value = 0

    for item in portfolio:
        cls = item.get("assetClass", "")
        asset_class_totals[cls] = asset_class_totals.get(cls, 0) + item.get("actualValue", 0)
        total_invest_value += item.get("actualValue", 0)

    all_classes = set(list(asset_class_totals.keys()) + list(target_weights.keys()))
    rebalance_data = []

    for cls in all_classes:
        actual_value = asset_class_totals.get(cls, 0)
        actual_weight = (actual_value / total_invest_value * 100) if total_invest_value > 0 else 0
        target_weight = float(target_weights.get(cls, 0))
        variance = actual_weight - target_weight

        if abs(variance) <= 2:
            action = {"text": "GIỮ NGUYÊN", "type": "hold"}
        elif variance < -2:
            action = {"text": "MUA THÊM", "type": "buy"}
        else:
            action = {"text": "BÁN BỚT", "type": "sell"}

        rebalance_data.append({
            "assetClass": cls,
            "label": ASSET_CLASS_LABELS.get(cls, cls),
            "actualValue": actual_value,
            "actualWeight": actual_weight,
            "targetWeight": target_weight,
            "variance": variance,
            "action": action,
        })

    return sorted(rebalance_data, key=lambda x: x["actualValue"], reverse=True)


def calculate_total_pnl(portfolio: list, transactions: list = None) -> dict:
    """
    Total P&L = total current value (all assets + cash) − net capital.
    Mirrors JS calculateTotalPnL().

    Net capital comes from the cash replay of the log (deposits − removals, or
    the implicit deposits of a trades-only log). It may be ≤ 0 after withdrawing
    more than was paid in: the P&L stays value − capital, the % is then 0.
    Without transactions: the cash row's net capital, else the cost basis.
    """
    total_value = sum(p.get("actualValue", 0) or 0 for p in portfolio)

    cash_item = next((p for p in portfolio if p.get("ticker") == "VNĐ"), None)
    if transactions:
        net_capital = replay_cash(transactions)["netCapital"]
    elif cash_item:
        net_capital = cash_item.get("totalCost", 0)
    else:
        net_capital = sum(p.get("totalCost", 0) for p in portfolio)

    total_pnl = total_value - net_capital
    total_pnl_percent = (total_pnl / net_capital * 100) if net_capital > 0 else 0

    return {
        "totalValue": total_value,
        "totalCost": net_capital,
        "totalPnL": total_pnl,
        "totalPnLPercent": total_pnl_percent,
    }


def generate_snapshot(portfolio: list, external_assets: list,
                      liabilities: list, transactions: list = None) -> dict:
    """
    Generate a daily snapshot of the portfolio state.
    Mirrors JS generateSnapshot().
    """
    pnl = calculate_total_pnl(portfolio, transactions or [])
    nw  = calculate_net_worth(portfolio, external_assets, liabilities)

    # Asset class breakdown for historical allocation chart
    class_map = {}
    for item in portfolio:
        cls = item.get("assetClass", "Khác")
        class_map[cls] = class_map.get(cls, 0) + item.get("actualValue", 0)

    return {
        "totalAssets": nw["totalAssets"],
        "totalLiabilities": nw["totalLiabilities"],
        "netWorth": nw["totalNetWorth"],
        "portfolioValue": pnl["totalValue"],
        "portfolioCost": pnl["totalCost"],
        "portfolioPnL": pnl["totalPnL"],
        "portfolioPnLPercent": pnl["totalPnLPercent"],
        "assetClassBreakdown": class_map,
    }


# ── User-owned prices (Portfolio Performance "quote feed" model) ──
#
# Every user keeps their own security master data and price history:
#   securities/{ticker}      → { feed: AUTO | MANUAL | GENERIC-JSON, … }
#   securityPrices/{ticker}  → { prices: { "YYYY-MM-DD": close } }
#
#   AUTO          system prices (vnstock / CoinGecko / SJC) win; the user's own
#                 prices only fill dates the system does not know
#   MANUAL        prices entered or imported by the user (no download)
#   GENERIC-JSON  prices downloaded from a user-configured JSON URL
# For MANUAL and GENERIC-JSON the user's latest price on/before the valuation
# date wins; a system price is only used when the user has none yet.

FEED_AUTO = "AUTO"
FEED_MANUAL = "MANUAL"
FEED_JSON = "GENERIC-JSON"
USER_PRICED_FEEDS = {FEED_MANUAL, FEED_JSON}


def security_feeds(securities: list | None) -> dict:
    """Map ticker → feed id (upper-case), defaulting to AUTO."""
    feeds = {}
    for s in securities or []:
        ticker = (s.get("ticker") or s.get("id") or "").strip().upper()
        if ticker:
            feeds[ticker] = (s.get("feed") or FEED_AUTO).upper()
    return feeds


def latest_price_on_or_before(price_map: dict | None, date_str: str):
    """Return (date, price) of the most recent entry on/before date_str, or (None, None)."""
    best = None
    for d in (price_map or {}):
        if d <= date_str and (best is None or d > best):
            best = d
    if best is None:
        return None, None
    try:
        value = float(price_map[best])
    except (TypeError, ValueError):
        return None, None
    return best, value


def apply_user_prices(market_prices: dict | None, securities: list | None,
                      user_prices: dict | None, date_str: str, tickers=None) -> dict:
    """
    Overlay a user's own prices on system market prices for valuation on date_str.
    Returns a new dict compatible with calculate_portfolio().
    Mirrors resolveMarketPrices() in src/utils/priceResolver.js.
    """
    out = dict(market_prices or {})
    feeds = security_feeds(securities)
    user_prices = user_prices or {}
    candidates = set(user_prices.keys()) | set(feeds.keys())
    if tickers is not None:
        candidates &= {t for t in tickers if t}

    for ticker in candidates:
        d, price = latest_price_on_or_before(user_prices.get(ticker), date_str)
        if price is None or price <= 0:
            continue
        feed = feeds.get(ticker, FEED_AUTO)
        has_system = bool((out.get(ticker) or {}).get("price"))
        if feed in USER_PRICED_FEEDS or not has_system:
            entry = {"price": price, "date": d, "source": "user"}
            if ticker in STABLECOINS:
                entry["exchangeRate"] = price
            out[ticker] = entry
    return out


def auto_priced_tickers(transactions: list | None, securities: list | None) -> list:
    """
    Tickers whose prices should be downloaded by the system feed:
    tickers traded or listed by the user, except those the user prices on their own.
    """
    feeds = security_feeds(securities)
    tickers = set()
    for tx in transactions or []:
        t = (tx.get("ticker") or "").strip().upper()
        if t and t != "VNĐ":
            tickers.add(t)
    tickers |= set(feeds.keys())
    return sorted(t for t in tickers if feeds.get(t, FEED_AUTO) == FEED_AUTO)
