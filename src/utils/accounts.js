/**
 * Accounts — Portfolio Performance splits a portfolio into
 *   - Deposit accounts   (cash)       → buildCashLedger
 *   - Securities accounts (depots)    → calculateHoldingsByStorage
 *
 * Both functions replay transactions with EXACTLY the same rules as
 * calculateHoldings() so the balances always reconcile with the
 * Statement of Assets.
 */
import { parseVNDate, toISO } from './dates.js';
import { TX_TYPES } from './portfolioCalculator.js';

const EPS = 1e-4;
export const UNKNOWN_STORAGE = 'Chưa gán nơi lưu ký';

const byDate = (a, b) => parseVNDate(a.date) - parseVNDate(b.date);

/**
 * Running balance of the VNĐ cash (deposit) account.
 *
 * Mirrors calculateHoldings():
 *   - Nạp / Rút tiền (no ticker, asset class "Tiền mặt VNĐ") open the account
 *   - Cổ tức always credits the account (and opens it)
 *   - Mua debits (balance floored at 0), Bán credits — only once the account exists
 *
 * @returns {{ rows: Array, balance: number, netDeposits: number }}
 *          rows are chronological; each row has { tx, date, delta, balance }.
 */
export function buildCashLedger(transactions = []) {
  const sorted = [...transactions].filter(Boolean).sort(byDate);
  let exists = false;
  let balance = 0;
  let netDeposits = 0;
  const rows = [];

  for (const tx of sorted) {
    const type = tx.transactionType;
    const ticker = tx.ticker || '';
    const isCashRow = !ticker || ticker === 'VNĐ';
    const cashAmount = Math.abs(Number(tx.totalVND) || Number(tx.quantity) || 0);
    const amount = Math.abs(Number(tx.totalVND) || 0);
    let delta = null;

    if (isCashRow) {
      if (tx.assetClass === 'Tiền mặt VNĐ' && type === TX_TYPES.DEPOSIT) {
        exists = true; delta = cashAmount; netDeposits += cashAmount;
      } else if (tx.assetClass === 'Tiền mặt VNĐ' && type === TX_TYPES.REMOVAL) {
        exists = true; delta = -cashAmount; netDeposits -= cashAmount;
      } else if (type === TX_TYPES.EARNINGS) {
        exists = true; delta = cashAmount;
      }
    } else if (type === TX_TYPES.EARNINGS) {
      exists = true; delta = amount;
    } else if (type === TX_TYPES.BUY && exists) {
      delta = Math.max(0, balance - amount) - balance;
    } else if (type === TX_TYPES.SELL && exists) {
      delta = amount;
    }

    if (delta === null) continue;
    balance += delta;
    rows.push({ tx, id: tx.id, date: toISO(tx.date), delta, balance, requested: type === TX_TYPES.BUY ? -amount : delta });
  }

  return { rows, balance, netDeposits };
}

/**
 * Holdings per securities account (the transaction's `storage` field:
 * broker, exchange, fund platform…). Average-cost model per account.
 *
 * @param {Array} transactions
 * @param {Array} portfolio  output of calculatePortfolio (for market prices)
 * @returns {Array<{ name, positions: Array, value, cost, pnl, txCount }>}
 */
export function calculateHoldingsByStorage(transactions = [], portfolio = []) {
  const priceOf = Object.fromEntries(portfolio.map(p => [p.ticker, p.marketPrice]));
  const classOf = Object.fromEntries(portfolio.map(p => [p.ticker, p.assetClass]));
  const accounts = new Map();

  const getAccount = (name) => {
    if (!accounts.has(name)) accounts.set(name, { name, positions: new Map(), txCount: 0, transactions: [] });
    return accounts.get(name);
  };

  for (const tx of [...transactions].filter(Boolean).sort(byDate)) {
    const ticker = (tx.ticker || '').trim();
    const type = tx.transactionType;
    const name = (tx.storage || '').trim() || UNKNOWN_STORAGE;
    const acc = getAccount(name);
    acc.txCount += 1;
    acc.transactions.push(tx);
    if (!ticker || ticker === 'VNĐ') continue;
    if (type !== TX_TYPES.BUY && type !== TX_TYPES.SELL) continue;

    if (!acc.positions.has(ticker)) {
      acc.positions.set(ticker, { ticker, assetClass: tx.assetClass || classOf[ticker] || 'Khác', qty: 0, totalCost: 0 });
    }
    const pos = acc.positions.get(ticker);
    const qty = Math.abs(Number(tx.quantity) || 0);
    const cost = Math.abs(Number(tx.totalVND) || 0);

    if (type === TX_TYPES.BUY) {
      pos.qty += qty;
      pos.totalCost += cost;
    } else {
      const sellQty = Math.min(qty, pos.qty);
      const avg = pos.qty > EPS ? pos.totalCost / pos.qty : 0;
      pos.qty -= sellQty;
      pos.totalCost -= avg * sellQty;
      if (pos.qty <= EPS) { pos.qty = 0; pos.totalCost = 0; }
    }
  }

  return Array.from(accounts.values()).map(acc => {
    const positions = Array.from(acc.positions.values())
      .filter(p => p.qty > EPS)
      .map(p => {
        const avgCost = p.qty > 0 ? p.totalCost / p.qty : 0;
        const price = priceOf[p.ticker] || avgCost;
        const value = p.qty * price;
        return { ...p, avgCost, marketPrice: price, value, pnl: value - p.totalCost, pnlPct: p.totalCost > 0 ? (value - p.totalCost) / p.totalCost : 0 };
      })
      .sort((a, b) => b.value - a.value);
    const value = positions.reduce((s, p) => s + p.value, 0);
    const cost = positions.reduce((s, p) => s + p.totalCost, 0);
    return { name: acc.name, positions, value, cost, pnl: value - cost, txCount: acc.txCount, transactions: acc.transactions };
  }).sort((a, b) => b.value - a.value || b.txCount - a.txCount);
}
