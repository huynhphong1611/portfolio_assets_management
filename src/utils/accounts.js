/**
 * Accounts — Portfolio Performance splits a portfolio into
 *   - Deposit accounts   (cash)       → buildCashLedger
 *   - Securities accounts (depots)    → calculateHoldingsByStorage
 *
 * The cash ledger is the same replay (replayCash) that calculateHoldings()
 * uses, so its balance always reconciles with the Statement of Assets.
 */
import { replayCash, sortTransactions, TX_TYPES } from './portfolioCalculator.js';

const EPS = 1e-4;
export const UNKNOWN_STORAGE = 'Chưa gán nơi lưu ký';

/**
 * Running balance of the VNĐ cash (deposit) account.
 *
 * @returns {{ rows: Array, balance: number, netDeposits: number, mode: string,
 *            implicitDeposits: number, minBalance: number }}
 *          rows are chronological; each row has { tx, id, date, kind, delta, balance }.
 *          kind "implicit" is capital a purchase needed beyond the balance when the
 *          log records no deposits at all. A negative balance means purchases were
 *          recorded before (or without) the deposit that paid for them.
 */
export function buildCashLedger(transactions = []) {
  const cash = replayCash(transactions);
  return {
    rows: cash.rows.map(r => ({ ...r, id: r.tx.id })),
    balance: cash.balance,
    netDeposits: cash.netCapital,
    mode: cash.mode,
    implicitDeposits: cash.implicitDeposits,
    minBalance: cash.minBalance,
  };
}

/** Storage names are free text: "Binance", "binance " and "BINANCE" are one account. */
export const storageKey = (storage) => (storage || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Holdings per securities account (the transaction's `storage` field:
 * broker, exchange, fund platform…). Moving average cost per account.
 *
 * Account names are matched case-insensitively and shown in their most used
 * spelling. A sale larger than what its account holds takes the rest from the
 * other accounts holding the security (largest first), so the quantities per
 * account always add up to the portfolio holdings.
 *
 * @param {Array} transactions
 * @param {Array} portfolio  output of calculatePortfolio (for market prices)
 * @returns {Array<{ name, positions: Array, value, cost, pnl, txCount, transactions }>}
 */
export function calculateHoldingsByStorage(transactions = [], portfolio = []) {
  const priceOf = Object.fromEntries(portfolio.map(p => [p.ticker, p.marketPrice]));
  const classOf = Object.fromEntries(portfolio.map(p => [p.ticker, p.assetClass]));
  const accounts = new Map();

  const getAccount = (storage) => {
    const key = storageKey(storage);
    if (!accounts.has(key)) {
      accounts.set(key, { key, spellings: new Map(), positions: new Map(), txCount: 0, transactions: [] });
    }
    const acc = accounts.get(key);
    const spelling = (storage || '').trim().replace(/\s+/g, ' ') || UNKNOWN_STORAGE;
    acc.spellings.set(spelling, (acc.spellings.get(spelling) || 0) + 1);
    return acc;
  };
  const positionOf = (acc, ticker, assetClass) => {
    if (!acc.positions.has(ticker)) {
      acc.positions.set(ticker, { ticker, assetClass: assetClass || classOf[ticker] || 'Khác', qty: 0, totalCost: 0 });
    }
    return acc.positions.get(ticker);
  };
  const sellFrom = (pos, qty) => {
    const take = Math.min(qty, pos.qty);
    const avg = pos.qty > EPS ? pos.totalCost / pos.qty : 0;
    pos.qty -= take;
    pos.totalCost -= avg * take;
    if (pos.qty <= EPS) { pos.qty = 0; pos.totalCost = 0; }
    return take;
  };

  for (const tx of sortTransactions(transactions)) {
    const ticker = (tx.ticker || '').trim();
    const type = tx.transactionType;
    const acc = getAccount(tx.storage);
    acc.txCount += 1;
    acc.transactions.push(tx);
    if (!ticker || ticker === 'VNĐ') continue;
    if (type !== TX_TYPES.BUY && type !== TX_TYPES.SELL) continue;

    const pos = positionOf(acc, ticker, tx.assetClass);
    const qty = Math.abs(Number(tx.quantity) || 0);

    if (type === TX_TYPES.BUY) {
      pos.qty += qty;
      pos.totalCost += Math.abs(Number(tx.totalVND) || 0);
      continue;
    }

    let rest = qty - sellFrom(pos, qty);
    if (rest > EPS) {
      const others = Array.from(accounts.values())
        .filter(a => a !== acc && a.positions.get(ticker)?.qty > EPS)
        .sort((a, b) => b.positions.get(ticker).qty - a.positions.get(ticker).qty);
      for (const other of others) {
        if (rest <= EPS) break;
        rest -= sellFrom(other.positions.get(ticker), rest);
      }
    }
  }

  const displayName = (acc) => {
    let best = null;
    for (const [spelling, n] of acc.spellings) if (!best || n > best[1]) best = [spelling, n];
    return best ? best[0] : UNKNOWN_STORAGE;
  };

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
    const name = displayName(acc);
    return {
      name,
      spellings: acc.spellings.size > 1 ? Array.from(acc.spellings.keys()) : [name],
      positions, value, cost, pnl: value - cost, txCount: acc.txCount, transactions: acc.transactions,
    };
  }).sort((a, b) => b.value - a.value || b.txCount - a.txCount);
}
