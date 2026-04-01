/**
 * Portfolio Calculator Engine v2
 * 
 * Holdings, Net Worth, Rebalance, P&L, Fund calculations, Snapshot generation
 */

// ============================================================
// ASSET CLASS MAPPING
// ============================================================

export const ASSET_CLASS_GROUPS = {
  "Tiền mặt VNĐ": "Thanh khoản",
  "Tiền mặt USD": "Thanh khoản",
  "Trái phiếu": "Đầu tư",
  "Cổ phiếu": "Đầu tư",
  "Tài sản mã hóa": "Đầu tư",
  "Vàng": "Đầu tư"
};

export const ASSET_CLASS_LABELS = {
  "Tiền mặt VNĐ": "Tiền mặt VNĐ",
  "Tiền mặt USD": "Tiền mặt USD (USDT)",
  "Trái phiếu": "Trái phiếu / CCQ TP",
  "Cổ phiếu": "Cổ phiếu / CCQ CP",
  "Tài sản mã hóa": "Crypto",
  "Vàng": "Vàng đầu tư"
};

// ============================================================
// CALCULATE HOLDINGS
// ============================================================

export function calculateHoldings(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const sorted = [...transactions].sort((a, b) => {
    const dateA = parseVietnameseDate(a.date);
    const dateB = parseVietnameseDate(b.date);
    return dateA - dateB;
  });

  const holdingsMap = {};

  for (const tx of sorted) {
    const { ticker, transactionType, assetClass, quantity, totalVND, storage, currency, exchangeRate, fundId, fundName } = tx;
    
    if (!ticker || ticker === 'VNĐ') {
      if (assetClass === 'Tiền mặt VNĐ' && transactionType === 'Nạp tiền') {
        if (!holdingsMap['VNĐ_CASH']) {
          holdingsMap['VNĐ_CASH'] = {
            ticker: 'VNĐ', assetClass: 'Tiền mặt VNĐ', qty: 0, totalCost: 0, avgCost: 1,
            storage: storage || '', currency: 'VNĐ', fundId: fundId || null, fundName: fundName || null
          };
        }
        holdingsMap['VNĐ_CASH'].qty += Math.abs(quantity || totalVND || 0);
        holdingsMap['VNĐ_CASH'].totalCost = holdingsMap['VNĐ_CASH'].qty;
      }
      continue;
    }

    const key = ticker;

    if (!holdingsMap[key]) {
      holdingsMap[key] = {
        ticker, assetClass: assetClass || 'Khác', qty: 0, totalCost: 0, avgCost: 0,
        storage: storage || '', currency: currency || 'VNĐ',
        fundId: fundId || null, fundName: fundName || null
      };
    }

    const entry = holdingsMap[key];
    const qty = Math.abs(quantity || 0);
    const cost = Math.abs(totalVND || 0);

    if (transactionType === 'Mua') {
      entry.totalCost += cost;
      entry.qty += qty;
      entry.avgCost = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
      if (storage) entry.storage = storage;
      if (fundId) { entry.fundId = fundId; entry.fundName = fundName; }
    } else if (transactionType === 'Bán') {
      const soldCostBasis = entry.avgCost * qty;
      entry.qty -= qty;
      entry.totalCost -= soldCostBasis;
      if (entry.qty <= 0.0001) {
        entry.qty = 0; entry.totalCost = 0; entry.avgCost = 0;
      }
    }

    if (holdingsMap['VNĐ_CASH']) {
      if (transactionType === 'Mua') {
        holdingsMap['VNĐ_CASH'].qty -= cost;
        holdingsMap['VNĐ_CASH'].totalCost = Math.max(0, holdingsMap['VNĐ_CASH'].qty);
      } else if (transactionType === 'Bán') {
        holdingsMap['VNĐ_CASH'].qty += cost;
        holdingsMap['VNĐ_CASH'].totalCost = holdingsMap['VNĐ_CASH'].qty;
      }
    }
  }

  return Object.values(holdingsMap)
    .filter(h => h.qty > 0.0001)
    .map(h => ({ ...h, avgCost: h.qty > 0 ? h.totalCost / h.qty : 0 }));
}

// ============================================================
// CALCULATE PORTFOLIO WITH MARKET PRICES
// ============================================================

export function calculatePortfolio(holdings, marketPrices = {}) {
  // Get global USDT exchange rate
  const usdtRate = marketPrices['USDT']?.exchangeRate || marketPrices['USDT']?.price || 1;

  return holdings.map(h => {
    const market = marketPrices[h.ticker] || {};
    const marketPrice = market.price || h.avgCost;
    
    let actualValue;
    if (h.ticker === 'VNĐ') {
      actualValue = h.qty;
    } else if (h.ticker === 'USDT') {
      // USDT itself: qty * exchangeRate
      actualValue = h.qty * usdtRate;
    } else if (h.currency === 'USDT' || h.assetClass === 'Tài sản mã hóa') {
      // Crypto/USDT-priced assets: qty * price_in_USDT * USDT_rate
      const priceInUsdt = market.price || h.avgCost;
      actualValue = h.qty * priceInUsdt * usdtRate;
    } else {
      // VND-priced assets: qty * price_in_VND
      actualValue = h.qty * marketPrice;
    }

    const pnl = actualValue - h.totalCost;
    const pnlPercent = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;

    return {
      ticker: h.ticker, assetClass: h.assetClass, qty: h.qty, avgCost: h.avgCost,
      marketPrice, totalCost: h.totalCost, actualValue, pnl, pnlPercent,
      storage: h.storage, currency: h.currency,
      fundId: h.fundId, fundName: h.fundName
    };
  });
}

