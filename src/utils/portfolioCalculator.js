/**
 * Portfolio Calculator Engine v4
 *
 * Holdings, Net Worth, Rebalance, P&L, Snapshot generation
 *
 * Securities — moving average cost (bình quân gia quyền di động):
 *   - Mua  qty += q, cost += amount, avgCost = cost / qty
 *   - Bán  cost −= avgCost × q, qty −= q  (avgCost unchanged by a sale;
 *          realized P&L of the sale = proceeds − avgCost × q)
 *   - A sale larger than the position closes it; the excess is a data issue
 *     reported by dataChecks.js, never profit.
 *
 * Cash (the VNĐ deposit account) — see replayCash():
 *   - Nạp tiền  → cash ↑, net capital ↑
 *   - Rút tiền  → cash ↓, net capital ↓
 *   - Mua       → cash ↓ (capital unchanged)
 *   - Bán       → cash ↑ (capital unchanged)
 *   - Cổ tức    → cash ↑ (earnings: dividend / interest / coupon; capital unchanged)
 * Total P&L = total portfolio value (assets + cash) − net capital
 *           = realized + unrealized + earnings
 */
import { parseVNDate, toISO } from './dates.js';

// ============================================================
// TRANSACTION TYPES (Portfolio Performance mapping)
// ============================================================

/** Transaction types and their Portfolio Performance equivalents. */
export const TX_TYPES = {
  DEPOSIT:  'Nạp tiền',   // PP: Deposit
  REMOVAL:  'Rút tiền',   // PP: Removal
  BUY:      'Mua',        // PP: Buy
  SELL:     'Bán',        // PP: Sell
  EARNINGS: 'Cổ tức',     // PP: Dividend / Interest
};

/** External cash flows (money moving between the investor and the portfolio). */
export const CASH_FLOW_TX_TYPES = new Set([TX_TYPES.DEPOSIT, TX_TYPES.REMOVAL]);

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
// ORDERING
// ============================================================

const EPS = 1e-4;

/** Rows without a security (or with ticker "VNĐ") are cash rows. */
const isCashTicker = (ticker) => !ticker || ticker === 'VNĐ';

/** Deposits come first and removals last among rows with the same timestamp. */
const SAME_TIME_RANK = { [TX_TYPES.DEPOSIT]: 0, [TX_TYPES.REMOVAL]: 2 };

/**
 * Chronological order used by every engine (holdings, cash, accounts, reports).
 * Rows with the same timestamp keep their original order, except that money
 * paid in is booked before it is spent and removals after everything else.
 */
export function sortTransactions(transactions = []) {
  return (transactions || [])
    .filter(Boolean)
    .map((tx, i) => ({ tx, i, t: parseVNDate(tx.date).getTime(), r: SAME_TIME_RANK[tx.transactionType] ?? 1 }))
    .sort((a, b) => a.t - b.t || a.r - b.r || a.i - b.i)
    .map(x => x.tx);
}

// ============================================================
// CASH (VNĐ DEPOSIT ACCOUNT)
// ============================================================

/**
 * Replay of the VNĐ deposit account — the single source of truth for cash,
 * net capital and external cash flows (used by calculateHoldings, the Deposit
 * Accounts view and the performance engine, so they always agree).
 *
 * Two bookkeeping modes, decided by the whole log:
 *   tracked   the log has deposits / removals (Nạp / Rút tiền). Every purchase
 *             debits and every sale credits the account in full. The balance may
 *             go negative: a purchase was entered before (or without) the deposit
 *             that paid for it. dataChecks.js reports it; it is never hidden,
 *             because flooring the balance at 0 would invent cash and profit.
 *   implicit  no deposits / removals at all (e.g. a trades-only import). Sale
 *             proceeds and earnings stay in the account and pay for later
 *             purchases; whatever a purchase needs beyond the balance counts as
 *             capital paid in (an implicit deposit).
 *
 * Nạp / Rút tiền always move VNĐ (a ticker on such a row is ignored).
 * Mua / Bán on a cash row (no ticker, or "VNĐ") do nothing.
 *
 * @returns {{
 *   mode: 'tracked'|'implicit',
 *   rows: Array<{ tx, date: string, kind: string, delta: number, balance: number }>,
 *   flows: Array<{ tx, date: string, amount: number, kind: string }>,
 *   balance: number, netCapital: number, deposits: number, removals: number,
 *   implicitDeposits: number, earnings: number, minBalance: number, storage: string
 * }}
 *   rows  — every movement of the account, chronological; kind is one of
 *           deposit | removal | earnings | buy | sell | implicit
 *   flows — capital paid in (+) or taken out (−): deposits, removals and
 *           implicit deposits; these are the external flows for TTWROR / IRR
 */
