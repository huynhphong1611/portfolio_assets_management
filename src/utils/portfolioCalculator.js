/**
 * Portfolio Calculator Engine
 * 
 * Tính toán Holdings, Net Worth, Rebalance từ danh sách giao dịch.
 * Sử dụng phương pháp Weighted Average Cost (giá vốn bình quân gia quyền).
 */

// ============================================================
// ASSET CLASS MAPPING
// ============================================================

const ASSET_CLASS_GROUPS = {
  "Tiền mặt VNĐ": "Thanh khoản",
  "Tiền mặt USD": "Thanh khoản",
  "Trái phiếu": "Đầu tư",
  "Cổ phiếu": "Đầu tư",
  "Tài sản mã hóa": "Đầu tư",
  "Vàng": "Đầu tư"
};

const ASSET_CLASS_LABELS = {
  "Tiền mặt VNĐ": "Tiền mặt VNĐ",
  "Tiền mặt USD": "Tiền mặt USD (USDT)",
  "Trái phiếu": "Trái phiếu / CCQ TP",
  "Cổ phiếu": "Cổ phiếu / CCQ CP",
  "Tài sản mã hóa": "Crypto",
  "Vàng": "Vàng đầu tư"
};

// ============================================================
// CALCULATE CURRENT HOLDINGS
// ============================================================

/**
 * Tính danh sách holdings hiện tại từ lịch sử giao dịch.
 * Sử dụng Weighted Average Cost.
 * 
 * @param {Array} transactions - mảng giao dịch từ Firestore
 * @returns {Array} holdings - mảng các mã đang nắm giữ
 */
