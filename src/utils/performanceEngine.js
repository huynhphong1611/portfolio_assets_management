/**
 * Performance Engine — Portfolio Performance style metrics.
 *
 * Inputs are the data the app already stores:
 *   - daily snapshots  → value series  (portfolioValue = securities + cash)
 *   - transactions     → external cash flows (Nạp tiền / Rút tiền), trades, earnings
 *
 * Metrics (naming follows Portfolio Performance):
 *   - TTWROR   True time-weighted rate of return (cumulative and annualised)
 *   - IRR      Internal rate of return (money-weighted, annualised)
 *   - Absolute change, Delta (change net of deposits/withdrawals)
 *   - Max drawdown (+ duration), Volatility, Semi-volatility
 *   - Monthly / yearly returns (heatmap), performance calculation breakdown
 *   - Trades (closed / open), per-security performance, payments (earnings)
 *
 * All money values are VND. All rates are fractions (0.1 = 10 %).
 */
import { toISO, toISODate, daysBetween, monthKey, todayISO } from './dates.js';
import { TX_TYPES, replayCash, sortTransactions } from './portfolioCalculator.js';

const EPS = 1e-4;
const TRADING_DAYS = 252;

// ============================================================
// SERIES
// ============================================================

/**
 * Build a sorted, de-duplicated value series from snapshots.
 * @returns {Array<{date: string, value: number}>}
 */
export function buildValueSeries(snapshots = [], valueKey = 'portfolioValue') {
  const byDate = new Map();
  for (const s of snapshots) {
    if (!s || !s.date) continue;
    const v = Number(s[valueKey]);
    if (!Number.isFinite(v)) continue;
    byDate.set(toISO(s.date), v);
  }
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * External cash flows (investor ↔ portfolio), by ISO date.
 * Deposits are positive, withdrawals negative. For a log without any deposit
 * or withdrawal (trades-only import), purchases that needed more cash than the
 * account held count as capital paid in (see replayCash).
 * @returns {{ byDate: Map<string, number>, flows: Array<{date, amount, type, storage, notes, id, implicit}> }}
 */
export function buildCashFlows(transactions = []) {
  const byDate = new Map();
  const flows = [];
  for (const f of replayCash(transactions).flows) {
    byDate.set(f.date, (byDate.get(f.date) || 0) + f.amount);
    flows.push({
      date: f.date, amount: f.amount,
      type: f.kind === 'implicit' ? TX_TYPES.DEPOSIT : f.tx.transactionType,
      storage: f.tx.storage || '', notes: f.tx.notes || '', id: f.tx.id,
      implicit: f.kind === 'implicit',
    });
  }
  flows.sort((a, b) => a.date.localeCompare(b.date));
  return { byDate, flows };
}

/**
 * Clip a series to a reporting period.
 * The baseline is the last point on/before `start` (or the first point after it).
 * Returns points [baseline, ...points in (baseline, end]].
 */
export function clipSeries(series, start, end) {
  if (!series.length) return [];
  let baselineIdx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].date <= start) baselineIdx = i; else break;
  }
  if (baselineIdx === -1) {
    baselineIdx = series.findIndex(p => p.date >= start);
    if (baselineIdx === -1) return [];
  }
  const baseline = series[baselineIdx];
  const rest = series.slice(baselineIdx + 1).filter(p => p.date <= end);
  return [baseline, ...rest];
}

/** Sum of flows with date in (after, upTo]. */
function flowsBetween(flowsByDate, after, upTo) {
  let sum = 0;
  for (const [date, amount] of flowsByDate) {
    if (date > after && date <= upTo) sum += amount;
  }
  return sum;
}

// ============================================================
// TTWROR
// ============================================================

/**
 * True time-weighted rate of return over a (clipped) series.
 * Each interval return: r = (V_t − CF_t) / V_{t−1} − 1, where CF_t are the
 * external flows in (t−1, t]. Flows are therefore neutralised.
 */
