import { describe, it, expect } from 'vitest';
import {
  buildValueSeries, buildCashFlows, clipSeries, computeTTWROR, solveIRR,
  computePeriodIRR, computeDrawdown, computeVolatility, computePeriodicReturns,
  replayTransactions, computeTrades, computeSecurityPerformance, computePeriodReport,
  computeMonthlyCashFlows,
} from '../performanceEngine';
import { resolvePeriod } from '../reportingPeriod';
import { daysBetween, toISO, addMonths } from '../dates';
import { mockTransactions, mockMarketPrices } from './mockData';
import { calculateHoldings, calculatePortfolio } from '../portfolioCalculator';

const close = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;

describe('dates', () => {
  it('converts Vietnamese dates to ISO and counts days', () => {
    expect(toISO('15/03/2026 10:00:00')).toBe('2026-03-15');
    expect(toISO('2026-03-15')).toBe('2026-03-15');
    expect(daysBetween('2025-01-01', '2026-01-01')).toBe(365);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('reporting period', () => {
  it('resolves presets relative to today', () => {
    const today = '2026-09-27';
    expect(resolvePeriod({ preset: '1Y' }, { today })).toEqual({ start: '2025-09-27', end: today, label: '1 năm' });
    expect(resolvePeriod({ preset: 'YTD' }, { today }).start).toBe('2025-12-31');
    expect(resolvePeriod({ preset: 'ALL' }, { today, firstDate: '2024-02-01' }).start).toBe('2024-02-01');
    expect(resolvePeriod({ preset: 'CUSTOM', customStart: '2026-01-01', customEnd: '2026-06-30' }, { today }))
      .toEqual({ start: '2026-01-01', end: '2026-06-30', label: 'Tùy chọn' });
  });
});

describe('TTWROR', () => {
  const snapshots = [
    { date: '2025-01-01', portfolioValue: 100 },
    { date: '2025-07-02', portfolioValue: 110 },
    { date: '2026-01-01', portfolioValue: 220 }, // includes a 100 deposit that day
  ];
  const transactions = [
    { date: '01/01/2025 09:00:00', transactionType: 'Nạp tiền', assetClass: 'Tiền mặt VNĐ', ticker: '', totalVND: 100 },
    { date: '01/01/2026 09:00:00', transactionType: 'Nạp tiền', assetClass: 'Tiền mặt VNĐ', ticker: '', totalVND: 100 },
  ];

  it('neutralises external cash flows', () => {
    const series = buildValueSeries(snapshots);
    const { byDate } = buildCashFlows(transactions);
    const res = computeTTWROR(series, byDate);
    // r1 = 10 %, r2 = (220 − 100) / 110 − 1 = 9.0909 % → cumulative 20 %
    expect(close(res.returns[0], 0.1)).toBe(true);
    expect(close(res.returns[1], 120 / 110 - 1)).toBe(true);
    expect(close(res.cumulative, 0.2)).toBe(true);
    expect(res.days).toBe(365);
    expect(close(res.annualized, 0.2)).toBe(true);
  });

  it('computes a full period report with IRR, delta and breakdown', () => {
    const report = computePeriodReport({ snapshots, transactions, start: '2025-01-01', end: '2026-01-01' });
    expect(report.hasData).toBe(true);
    expect(report.initialValue).toBe(100);
    expect(report.finalValue).toBe(220);
    expect(report.deposits).toBe(100);
    expect(report.withdrawals).toBe(0);
    expect(report.absoluteChange).toBe(120);
    expect(report.delta).toBe(20);
    expect(close(report.ttwror, 0.2)).toBe(true);
    // IRR: −100 at t=0, +120 net at t=1y → 20 %
    expect(close(report.irr, 0.2, 1e-6)).toBe(true);
    expect(report.capitalGains).toBe(20); // no realised gains / earnings
  });

  it('clips series to a period using the last point on/before the start as baseline', () => {
    const series = buildValueSeries(snapshots);
    const clipped = clipSeries(series, '2025-08-01', '2026-12-31');
    expect(clipped.map(p => p.date)).toEqual(['2025-07-02', '2026-01-01']);
    const clipped2 = clipSeries(series, '2024-01-01', '2025-07-02');
    expect(clipped2.map(p => p.date)).toEqual(['2025-01-01', '2025-07-02']);
  });
});

describe('IRR solver', () => {
  it('solves simple annual flows', () => {
    const r = solveIRR([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }]);
    expect(close(r, 0.1, 1e-8)).toBe(true);
  });
  it('solves multi-flow cases', () => {
    const r = solveIRR([
      { date: '2024-01-01', amount: -1000 },
      { date: '2025-01-01', amount: -1000 }, // 2024 is a leap year → t = 366/365
      { date: '2026-01-01', amount: 2300 },
    ]);
    // Verify NPV ≈ 0 at the solution
    const t1 = 366 / 365, t2 = 731 / 365;
    const npv = -1000 - 1000 / Math.pow(1 + r, t1) + 2300 / Math.pow(1 + r, t2);
    expect(Math.abs(npv) < 1e-6).toBe(true);
    expect(r > 0.09 && r < 0.11).toBe(true);
  });
  it('returns null when flows have one sign', () => {
    expect(solveIRR([{ date: '2025-01-01', amount: -1 }, { date: '2025-02-01', amount: -1 }])).toBeNull();
  });
  it('period IRR equals TTWROR when there are no interim flows', () => {
    const points = [{ date: '2025-01-01', value: 100 }, { date: '2026-01-01', value: 115 }];
    expect(close(computePeriodIRR(points, []), 0.15, 1e-8)).toBe(true);
  });
});

describe('risk metrics', () => {
  it('computes max drawdown and its duration', () => {
    const pts = [
      { date: '2025-01-01', index: 1.0 },
      { date: '2025-02-01', index: 1.2 },
      { date: '2025-03-01', index: 0.9 },
      { date: '2025-04-01', index: 1.0 },
      { date: '2025-05-01', index: 1.3 },
    ];
    const dd = computeDrawdown(pts);
    expect(close(dd.maxDrawdown, 0.25)).toBe(true);
    expect(dd.peakDate).toBe('2025-02-01');
    expect(dd.troughDate).toBe('2025-03-01');
    expect(dd.maxDurationDays).toBe(daysBetween('2025-02-01', '2025-05-01'));
  });
  it('computes volatility from returns', () => {
    const v = computeVolatility([0.01, -0.01, 0.02, -0.02], { annualize: false });
    // mean 0, sample variance = (1+1+4+4)e-4 / 3
    expect(close(v.volatility, Math.sqrt(10e-4 / 3))).toBe(true);
    expect(close(v.semiVolatility, Math.sqrt(5e-4 / 3))).toBe(true);
  });
  it('computes monthly and yearly returns from an index series', () => {
    const pts = [
      { date: '2025-01-05', index: 1.0 },
      { date: '2025-01-31', index: 1.1 },
      { date: '2025-02-28', index: 1.21 },
      { date: '2026-01-31', index: 1.21 * 1.05 },
    ];
    const { months, years } = computePeriodicReturns(pts);
    expect(close(months.get('2025-01'), 0.1)).toBe(true);
    expect(close(months.get('2025-02'), 0.1)).toBe(true);
    expect(close(months.get('2026-01'), 0.05)).toBe(true);
    expect(close(years.get('2025'), 0.21)).toBe(true);
    expect(close(years.get('2026'), 0.05)).toBe(true);
  });
});

describe('transaction replay', () => {
  const holdings = calculateHoldings(mockTransactions);
  const portfolio = calculatePortfolio(holdings, mockMarketPrices);

  it('produces closed trades with average-cost realised P&L', () => {
    const replay = replayTransactions(mockTransactions);
    expect(replay.trades).toHaveLength(1);
    const t = replay.trades[0];
    expect(t.ticker).toBe('FUEVN100');
    expect(t.start).toBe('2026-03-15');
    expect(t.end).toBe('2026-03-16');
    expect(t.days).toBe(1);
    expect(t.qty).toBe(200);
    expect(t.entryValue).toBe(5000000);
    expect(t.exitValue).toBe(5200000);
    expect(t.pnl).toBe(200000);
    expect(close(t.pnlPct, 0.04)).toBe(true);
    expect(replay.openPositions.map(p => p.ticker).sort()).toEqual(['BTC', 'FUEVN100', 'USDT']);
  });

  it('values open trades with the current portfolio', () => {
    const replay = replayTransactions(mockTransactions);
    const { open, closed } = computeTrades(replay, portfolio, '2026-04-15');
    expect(closed).toHaveLength(1);
    const fue = open.find(t => t.ticker === 'FUEVN100');
    expect(fue.entryValue).toBe(20000000);
    expect(fue.exitValue).toBe(24000000);
    expect(fue.pnl).toBe(4000000);
    expect(fue.days).toBe(daysBetween('2026-03-15', '2026-04-15'));
  });

  it('computes per-security performance with realised + unrealised + earnings', () => {
    const txs = [...mockTransactions, {
      assetClass: 'Cổ phiếu', currency: 'VNĐ', date: '20/03/2026 10:00:00',
      quantity: 800, unitPrice: 1250, totalVND: 1000000, ticker: 'FUEVN100', transactionType: 'Cổ tức'
    }];
    const replay = replayTransactions(txs);
    const rows = computeSecurityPerformance(replay, portfolio, '2026-04-15');
    const fue = rows.find(r => r.ticker === 'FUEVN100');
    expect(fue.realized).toBe(200000);
    expect(fue.earnings).toBe(1000000);
    expect(fue.unrealized).toBe(4000000);
    expect(fue.totalPnL).toBe(5200000);
    expect(fue.irr).not.toBeNull();
    expect(fue.irr > 0).toBe(true);
    expect(fue.isOpen).toBe(true);
  });

  it('only realizes the part of an oversold sale that was held', () => {
    const t = (date, transactionType, quantity, totalVND) => ({ date, transactionType, ticker: 'USDT', assetClass: 'Tiền mặt USD', quantity, totalVND, id: date });
    const replay = replayTransactions([
      t('02/12/2025 22:31:41', 'Mua', 111.28, 111.28 * 25800),
      t('02/12/2025 22:33:34', 'Bán', -116.48, 116.48 * 25765),
    ]);
    const trade = replay.trades[0];
    expect(trade.qty).toBeCloseTo(111.28, 9);
    expect(trade.exitValue).toBeCloseTo(111.28 * 25765, 6);
    expect(trade.pnl).toBeCloseTo(111.28 * (25765 - 25800), 6);   // not +5.2 × 25,765 of phantom profit
    expect(replay.issues).toHaveLength(1);
    expect(replay.issues[0]).toMatchObject({ kind: 'oversell', ticker: 'USDT', id: '02/12/2025 22:33:34' });
    expect(replay.issues[0].excessQty).toBeCloseTo(5.2, 9);
    expect(replay.issues[0].excessValue).toBeCloseTo(5.2 * 25765, 6);
    expect(replay.securities.USDT.realized).toBeCloseTo(trade.pnl, 9);
  });

  it('turns purchases of a trades-only log into implicit deposits for TTWROR', () => {
    const txs = [
      { date: '01/01/2026 09:00:00', transactionType: 'Mua', ticker: 'VNM', assetClass: 'Cổ phiếu', quantity: 10, totalVND: 100 },
      { date: '05/01/2026 09:00:00', transactionType: 'Mua', ticker: 'FPT', assetClass: 'Cổ phiếu', quantity: 1, totalVND: 50 },
    ];
    const { flows, byDate } = buildCashFlows(txs);
    expect(flows.map(f => [f.date, f.amount, f.implicit])).toEqual([['2026-01-01', 100, true], ['2026-01-05', 50, true]]);
    expect(byDate.get('2026-01-05')).toBe(50);
    // with explicit deposits there are no implicit flows
    expect(buildCashFlows(mockTransactions).flows.every(f => !f.implicit)).toBe(true);
  });

  it('aggregates cash flows by month', () => {
    const rows = computeMonthlyCashFlows(mockTransactions);
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe('2026-03');
    expect(rows[0].deposits).toBe(100000000);
    expect(rows[0].buys).toBe(25000000 + 25500000 + 17850000);
    expect(rows[0].sells).toBe(5200000);
  });
});
