import { describe, it, expect } from 'vitest';
import { resolveMarketPrices, latestOnOrBefore, mergePriceSeries, securityFeeds, FEEDS } from '../priceResolver';
import { calculateHoldings, calculatePortfolio } from '../portfolioCalculator';

const SYSTEM = { VNM: { price: 70000 }, USDT: { price: 25500, exchangeRate: 25500 } };
const SECURITIES = [
  { ticker: 'NHAN9999', feed: 'MANUAL' },
  { ticker: 'VNM', feed: 'AUTO' },
  { ticker: 'USDT', feed: 'MANUAL' },
];
const USER = {
  NHAN9999: { '2026-09-01': 8400000, '2026-09-20': 8450000, '2026-10-01': 9000000 },
  VNM: { '2026-09-20': 71000 },
  FPT: { '2026-09-10': 120000 },
  USDT: { '2026-09-01': 26000 },
};

describe('priceResolver', () => {
  it('finds the latest price on or before a date', () => {
    expect(latestOnOrBefore(USER.NHAN9999, '2026-09-27')).toEqual({ date: '2026-09-20', price: 8450000 });
    expect(latestOnOrBefore(USER.NHAN9999, '2026-08-01')).toBeNull();
  });

  it('lets MANUAL prices win and AUTO prices only fill gaps (same rules as the backend)', () => {
    const prices = resolveMarketPrices(SYSTEM, SECURITIES, USER, '2026-09-27');
    expect(prices.NHAN9999).toEqual({ price: 8450000, date: '2026-09-20', source: 'user' });
    expect(prices.VNM).toEqual({ price: 70000 });
    expect(prices.FPT.price).toBe(120000);
    expect(prices.USDT.exchangeRate).toBe(26000);
    expect(SYSTEM.VNM).toEqual({ price: 70000 });
  });

  it('values a manually priced asset instead of falling back to cost', () => {
    const txs = [
      { date: '01/09/2026 09:00:00', transactionType: 'Nạp tiền', assetClass: 'Tiền mặt VNĐ', ticker: '', quantity: 20000000, totalVND: 20000000 },
      { date: '02/09/2026 09:00:00', transactionType: 'Mua', assetClass: 'Vàng', ticker: 'NHAN9999', quantity: 2, totalVND: 16800000 },
    ];
    const holdings = calculateHoldings(txs);
    const atCost = calculatePortfolio(holdings, SYSTEM).find(p => p.ticker === 'NHAN9999');
    expect(atCost.pnl).toBe(0);
    const priced = calculatePortfolio(holdings, resolveMarketPrices(SYSTEM, SECURITIES, USER, '2026-09-27'))
      .find(p => p.ticker === 'NHAN9999');
    expect(priced.actualValue).toBe(16900000);
    expect(priced.pnl).toBe(100000);
  });

  it('merges system and user series for charts', () => {
    const system = [{ date: '2026-09-01', value: 100 }, { date: '2026-09-02', value: 101 }];
    const user = { '2026-09-02': 200, '2026-09-03': 202 };
    expect(mergePriceSeries(system, user, FEEDS.AUTO).map(p => [p.date, p.value, p.source])).toEqual([
      ['2026-09-01', 100, 'system'], ['2026-09-02', 101, 'system'], ['2026-09-03', 202, 'user'],
    ]);
    expect(mergePriceSeries(system, user, FEEDS.MANUAL).find(p => p.date === '2026-09-02').value).toBe(200);
  });

  it('normalises feed ids', () => {
    expect(securityFeeds([{ id: 'abc', feed: 'manual' }, { ticker: 'X' }])).toEqual({ ABC: 'MANUAL', X: 'AUTO' });
  });
});

import { parseInputNumber } from '../formatters';

describe('parseInputNumber', () => {
  it('reads Vietnamese and international input', () => {
    expect(parseInputNumber('8.450.000')).toBe(8450000);
    expect(parseInputNumber('8,450,000')).toBe(8450000);
    expect(parseInputNumber('8450000 ₫')).toBe(8450000);
    expect(parseInputNumber('25,5')).toBe(25.5);
    expect(parseInputNumber('25.5')).toBe(25.5);
    expect(parseInputNumber('1.234,56')).toBe(1234.56);
    expect(Number.isNaN(parseInputNumber('abc'))).toBe(true);
    expect(Number.isNaN(parseInputNumber(''))).toBe(true);
  });
});