export function computeTTWROR(points, flowsByDate = new Map()) {
  if (!points || points.length === 0) {
    return { points: [], cumulative: 0, annualized: null, days: 0, returns: [] };
  }
  const out = [{ ...points[0], flow: 0, r: 0, index: 1 }];
  const returns = [];
  let index = 1;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const flow = flowsBetween(flowsByDate, prev.date, cur.date);
    let r = 0;
    if (prev.value > EPS) {
      r = (cur.value - flow) / prev.value - 1;
    }
    if (!Number.isFinite(r)) r = 0;
    index *= (1 + r);
    returns.push(r);
    out.push({ ...cur, flow, r, index });
  }
  const days = daysBetween(points[0].date, points[points.length - 1].date);
  const cumulative = index - 1;
  const annualized = days > 0 && index > 0 ? Math.pow(index, 365 / days) - 1 : null;
  return { points: out, cumulative, annualized, days, returns };
}

// ============================================================
// IRR (money-weighted)
// ============================================================

/**
 * Solve the annual internal rate of return for dated cash flows.
 * @param {Array<{date: string, amount: number}>} cashflows — investor view:
 *        money paid in is negative, money received (and final value) positive.
 * @returns {number|null}
 */
export function solveIRR(cashflows) {
  const flows = (cashflows || []).filter(c => Number.isFinite(c.amount) && c.amount !== 0 && c.date);
  if (flows.length < 2) return null;
  const hasNeg = flows.some(c => c.amount < 0);
  const hasPos = flows.some(c => c.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = flows.reduce((m, c) => (c.date < m ? c.date : m), flows[0].date);
  const items = flows.map(c => ({ t: daysBetween(t0, c.date) / 365, a: c.amount }));
  const scale = flows.reduce((s, c) => s + Math.abs(c.amount), 0) || 1;

  const npv = (r) => items.reduce((s, c) => s + c.a / Math.pow(1 + r, c.t), 0);
  const dnpv = (r) => items.reduce((s, c) => s - c.t * c.a / Math.pow(1 + r, c.t + 1), 0);

  // Newton–Raphson
  let r = 0.1;
  for (let i = 0; i < 60; i++) {
    const y = npv(r);
    const dy = dnpv(r);
    if (!Number.isFinite(y) || !Number.isFinite(dy) || dy === 0) break;
    const next = r - y / dy;
    if (!Number.isFinite(next) || next <= -0.9999 || next > 1e6) break;
    if (Math.abs(next - r) < 1e-10) {
      return Math.abs(npv(next)) / scale < 1e-6 ? next : bisect();
    }
    r = next;
  }
  return bisect();

  function bisect() {
    let lo = -0.9999, hi = 10;
    let flo = npv(lo), fhi = npv(hi);
    if (!(flo * fhi < 0)) { hi = 1e4; fhi = npv(hi); }
    if (!(flo * fhi < 0)) return null;
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2;
      const fm = npv(mid);
      if (!Number.isFinite(fm)) return null;
      if (Math.abs(fm) / scale < 1e-9 || hi - lo < 1e-10) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  }
}

/**
 * IRR of a reporting period: −initial value, −deposits/+withdrawals, +final value.
 */
export function computePeriodIRR(points, flows = []) {
  if (!points || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const cf = [{ date: first.date, amount: -first.value }];
  for (const f of flows) {
    if (f.date > first.date && f.date <= last.date) cf.push({ date: f.date, amount: -f.amount });
  }
  cf.push({ date: last.date, amount: last.value });
  return solveIRR(cf);
}

// ============================================================
// RISK
// ============================================================

/** Max drawdown of a TTWROR index series. */
export function computeDrawdown(indexPoints = []) {
  let peak = -Infinity, peakDate = null;
  let maxDD = 0, ddPeakDate = null, ddTroughDate = null;
  let maxDuration = 0, durPeakDate = null, durEndDate = null;
  let curPeakDate = null;

  for (const p of indexPoints) {
    const v = p.index ?? p.value;
    if (v > peak) {
      // recovered to a new high → close the current drawdown episode
      if (curPeakDate) {
        const d = daysBetween(curPeakDate, p.date);
        if (d > maxDuration) { maxDuration = d; durPeakDate = curPeakDate; durEndDate = p.date; }
      }
      peak = v; peakDate = p.date; curPeakDate = p.date;
      continue;
    }
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDD) { maxDD = dd; ddPeakDate = peakDate; ddTroughDate = p.date; }
  }
  // still under water at the end of the series
  if (curPeakDate && indexPoints.length) {
    const lastDate = indexPoints[indexPoints.length - 1].date;
    const d = daysBetween(curPeakDate, lastDate);
    if (d > maxDuration) { maxDuration = d; durPeakDate = curPeakDate; durEndDate = lastDate; }
  }
  return { maxDrawdown: maxDD, peakDate: ddPeakDate, troughDate: ddTroughDate, maxDurationDays: maxDuration, durationStart: durPeakDate, durationEnd: durEndDate };
}

/**
 * Volatility = sample standard deviation of interval returns (annualised with √252,
 * assuming daily observations). Semi-volatility uses only returns below the mean.
 */
export function computeVolatility(returns = [], { annualize = true } = {}) {
  const n = returns.length;
  if (n < 2) return { volatility: null, semiVolatility: null, observations: n };
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  let ss = 0, ssDown = 0, nDown = 0;
  for (const r of returns) {
    const d = r - mean;
    ss += d * d;
    if (d < 0) { ssDown += d * d; nDown++; }
  }
  const factor = annualize ? Math.sqrt(TRADING_DAYS) : 1;
  const vol = Math.sqrt(ss / (n - 1)) * factor;
  const semi = nDown > 0 ? Math.sqrt(ssDown / (n - 1)) * factor : 0;
  return { volatility: vol, semiVolatility: semi, observations: n };
}

// ============================================================
// PERIODIC RETURNS (heatmap)
// ============================================================

/**
 * Returns per calendar month and year from a full TTWROR index series.
 * @returns {{ months: Map<string, number>, years: Map<string, number> }}
 */
export function computePeriodicReturns(indexPoints = []) {
  const months = new Map();
  const years = new Map();
  if (!indexPoints.length) return { months, years };

  const lastByMonth = new Map();
  const lastByYear = new Map();
  for (const p of indexPoints) {
    lastByMonth.set(monthKey(p.date), p.index);
    lastByYear.set(p.date.slice(0, 4), p.index);
  }
  const firstIndex = indexPoints[0].index;

  let prev = firstIndex;
  for (const [k, idx] of Array.from(lastByMonth.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    months.set(k, prev > 0 ? idx / prev - 1 : 0);
    prev = idx;
  }
  prev = firstIndex;
  for (const [k, idx] of Array.from(lastByYear.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    years.set(k, prev > 0 ? idx / prev - 1 : 0);
    prev = idx;
  }
  return { months, years };
}

// ============================================================
// TRANSACTION REPLAY (trades, realized gains, earnings)
// ============================================================

/**
 * Replay transactions with the same average-cost model as calculateHoldings,
 * recording every realised trade, earnings payment and open position.
 * Realized P&L of a sale = proceeds − avgCost × qty sold. A sale larger than the
 * position only realizes the part that was held; the rest is listed in `issues`.
 */
export function replayTransactions(transactions = []) {
  const sorted = sortTransactions(transactions);
  const positions = {};
  const trades = [];
  const earnings = [];
  const securities = {};
  const issues = [];

  const ensureSec = (ticker, assetClass, currency) => {
    if (!securities[ticker]) {
      securities[ticker] = {
        ticker, assetClass: assetClass || 'Khác', currency: currency || 'VNĐ',
        buys: [], sells: [], earnings: [], log: [], realized: 0, earningsTotal: 0,
        grossBuy: 0, grossSell: 0, firstDate: null, lastDate: null, storages: new Set(),
      };
    }
    const s = securities[ticker];
    if (assetClass && s.assetClass === 'Khác') s.assetClass = assetClass;
    return s;
  };

  for (const tx of sorted) {
    const type = tx.transactionType;
    const ticker = (tx.ticker || '').trim();
    const date = toISO(tx.date);
    const amount = Math.abs(Number(tx.totalVND) || 0);
    const qty = Math.abs(Number(tx.quantity) || 0);

    if (type === TX_TYPES.EARNINGS) {
      const key = ticker && ticker !== 'VNĐ' ? ticker : 'VNĐ';
      earnings.push({ date, ticker: key, amount, assetClass: tx.assetClass || '', storage: tx.storage || '', notes: tx.notes || '', id: tx.id });
      if (key !== 'VNĐ') {
        const s = ensureSec(key, tx.assetClass, tx.currency);
        s.earnings.push({ date, amount });
        s.earningsTotal += amount;
      }
      continue;
    }
    if (!ticker || ticker === 'VNĐ') continue; // deposits / withdrawals are handled by buildCashFlows

    const s = ensureSec(ticker, tx.assetClass, tx.currency);
    if (tx.storage) s.storages.add(tx.storage);
    s.firstDate = s.firstDate || date;
    s.lastDate = date;

    if (type === TX_TYPES.BUY) {
      if (!positions[ticker] || positions[ticker].qty <= EPS) {
        positions[ticker] = { ticker, qty: 0, totalCost: 0, openDate: date, assetClass: tx.assetClass || 'Khác' };
      }
      const pos = positions[ticker];
      pos.qty += qty;
      pos.totalCost += amount;
      s.buys.push({ date, amount, qty });
      s.grossBuy += amount;
      s.log.push({ date, side: 'buy', qty, amount, price: qty > 0 ? amount / qty : 0, avgCost: pos.totalCost / pos.qty, qtyAfter: pos.qty });
    } else if (type === TX_TYPES.SELL) {
      const pos = positions[ticker];
      const held = pos && pos.qty > EPS ? pos.qty : 0;
      // Only the quantity actually held has a cost basis. The excess of an
      // oversold sale is a data issue: its proceeds are not a realized gain.
      const sellQty = Math.min(qty, held);
      const exitValue = qty > 0 ? amount * (sellQty / qty) : 0;
      if (qty - sellQty > EPS) {
        issues.push({
          kind: 'oversell', tx, id: tx.id, ticker, date, dateTime: tx.date,
          qty, held, excessQty: qty - sellQty, excessValue: amount - exitValue,
        });
      }
      if (sellQty <= EPS) continue;
      s.sells.push({ date, amount: exitValue, qty: sellQty });
      s.grossSell += exitValue;
      const avgCost = pos.totalCost / pos.qty;
      const costBasis = avgCost * sellQty;
      const pnl = exitValue - costBasis;
      const holdingDays = Math.max(0, daysBetween(pos.openDate, date));
      trades.push({
        ticker, assetClass: pos.assetClass, status: 'closed',
        start: pos.openDate, end: date, days: holdingDays,
        qty: sellQty, avgCost, entryValue: costBasis, exitValue, pnl,
        pnlPct: costBasis > 0 ? pnl / costBasis : 0,
        annualized: annualizedReturn(costBasis, exitValue, holdingDays),
        storage: tx.storage || '', notes: tx.notes || '', id: tx.id,
      });
      s.realized += pnl;
      pos.qty -= sellQty;
      pos.totalCost -= costBasis;
      if (pos.qty <= EPS) { pos.qty = 0; pos.totalCost = 0; pos.openDate = null; }
      s.log.push({ date, side: 'sell', qty: sellQty, amount: exitValue, price: exitValue / sellQty, avgCost, qtyAfter: pos.qty });
    }
  }

  const openPositions = Object.values(positions)
    .filter(p => p.qty > EPS)
    .map(p => ({ ...p, avgCost: p.totalCost / p.qty }));

  for (const s of Object.values(securities)) s.storages = Array.from(s.storages);

  return { trades, earnings, openPositions, securities, issues };
}

function annualizedReturn(entry, exit, days) {
  if (!(entry > 0) || !(exit > 0)) return null;
  if (days < 1) return null;
  return Math.pow(exit / entry, 365 / days) - 1;
}

/** Closed trades + open trades (valued with the current portfolio). */
export function computeTrades(replay, portfolio = [], today = todayISO()) {
  const byTicker = Object.fromEntries(portfolio.map(p => [p.ticker, p]));
  const open = replay.openPositions.map(p => {
    const cur = byTicker[p.ticker];
    const marketValue = cur ? cur.actualValue : p.totalCost;
    const days = Math.max(0, daysBetween(p.openDate, today));
    const pnl = marketValue - p.totalCost;
    return {
      ticker: p.ticker, assetClass: cur?.assetClass || p.assetClass, status: 'open',
      start: p.openDate, end: null, days,
      qty: p.qty, entryValue: p.totalCost, exitValue: marketValue, pnl,
      pnlPct: p.totalCost > 0 ? pnl / p.totalCost : 0,
      annualized: annualizedReturn(p.totalCost, marketValue, days),
      storage: cur?.storage || '',
    };
  });
  return { closed: [...replay.trades].sort((a, b) => b.end.localeCompare(a.end)), open };
}

/**
 * Per-security performance (PP → Reports → Performance → Securities).
 */
export function computeSecurityPerformance(replay, portfolio = [], today = todayISO()) {
  const byTicker = Object.fromEntries(portfolio.map(p => [p.ticker, p]));
  const rows = [];
  const tickers = new Set([...Object.keys(replay.securities), ...portfolio.map(p => p.ticker).filter(t => t !== 'VNĐ')]);

  for (const ticker of tickers) {
    const s = replay.securities[ticker] || { buys: [], sells: [], earnings: [], log: [], realized: 0, earningsTotal: 0, grossBuy: 0, grossSell: 0, assetClass: 'Khác', firstDate: null, lastDate: null, storages: [] };
    const cur = byTicker[ticker];
    const marketValue = cur ? cur.actualValue : 0;
    const purchaseValue = cur ? cur.totalCost : 0;
    const unrealized = marketValue - purchaseValue;
    const totalPnL = unrealized + s.realized + s.earningsTotal;

    const cf = [];
    for (const b of s.buys) cf.push({ date: b.date, amount: -b.amount });
    for (const x of s.sells) cf.push({ date: x.date, amount: x.amount });
    for (const e of s.earnings) cf.push({ date: e.date, amount: e.amount });
    if (marketValue > EPS) cf.push({ date: today, amount: marketValue });
    const irr = cf.length >= 2 ? solveIRR(cf) : null;

    const openPos = replay.openPositions.find(p => p.ticker === ticker);
    const holdingDays = openPos ? daysBetween(openPos.openDate, today)
      : (s.firstDate && s.lastDate ? daysBetween(s.firstDate, s.lastDate) : 0);

    rows.push({
      ticker,
      assetClass: cur?.assetClass || s.assetClass,
      currency: cur?.currency || s.currency || 'VNĐ',
      storage: cur?.storage || s.storages?.[0] || '',
      qty: cur?.qty || 0,
      marketPrice: cur?.marketPrice || 0,
      avgCost: cur?.avgCost || 0,
      marketValue, purchaseValue,
      unrealized, unrealizedPct: purchaseValue > 0 ? unrealized / purchaseValue : 0,
      realized: s.realized,
      earnings: s.earningsTotal,
      totalPnL,
      totalPnLPct: s.grossBuy > 0 ? totalPnL / s.grossBuy : 0,
      grossBuy: s.grossBuy, grossSell: s.grossSell,
      irr,
      holdingDays,
      isOpen: (cur?.qty || 0) > EPS,
      firstDate: s.firstDate, lastDate: s.lastDate,
    });
  }
  return rows.sort((a, b) => b.marketValue - a.marketValue);
}

// ============================================================
// PAYMENTS / CASH FLOWS BY MONTH
// ============================================================

export function computeMonthlyCashFlows(transactions = []) {
  const months = new Map();
  const get = (k) => {
    if (!months.has(k)) months.set(k, { month: k, deposits: 0, withdrawals: 0, earnings: 0, buys: 0, sells: 0 });
    return months.get(k);
  };
  for (const t of transactions) {
    if (!t) continue;
    const k = monthKey(toISO(t.date));
    const amt = Math.abs(Number(t.totalVND) || 0);
    const row = get(k);
    switch (t.transactionType) {
      case TX_TYPES.DEPOSIT:  row.deposits += amt; break;
      case TX_TYPES.REMOVAL:  row.withdrawals += amt; break;
      case TX_TYPES.EARNINGS: row.earnings += amt; break;
      case TX_TYPES.BUY:      row.buys += amt; break;
      case TX_TYPES.SELL:     row.sells += amt; break;
      default: break;
    }
  }
  return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================================
// FULL PERIOD REPORT
// ============================================================

/**
 * Everything the Dashboard / Performance views need for one reporting period.
 */
export function computePeriodReport({ snapshots = [], transactions = [], start, end, valueKey = 'portfolioValue' }) {
  const series = buildValueSeries(snapshots, valueKey);
  const { byDate: flowsByDate, flows } = buildCashFlows(transactions);
  const points = clipSeries(series, start, end);
  const ttwror = computeTTWROR(points, flowsByDate);

  const first = points[0] || null;
  const last = points[points.length - 1] || null;
  const initialValue = first ? first.value : 0;
  const finalValue = last ? last.value : 0;

  const periodFlows = first && last ? flows.filter(f => f.date > first.date && f.date <= last.date) : [];
  const deposits = periodFlows.filter(f => f.amount > 0).reduce((s, f) => s + f.amount, 0);
  const withdrawals = periodFlows.filter(f => f.amount < 0).reduce((s, f) => s - f.amount, 0);
  const implicitDeposits = periodFlows.filter(f => f.implicit).reduce((s, f) => s + f.amount, 0);
  const transferals = deposits - withdrawals;

  const replay = replayTransactions(transactions);
  const inPeriod = (d) => first && last && d > first.date && d <= last.date;
  const realizedGains = replay.trades.filter(t => inPeriod(t.end)).reduce((s, t) => s + t.pnl, 0);
  const earnings = replay.earnings.filter(e => inPeriod(e.date)).reduce((s, e) => s + e.amount, 0);

  const absoluteChange = finalValue - initialValue;
  const delta = absoluteChange - transferals;
  const capitalGains = delta - realizedGains - earnings;

  const irr = computePeriodIRR(points, flows);
  const drawdown = computeDrawdown(ttwror.points);
  const risk = computeVolatility(ttwror.returns);

  // Heatmap over the whole history (independent of the period)
  const fullTTWROR = computeTTWROR(series, flowsByDate);
  const periodic = computePeriodicReturns(fullTTWROR.points);

  return {
    start, end, points, series, flows, periodFlows, replay,
    initialValue, finalValue, deposits, withdrawals, implicitDeposits, transferals,
    realizedGains, earnings, capitalGains, absoluteChange, delta,
    ttwror: ttwror.cumulative, ttwrorAnnualized: ttwror.annualized, ttwrorPoints: ttwror.points, days: ttwror.days,
    irr,
    maxDrawdown: drawdown.maxDrawdown, drawdown,
    volatility: risk.volatility, semiVolatility: risk.semiVolatility, observations: risk.observations,
    monthlyReturns: periodic.months, yearlyReturns: periodic.years,
    hasData: points.length >= 2,
  };
}

/** Convenience: today's ISO date (re-exported so views import one module). */
export { toISODate };
