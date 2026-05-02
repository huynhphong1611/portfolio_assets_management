/**
 * Portfolio Calculator Engine v3
 *
 * Holdings, Net Worth, Rebalance, P&L, Snapshot generation
 * Capital accounting model:
 *   - Nạp tiền  → VNĐ_CASH.qty ↑, VNĐ_CASH.totalCost ↑ (net capital in)
 *   - Rút tiền  → VNĐ_CASH.qty ↓, VNĐ_CASH.totalCost ↓ (net capital out)
 *   - Mua       → VNĐ_CASH.qty ↓, asset cost↑  (capital moves; totalCost unchanged)
 *   - Bán       → VNĐ_CASH.qty ↑, asset cost↓  (capital returns; totalCost unchanged)
 * Total P&L = total portfolio value (assets + cash) − net capital deposited
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

  /** Ensure VNĐ_CASH entry exists (lazy init). */
  const ensureCash = (storage = '') => {
    if (!holdingsMap['VNĐ_CASH']) {
      holdingsMap['VNĐ_CASH'] = {
        ticker: 'VNĐ',
        assetClass: 'Tiền mặt VNĐ',
        qty: 0,           // actual liquid balance — changes on all tx types
        totalCost: 0,     // net capital deposited  — only changes on Nạp / Rút
        avgCost: 1,
        storage: storage || '',
        currency: 'VNĐ',
      };
    }
  };

  for (const tx of sorted) {
    const { ticker, transactionType, assetClass, quantity, totalVND, storage, currency } = tx;
    const amount = Math.abs(totalVND || quantity || 0);

    // ── Cash-flow transactions (no ticker or ticker = 'VNĐ') ──
    if (!ticker || ticker === 'VNĐ') {
      if (assetClass === 'Tiền mặt VNĐ') {
        if (transactionType === 'Nạp tiền') {
          ensureCash(storage);
          holdingsMap['VNĐ_CASH'].qty       += amount;
          holdingsMap['VNĐ_CASH'].totalCost += amount; // FIX: capital in
        } else if (transactionType === 'Rút tiền') {
          ensureCash(storage);
          holdingsMap['VNĐ_CASH'].qty       -= amount;
          holdingsMap['VNĐ_CASH'].totalCost -= amount; // capital out
        }
      }
      continue;
    }

    // ── Asset transactions ──
    const key = ticker;
    if (!holdingsMap[key]) {
      holdingsMap[key] = {
        ticker,
        assetClass: assetClass || 'Khác',
        qty: 0,
        totalCost: 0,
        avgCost: 0,
        storage: storage || '',
        currency: currency || 'VNĐ',
      };
    }

    const entry = holdingsMap[key];
    const qty  = Math.abs(quantity || 0);
    const cost = Math.abs(totalVND || 0);

    if (transactionType === 'Mua') {
      entry.totalCost += cost;
      entry.qty       += qty;
      entry.avgCost    = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
      if (storage) entry.storage = storage;

      // Cash decreases (spent), but net capital is unchanged
      if (holdingsMap['VNĐ_CASH']) {
        holdingsMap['VNĐ_CASH'].qty = Math.max(0, holdingsMap['VNĐ_CASH'].qty - cost);
        // FIX: do NOT touch .totalCost here
      }
    } else if (transactionType === 'Bán') {
      const soldCostBasis = entry.avgCost * qty;
      entry.qty       -= qty;
      entry.totalCost -= soldCostBasis;
      if (entry.qty <= 0.0001) {
        entry.qty = 0; entry.totalCost = 0; entry.avgCost = 0;
      } else {
        entry.avgCost = entry.totalCost / entry.qty;
      }

      // Cash increases (proceeds returned), but net capital is unchanged
      if (holdingsMap['VNĐ_CASH']) {
        holdingsMap['VNĐ_CASH'].qty += cost;
        // FIX: do NOT touch .totalCost here
      }
    }
  }

  // Keep VNĐ_CASH when qty > 0 (has cash) OR net capital > 0 (tracks deposits)
  return Object.values(holdingsMap)
    .filter(h => h.qty > 0.0001 || (h.ticker === 'VNĐ' && (h.totalCost > 0 || h.qty > 0.0001)))
    .map(h => ({
      ...h,
      avgCost: h.ticker === 'VNĐ' ? 1 : (h.qty > 0 ? h.totalCost / h.qty : 0),
    }));
}

// ============================================================
// CALCULATE PORTFOLIO WITH MARKET PRICES
// ============================================================