export function replayCash(transactions = []) {
  const sorted = sortTransactions(transactions);
  const mode = sorted.some(tx => CASH_FLOW_TX_TYPES.has(tx.transactionType)) ? 'tracked' : 'implicit';
  const rows = [];
  const flows = [];
  let balance = 0, deposits = 0, removals = 0, implicitDeposits = 0, earnings = 0, minBalance = 0;
  let storage = null;

  const book = (tx, kind, delta) => {
    balance += delta;
    if (balance < minBalance) minBalance = balance;
    rows.push({ tx, date: toISO(tx.date), kind, delta, balance });
  };

  for (const tx of sorted) {
    const type = tx.transactionType;
    const cashRow = isCashTicker((tx.ticker || '').trim());
    const amount = Math.abs(Number(tx.totalVND) || 0);
    // cash rows may only carry the amount in `quantity`
    const cashAmount = Math.abs(Number(tx.totalVND) || Number(tx.quantity) || 0);

    if (type === TX_TYPES.DEPOSIT || type === TX_TYPES.REMOVAL) {
      const signed = type === TX_TYPES.DEPOSIT ? cashAmount : -cashAmount;
      if (type === TX_TYPES.DEPOSIT) deposits += cashAmount; else removals += cashAmount;
      if (storage === null) storage = tx.storage || '';
      book(tx, type === TX_TYPES.DEPOSIT ? 'deposit' : 'removal', signed);
      flows.push({ tx, date: toISO(tx.date), amount: signed, kind: type === TX_TYPES.DEPOSIT ? 'deposit' : 'removal' });
    } else if (type === TX_TYPES.EARNINGS) {
      const received = cashRow ? cashAmount : amount;
      earnings += received;
      book(tx, 'earnings', received);
    } else if (cashRow) {
      continue;
    } else if (type === TX_TYPES.BUY) {
      const shortfall = amount - balance;
      if (mode === 'implicit' && shortfall > 0) {
        implicitDeposits += shortfall;
        book(tx, 'implicit', shortfall);
        flows.push({ tx, date: toISO(tx.date), amount: shortfall, kind: 'implicit' });
      }
      book(tx, 'buy', -amount);
    } else if (type === TX_TYPES.SELL) {
      book(tx, 'sell', amount);
    }
  }

  return {
    mode, rows, flows, balance,
    netCapital: deposits - removals + implicitDeposits,
    deposits, removals, implicitDeposits, earnings, minBalance,
    storage: storage || '',
  };
}

// ============================================================
// CALCULATE HOLDINGS
// ============================================================

/**
 * Current holdings: one row per security (moving average cost) plus the
 * VNĐ cash row, whose qty is the cash balance and totalCost the net capital.
 */