// ============================================================
// CALCULATE NET WORTH
// ============================================================

export function calculateNetWorth(portfolio, externalAssets = [], liabilities = []) {
  const liquidAssets = [];
  const investAssets = [];

  for (const item of portfolio) {
    const group = ASSET_CLASS_GROUPS[item.assetClass] || "Đầu tư";
    const entry = {
      id: `portfolio_${item.ticker}`,
      name: `${item.ticker} (${ASSET_CLASS_LABELS[item.assetClass] || item.assetClass})`,
      value: item.actualValue,
      source: 'portfolio'
    };
    if (group === "Thanh khoản") liquidAssets.push(entry);
    else investAssets.push(entry);
  }

  for (const ext of externalAssets) {
    const entry = { id: `external_${ext.id}`, name: ext.name, value: ext.value || 0, source: 'external' };
    if (ext.group === "Thanh khoản") liquidAssets.push(entry);
    else investAssets.push(entry);
  }

  const totalLiquid = liquidAssets.reduce((sum, a) => sum + a.value, 0);
  const totalInvest = investAssets.reduce((sum, a) => sum + a.value, 0);
  const totalAssets = totalLiquid + totalInvest;
  const totalLiabilities = liabilities.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const totalNetWorth = totalAssets - totalLiabilities;

  return {
    liquidAssets: liquidAssets.sort((a, b) => b.value - a.value),
    investAssets: investAssets.sort((a, b) => b.value - a.value),
    totalLiquid, totalInvest, totalAssets, totalLiabilities, totalNetWorth
  };
}

// ============================================================
// CALCULATE REBALANCE
// ============================================================

export function calculateRebalance(portfolio, targetWeights = {}) {
  const assetClassTotals = {};
  let totalInvestValue = 0;

  for (const item of portfolio) {
    const cls = item.assetClass;
    if (!assetClassTotals[cls]) assetClassTotals[cls] = 0;
    assetClassTotals[cls] += item.actualValue;
    totalInvestValue += item.actualValue;
  }

  const allClasses = new Set([...Object.keys(assetClassTotals), ...Object.keys(targetWeights)]);
  const rebalanceData = [];

  for (const cls of allClasses) {
    const actualValue = assetClassTotals[cls] || 0;
    const actualWeight = totalInvestValue > 0 ? (actualValue / totalInvestValue) * 100 : 0;
    const targetWeight = parseFloat(targetWeights[cls]) || 0;
    const variance = actualWeight - targetWeight;

    let action;
    if (Math.abs(variance) <= 2) action = { text: "GIỮ NGUYÊN", type: "hold" };
    else if (variance < -2) action = { text: "MUA THÊM", type: "buy" };
    else action = { text: "BÁN BỚT", type: "sell" };

    rebalanceData.push({
      assetClass: cls, label: ASSET_CLASS_LABELS[cls] || cls,
      actualValue, actualWeight, targetWeight, variance, action
    });
  }

  return rebalanceData.sort((a, b) => b.actualValue - a.actualValue);
}

// ============================================================
// CALCULATE TOTAL P&L
// ============================================================

export function calculateTotalPnL(portfolio) {
  const investItems = portfolio.filter(p => p.assetClass !== 'Tiền mặt VNĐ');
  const totalValue = investItems.reduce((sum, p) => sum + p.actualValue, 0);
  const totalCost = investItems.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  return { totalValue, totalCost, totalPnL, totalPnLPercent };
}

// ============================================================
// GENERATE DAILY SNAPSHOT
// ============================================================

export function generateSnapshot(portfolio, externalAssets, liabilities, funds) {
  const pnl = calculateTotalPnL(portfolio);
  const nw = calculateNetWorth(portfolio, externalAssets, liabilities);

  // Per-fund breakdown
  const fundsBreakdown = {};
  if (funds && funds.length > 0) {
    funds.forEach(fund => {
      const fundHoldings = portfolio.filter(p =>
        p.assetClass === fund.assetClass ||
        (fund.assetClass === 'Tiền mặt' && (p.assetClass === 'Tiền mặt VNĐ' || p.assetClass === 'Tiền mặt USD'))
      );
      const holdingsValue = fundHoldings.reduce((s, h) => s + h.actualValue, 0);
      const holdingsCost = fundHoldings.reduce((s, h) => s + h.totalCost, 0);
      const cash = parseFloat(fund.cashBalance) || 0;

      fundsBreakdown[fund.name] = {
        value: holdingsValue + cash,
        holdingsValue,
        cash,
        cost: holdingsCost,
        pnl: holdingsValue - holdingsCost,
      };
    });
  }

  return {
    totalAssets: nw.totalAssets,
    totalLiabilities: nw.totalLiabilities,
    netWorth: nw.totalNetWorth,
    portfolioValue: pnl.totalValue,
    portfolioCost: pnl.totalCost,
    portfolioPnL: pnl.totalPnL,
    portfolioPnLPercent: pnl.totalPnLPercent,
    funds: fundsBreakdown,
  };
}

// ============================================================
// HELPERS
// ============================================================

function parseVietnameseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split(' ');
  const dateParts = (parts[0] || '').split('/');
  const timeParts = (parts[1] || '00:00:00').split(':');
  if (dateParts.length === 3) {
    return new Date(
      parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]),
      parseInt(timeParts[0] || 0), parseInt(timeParts[1] || 0), parseInt(timeParts[2] || 0)
    );
  }
  return new Date(dateStr);
}

export function parseVietnameseNumber(str) {
  if (!str || typeof str !== 'string') return parseFloat(str) || 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}