export function calculatePortfolio(holdings, marketPrices = {}) {
  // Get global USDT exchange rate
  const usdtRate = marketPrices['USDT']?.exchangeRate || marketPrices['USDT']?.price || 1;
  // Get global USDC exchange rate (fallback to USDT rate)
  const usdcRate = marketPrices['USDC']?.exchangeRate || marketPrices['USDC']?.price || usdtRate;
  // Gold-backed tokens that trade on crypto exchanges (priced in USDT)
  const CRYPTO_GOLD_TICKERS = new Set(['PAXG', 'XAUT']);
  // Stablecoins set
  const STABLECOIN_TICKERS = new Set(['USDT', 'USDC']);

  return holdings.map(h => {
    const market = marketPrices[h.ticker] || {};
    let marketPrice = market.price;
    
    let actualValue;
    if (h.ticker === 'VNĐ') {
      actualValue = h.qty;
      marketPrice = 1;
    } else if (h.ticker === 'USDT' || h.ticker === 'USDC') {
      actualValue = h.qty * marketPrice; // For stablecoins, marketPrice IS the VND rate
    } else {
      marketPrice = market.price || h.avgCost; // market.price is ALREADY in VND
      actualValue = h.qty * marketPrice;
    }

    const pnl = actualValue - h.totalCost;
    const pnlPercent = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;

    return {
      ticker: h.ticker, assetClass: h.assetClass, qty: h.qty, avgCost: h.avgCost,
      marketPrice, totalCost: h.totalCost, actualValue, pnl, pnlPercent,
      storage: h.storage, currency: h.currency
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

export function calculateTotalPnL(portfolio, transactions = []) {
  /**
   * True P&L = (total current value of ALL holdings incl. cash)
   *           - (net capital deposited = sum of Nạp tiền - Rút tiền)
   *
   * Priority:
   *   1. VNĐ_CASH.totalCost > 0  → most accurate (deposit-tracking accounts)
   *   2. Transaction log           → fallback for any account with Nạp tiền rows
   *   3. Sum of cost-basis         → last resort (import-only, no deposit rows)
   *
   * NOTE: We deliberately ignore cashItem.totalCost when it is <= 0 to avoid
   * displaying a negative "Tổng vốn đã đầu tư" after a user closes all
   * positions and the cash register has not been reconciled.
   */
  // 1. Total current portfolio value (assets + liquid cash)
  const totalValue = portfolio.reduce((sum, p) => sum + p.actualValue, 0);

  // 2. Derive net capital from transaction log first (always most reliable)
  let txNetCapital = 0;
  let hasCashFlowTx = false;
  for (const t of transactions) {
    const amt = Math.abs(t.totalVND || 0);
    if (t.transactionType === 'Nạp tiền') { txNetCapital += amt; hasCashFlowTx = true; }
    else if (t.transactionType === 'Rút tiền') { txNetCapital -= amt; hasCashFlowTx = true; }
  }

  // 3. Choose the best net-capital source
  const cashItem = portfolio.find(p => p.ticker === 'VNĐ');
  let netCapital;

  if (hasCashFlowTx) {
    // Transaction log is authoritative when deposit/withdrawal rows exist
    netCapital = txNetCapital;
  } else if (cashItem && cashItem.totalCost > 0) {
    // Accounts without Nạp/Rút but with a tracked cash item
    netCapital = cashItem.totalCost;
  } else {
    // Last resort (import without deposits): use cost basis of all positions
    netCapital = portfolio.reduce((sum, p) => sum + p.totalCost, 0);
  }

  // Guard: netCapital should never be negative (would mean more Rút than Nạp)
  netCapital = Math.max(0, netCapital);

  const totalPnL        = totalValue - netCapital;
  const totalPnLPercent = netCapital > 0 ? (totalPnL / netCapital) * 100 : 0;
  return { totalValue, totalCost: netCapital, totalPnL, totalPnLPercent };
}

// ============================================================
// GENERATE DAILY SNAPSHOT
// ============================================================

export function generateSnapshot(portfolio, externalAssets, liabilities, transactions = []) {
  // Pass transactions so P&L % is always computed against net capital, not cost-basis
  const pnl = calculateTotalPnL(portfolio, transactions);
  const nw = calculateNetWorth(portfolio, externalAssets, liabilities);

  // Asset class breakdown for historical allocation chart
  const classMap = {};
  for (const item of portfolio) {
    const cls = item.assetClass || 'Khác';
    classMap[cls] = (classMap[cls] || 0) + item.actualValue;
  }

  return {
    totalAssets: nw.totalAssets,
    totalLiabilities: nw.totalLiabilities,
    netWorth: nw.totalNetWorth,
    portfolioValue: pnl.totalValue,
    portfolioCost: pnl.totalCost,
    portfolioPnL: pnl.totalPnL,
    portfolioPnLPercent: pnl.totalPnLPercent,
    assetClassBreakdown: classMap,
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
