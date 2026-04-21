"""
Portfolio Calculator Engine — Python port of portfolioCalculator.js.

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


def calculate_holdings(transactions: list) -> list:
    """
    Calculate current holdings from transaction history.
    Equivalent to JS calculateHoldings().
    """
    if not transactions:
        return []

    sorted_txs = sorted(transactions, key=lambda t: parse_vietnamese_date(t.get("date", "")))

    holdings_map = {}

    for tx in sorted_txs:
        ticker = tx.get("ticker", "")
        tx_type = tx.get("transactionType", "")
        asset_class = tx.get("assetClass", "")
        quantity = tx.get("quantity", 0)
        total_vnd = tx.get("totalVND", 0)
        storage = tx.get("storage", "")
        currency = tx.get("currency", "VNĐ")
        fund_id = tx.get("fundId")
        fund_name = tx.get("fundName")

        # Handle cash deposits
        if not ticker or ticker == "VNĐ":
            if asset_class == "Tiền mặt VNĐ" and tx_type == "Nạp tiền":
                if "VNĐ_CASH" not in holdings_map:
                    holdings_map["VNĐ_CASH"] = {
                        "ticker": "VNĐ", "assetClass": "Tiền mặt VNĐ",
                        "qty": 0, "totalCost": 0, "avgCost": 1,
                        "storage": storage or "", "currency": "VNĐ",
                        "fundId": fund_id, "fundName": fund_name,
                    }
                holdings_map["VNĐ_CASH"]["qty"] += abs(quantity or total_vnd or 0)
                holdings_map["VNĐ_CASH"]["totalCost"] = holdings_map["VNĐ_CASH"]["qty"]
            continue

        key = ticker

        if key not in holdings_map:
            holdings_map[key] = {
                "ticker": ticker, "assetClass": asset_class or "Khác",
                "qty": 0, "totalCost": 0, "avgCost": 0,
                "storage": storage or "", "currency": currency or "VNĐ",
                "fundId": fund_id, "fundName": fund_name,
            }

        entry = holdings_map[key]
        qty = abs(quantity or 0)
        cost = abs(total_vnd or 0)

        if tx_type == "Mua":
            entry["totalCost"] += cost
            entry["qty"] += qty
            entry["avgCost"] = entry["totalCost"] / entry["qty"] if entry["qty"] > 0 else 0
            if storage:
                entry["storage"] = storage
            if fund_id:
                entry["fundId"] = fund_id
                entry["fundName"] = fund_name

        elif tx_type == "Bán":
            sold_cost_basis = entry["avgCost"] * qty
            entry["qty"] -= qty
            entry["totalCost"] -= sold_cost_basis
            if entry["qty"] <= 0.0001:
                entry["qty"] = 0
                entry["totalCost"] = 0
                entry["avgCost"] = 0

        # Update VNĐ cash if it exists
        if "VNĐ_CASH" in holdings_map:
            if tx_type == "Mua":
                holdings_map["VNĐ_CASH"]["qty"] -= cost
                holdings_map["VNĐ_CASH"]["totalCost"] = max(0, holdings_map["VNĐ_CASH"]["qty"])
            elif tx_type == "Bán":
                holdings_map["VNĐ_CASH"]["qty"] += cost
                holdings_map["VNĐ_CASH"]["totalCost"] = holdings_map["VNĐ_CASH"]["qty"]

    result = []
    for h in holdings_map.values():
        if h["qty"] > 0.0001:
            h["avgCost"] = h["totalCost"] / h["qty"] if h["qty"] > 0 else 0
            result.append(h)
    return result


def calculate_portfolio(holdings: list, market_prices: dict = None) -> list:
    """
    Calculate portfolio with market prices.
    Equivalent to JS calculatePortfolio().
    """
    if market_prices is None:
        market_prices = {}

    usdt_data = market_prices.get("USDT", {})
    usdt_rate = usdt_data.get("exchangeRate") or usdt_data.get("price") or 1

    result = []
    for h in holdings:
        market = market_prices.get(h["ticker"], {})
        market_price = market.get("price")

        if h["ticker"] == "VNĐ":
            actual_value = h["qty"]
            market_price = 1
        elif h["ticker"] in ("USDT", "USDC"):
            actual_value = h["qty"] * market_price if market_price else h["qty"] * usdt_rate
            market_price = market_price or usdt_rate
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
            "fundId": h.get("fundId"),
            "fundName": h.get("fundName"),
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


def calculate_total_pnl(portfolio: list) -> dict:
    """
    Calculate total P&L across all investment positions.
    Equivalent to JS calculateTotalPnL().
    """
    invest_items = [p for p in portfolio if p.get("assetClass") != "Tiền mặt VNĐ"]
    total_value = sum(p.get("actualValue", 0) for p in invest_items)
    total_cost = sum(p.get("totalCost", 0) for p in invest_items)
    total_pnl = total_value - total_cost
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    return {
        "totalValue": total_value,
        "totalCost": total_cost,
        "totalPnL": total_pnl,
        "totalPnLPercent": total_pnl_percent,
    }


def generate_snapshot(portfolio: list, external_assets: list,
                      liabilities: list, funds: list) -> dict:
    """
    Generate a daily snapshot of the portfolio state.
    Equivalent to JS generateSnapshot().
    """
    pnl = calculate_total_pnl(portfolio)
    nw = calculate_net_worth(portfolio, external_assets, liabilities)

    funds_breakdown = {}
    if funds:
        for fund in funds:
            fund_asset_class = fund.get("assetClass", "")
            fund_holdings = [
                p for p in portfolio if (
                    p.get("assetClass") == fund_asset_class or
                    (fund_asset_class == "Tiền mặt" and
                     p.get("assetClass") in ("Tiền mặt VNĐ", "Tiền mặt USD"))
                )
            ]
            holdings_value = sum(h.get("actualValue", 0) for h in fund_holdings)
            holdings_cost = sum(h.get("totalCost", 0) for h in fund_holdings)
            cash = float(fund.get("cashBalance", 0) or 0)

            funds_breakdown[fund.get("name", "")] = {
                "value": holdings_value + cash,
                "holdingsValue": holdings_value,
                "cash": cash,
                "cost": holdings_cost,
                "pnl": holdings_value - holdings_cost,
            }

    return {
        "totalAssets": nw["totalAssets"],
        "totalLiabilities": nw["totalLiabilities"],
        "netWorth": nw["totalNetWorth"],
        "portfolioValue": pnl["totalValue"],
        "portfolioCost": pnl["totalCost"],
        "portfolioPnL": pnl["totalPnL"],
        "portfolioPnLPercent": pnl["totalPnLPercent"],
        "funds": funds_breakdown,
    }