export function calculateHoldings(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const holdingsMap = {};

  for (const tx of sortTransactions(transactions)) {
    const { transactionType, assetClass, quantity, totalVND, storage, currency } = tx;
    const ticker = (tx.ticker || '').trim();
    // cash rows, deposits / removals and earnings never change a position
    if (isCashTicker(ticker)) continue;
    if (transactionType !== TX_TYPES.BUY && transactionType !== TX_TYPES.SELL) continue;

    if (!holdingsMap[ticker]) {
      holdingsMap[ticker] = {
        ticker,
        assetClass: assetClass || 'Khác',
        qty: 0,
        totalCost: 0,
        avgCost: 0,
        storage: storage || '',
        currency: currency || 'VNĐ',
      };
    }

    const entry = holdingsMap[ticker];
    const qty  = Math.abs(Number(quantity) || 0);
    const cost = Math.abs(Number(totalVND) || 0);

    if (transactionType === TX_TYPES.BUY) {
      entry.totalCost += cost;
      entry.qty       += qty;
      entry.avgCost    = entry.qty > 0 ? entry.totalCost / entry.qty : 0;
      if (storage) entry.storage = storage;
    } else {
      // Sale at average cost: the average does not change, a larger sale closes the position
      const soldQty = Math.min(qty, entry.qty);
      entry.totalCost -= entry.avgCost * soldQty;
      entry.qty       -= soldQty;
      if (entry.qty <= EPS) {
        entry.qty = 0; entry.totalCost = 0; entry.avgCost = 0;
      }
    }
  }

  const holdings = Object.values(holdingsMap)
    .filter(h => h.qty > EPS)
    .map(h => ({ ...h, avgCost: h.totalCost / h.qty }));

  const cash = replayCash(transactions);
  if (cash.rows.length && (Math.abs(cash.balance) > EPS || Math.abs(cash.netCapital) > EPS)) {
    holdings.unshift({
      ticker: 'VNĐ',
      assetClass: 'Tiền mặt VNĐ',
      qty: cash.balance,          // cash balance (negative = purchases without a recorded deposit)
      totalCost: cash.netCapital, // net capital paid in
      avgCost: 1,
      storage: cash.storage,
      currency: 'VNĐ',
    });
  }
  return holdings;
}

// ============================================================
// CALCULATE PORTFOLIO WITH MARKET PRICES
// ============================================================

const STABLECOIN_TICKERS = new Set(['USDT', 'USDC']);

/**
 * Value every holding. Prices are VND per unit. A holding without a market
 * price is valued at its average cost; a stablecoin without a price of its own
 * uses its exchange rate, then the USDT rate, then its average cost.
 */
export function calculatePortfolio(holdings, marketPrices = {}) {
  const usdtRate = marketPrices['USDT']?.price || marketPrices['USDT']?.exchangeRate || 0;

  return holdings.map(h => {
    const market = marketPrices[h.ticker] || {};
    let marketPrice;
    if (h.ticker === 'VNĐ') {
      marketPrice = 1;
    } else if (STABLECOIN_TICKERS.has(h.ticker)) {
      marketPrice = market.price || market.exchangeRate || usdtRate || h.avgCost;
    } else {
      marketPrice = market.price || h.avgCost;
    }
    const actualValue = h.qty * marketPrice;

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
   * Total P&L = (current value of ALL holdings incl. cash) − net capital
   *
   * Net capital comes from the cash replay of the transaction log
   * (deposits − removals, or the implicit deposits of a trades-only log).
   * It can be ≤ 0 after withdrawing more than was paid in; the P&L is still
   * value − capital, only the percentage is undefined (reported as 0).
   * Without transactions: the cash row's net capital, else the cost basis.
   */
  const totalValue = portfolio.reduce((sum, p) => sum + (Number.isFinite(p.actualValue) ? p.actualValue : 0), 0);

  const cashItem = portfolio.find(p => p.ticker === 'VNĐ');
  let netCapital;
  if (transactions && transactions.length) {
    netCapital = replayCash(transactions).netCapital;
  } else if (cashItem) {
    netCapital = cashItem.totalCost;
  } else {
    netCapital = portfolio.reduce((sum, p) => sum + p.totalCost, 0);
  }

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

export function parseVietnameseNumber(str) {
  if (!str || typeof str !== 'string') return parseFloat(str) || 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}