export function calculateHoldings(transactions) {
  if (!transactions || transactions.length === 0) return [];

  // Sort transactions by date ascending for correct calculation
  const sorted = [...transactions].sort((a, b) => {
    const dateA = parseVietnameseDate(a.date);
    const dateB = parseVietnameseDate(b.date);
    return dateA - dateB;
  });

  // Accumulate per ticker
  const holdingsMap = {};

  for (const tx of sorted) {
    const { ticker, transactionType, assetClass, quantity, totalVND, storage, currency, exchangeRate } = tx;
    
    if (!ticker || ticker === 'VNĐ') {
      // Skip VNĐ deposit/withdrawal for holdings (it's cash flow)
      // But track VNĐ balance separately
      if (assetClass === 'Tiền mặt VNĐ' && transactionType === 'Nạp tiền') {
        if (!holdingsMap['VNĐ_CASH']) {
          holdingsMap['VNĐ_CASH'] = {
            ticker: 'VNĐ',
            assetClass: 'Tiền mặt VNĐ',
            qty: 0,
            totalCost: 0,
            avgCost: 1,
            storage: storage || '',
            currency: 'VNĐ'
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
        ticker,
        assetClass: assetClass || 'Khác',
        qty: 0,
        totalCost: 0,
        avgCost: 0,
        storage: storage || '',
        currency: currency || 'VNĐ'
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
    } else if (transactionType === 'Bán') {
      // Reduce quantity, reduce cost proportionally using avg cost
      const soldCostBasis = entry.avgCost * qty;
      entry.qty -= qty;
      entry.totalCost -= soldCostBasis;
      if (entry.qty <= 0.0001) {
        entry.qty = 0;
        entry.totalCost = 0;
        entry.avgCost = 0;
      }
    }

    // Handle VNĐ cash: buying reduces VNĐ, selling adds VNĐ
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

  // Filter out holdings with zero quantity
  return Object.values(holdingsMap)
    .filter(h => h.qty > 0.0001)
    .map(h => ({
      ...h,
      avgCost: h.qty > 0 ? h.totalCost / h.qty : 0
    }));
}

// ============================================================
// CALCULATE PORTFOLIO WITH MARKET PRICES
// ============================================================

/**
 * Merge holdings with market prices to get full portfolio view
 * 
 * @param {Array} holdings - from calculateHoldings()
 * @param {Object} marketPrices - { ticker: { price, currency, exchangeRate } }
 * @returns {Array} portfolio items with P&L
 */
export function calculatePortfolio(holdings, marketPrices = {}) {
  return holdings.map(h => {
    const market = marketPrices[h.ticker] || {};
    const marketPrice = market.price || h.avgCost; // fallback to avg cost if no market price
    const mktExchangeRate = market.exchangeRate || 1;
    
    let actualValue;
    if (h.ticker === 'VNĐ') {
      actualValue = h.qty;
    } else if (h.ticker === 'USDT') {
      actualValue = h.qty * marketPrice * mktExchangeRate;
    } else if (h.currency === 'USDT') {
      actualValue = h.qty * marketPrice * mktExchangeRate;
    } else {
      actualValue = h.qty * marketPrice;
    }

    const pnl = actualValue - h.totalCost;
    const pnlPercent = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;

    return {
      ticker: h.ticker,
      assetClass: h.assetClass,
      qty: h.qty,
      avgCost: h.avgCost,
      marketPrice,
      totalCost: h.totalCost,
      actualValue,
      pnl,
      pnlPercent,
      storage: h.storage,
      currency: h.currency
    };
  });
}

// ============================================================
// CALCULATE NET WORTH
// ============================================================

/**
 * Tính tổng Net Worth từ portfolio + external assets
 * 
 * @param {Array} portfolio - from calculatePortfolio()
 * @param {Array} externalAssets - from Firestore (TOPI, vàng cưới, etc.)
 * @returns {Object} netWorth breakdown
 */
export function calculateNetWorth(portfolio, externalAssets = []) {
  const liquidAssets = [];
  const investAssets = [];

  // Assets from portfolio
  for (const item of portfolio) {
    const group = ASSET_CLASS_GROUPS[item.assetClass] || "Đầu tư";
    const entry = {
      id: `portfolio_${item.ticker}`,
      name: `${item.ticker} (${ASSET_CLASS_LABELS[item.assetClass] || item.assetClass})`,
      value: item.actualValue,
      source: 'portfolio'
    };

    if (group === "Thanh khoản") {
      liquidAssets.push(entry);
    } else {
      investAssets.push(entry);
    }
  }

  // External assets
  for (const ext of externalAssets) {
    const entry = {
      id: `external_${ext.id}`,
      name: ext.name,
      value: ext.value || 0,
      source: 'external'
    };

    if (ext.group === "Thanh khoản") {
      liquidAssets.push(entry);
    } else {
      investAssets.push(entry);
    }
  }

  const totalLiquid = liquidAssets.reduce((sum, a) => sum + a.value, 0);
  const totalInvest = investAssets.reduce((sum, a) => sum + a.value, 0);
  const totalNetWorth = totalLiquid + totalInvest;

  return {
    liquidAssets: liquidAssets.sort((a, b) => b.value - a.value),
    investAssets: investAssets.sort((a, b) => b.value - a.value),
    totalLiquid,
    totalInvest,
    totalNetWorth
  };
}

// ============================================================
// CALCULATE REBALANCE
// ============================================================

/**
 * Tính tái cơ cấu danh mục so với target weights
 * 
 * @param {Array} portfolio - from calculatePortfolio()
 * @param {Object} targetWeights - { "Trái phiếu": 60, "Cổ phiếu": 20, ... }
 * @returns {Array} rebalance items
 */
export function calculateRebalance(portfolio, targetWeights = {}) {
  // Group portfolio by asset class
  const assetClassTotals = {};
  let totalInvestValue = 0;

  for (const item of portfolio) {
    const cls = item.assetClass;
    if (!assetClassTotals[cls]) {
      assetClassTotals[cls] = 0;
    }
    assetClassTotals[cls] += item.actualValue;
    totalInvestValue += item.actualValue;
  }

  // Build rebalance data
  const allClasses = new Set([
    ...Object.keys(assetClassTotals),
    ...Object.keys(targetWeights)
  ]);

  const rebalanceData = [];
  for (const cls of allClasses) {
    const actualValue = assetClassTotals[cls] || 0;
    const actualWeight = totalInvestValue > 0 
      ? (actualValue / totalInvestValue) * 100 
      : 0;
    const targetWeight = targetWeights[cls] || 0;
    const variance = actualWeight - targetWeight;

    let action;
    if (Math.abs(variance) <= 2) {
      action = { text: "GIỮ NGUYÊN", type: "hold" };
    } else if (variance < -2) {
      action = { text: "MUA THÊM", type: "buy" };
    } else {
      action = { text: "BÁN BỚT", type: "sell" };
    }

    rebalanceData.push({
      assetClass: cls,
      label: ASSET_CLASS_LABELS[cls] || cls,
      actualValue,
      actualWeight,
      targetWeight,
      variance,
      action
    });
  }

  return rebalanceData.sort((a, b) => b.actualValue - a.actualValue);
}

// ============================================================
// CALCULATE TOTAL P&L
// ============================================================

/**
 * Tính tổng P&L cho toàn danh mục (không tính Tiền mặt VNĐ)
 */
export function calculateTotalPnL(portfolio) {
  const investItems = portfolio.filter(p => p.assetClass !== 'Tiền mặt VNĐ');
  const totalValue = investItems.reduce((sum, p) => sum + p.actualValue, 0);
  const totalCost = investItems.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return { totalValue, totalCost, totalPnL, totalPnLPercent };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Parse Vietnamese date format "dd/MM/yyyy HH:mm:ss"
 */
function parseVietnameseDate(dateStr) {
  if (!dateStr) return new Date(0);
  
  // Handle "dd/MM/yyyy HH:mm:ss"
  const parts = dateStr.split(' ');
  const dateParts = (parts[0] || '').split('/');
  const timeParts = (parts[1] || '00:00:00').split(':');
  
  if (dateParts.length === 3) {
    return new Date(
      parseInt(dateParts[2]), // year
      parseInt(dateParts[1]) - 1, // month (0-indexed)
      parseInt(dateParts[0]), // day
      parseInt(timeParts[0] || 0),
      parseInt(timeParts[1] || 0),
      parseInt(timeParts[2] || 0)
    );
  }
  
  return new Date(dateStr);
}

/**
 * Parse Vietnamese number format (1.000.000,50 → 1000000.5)
 */
export function parseVietnameseNumber(str) {
  if (!str || typeof str !== 'string') return parseFloat(str) || 0;
  
  // Remove thousand separators (dots) and replace comma decimal with dot
  const cleaned = str
    .replace(/\./g, '')    // remove dots (thousand separators)
    .replace(',', '.');    // replace comma with dot (decimal)
  
  return parseFloat(cleaned) || 0;
}
