import { describe, it, expect } from 'vitest';
import { replayTransactions } from '../performanceEngine.js';
import { buildSecurityChartData, avgCostOn } from '../securityChart.js';

const tx = (date, type, quantity, totalVND) => ({ date, transactionType: type, ticker: 'FPT', assetClass: 'Cổ phiếu', quantity, totalVND });
const log = replayTransactions([
  tx('01/01/2025 10:00:00', 'Mua', 100, 10000000),
  tx('01/02/2025 10:00:00', 'Mua', 100, 12000000),
  tx('01/03/2025 10:00:00', 'Bán', -50, 6500000),
  tx('01/04/2025 10:00:00', 'Bán', -150, 18000000),
  tx('01/05/2025 10:00:00', 'Mua', 10, 1300000),
]).securities.FPT.log;

describe('security trade chart data', () => {
  it('logs each trade with its unit price and the average cost after it', () => {
    expect(log.map(t => [t.side, t.price, t.avgCost, t.qtyAfter])).toEqual([
      ['buy', 100000, 100000, 100], ['buy', 120000, 110000, 200],
      ['sell', 130000, 110000, 150], ['sell', 120000, 110000, 0], ['buy', 130000, 130000, 10],
    ]);
  });

  it('draws average cost as steps, broken while nothing is held', () => {
    const c = buildSecurityChartData(log, [], { today: '2025-06-01' });
    expect(c.avgSegments).toEqual([
      [
        { date: '2025-01-01', value: 100000 }, { date: '2025-02-01', value: 100000 },
        { date: '2025-02-01', value: 110000 }, { date: '2025-03-01', value: 110000 },
        { date: '2025-04-01', value: 110000 },
      ],
      [{ date: '2025-05-01', value: 130000 }, { date: '2025-06-01', value: 130000 }],
    ]);
    expect(avgCostOn(log, '2025-02-15')).toBe(110000);
    expect(avgCostOn(log, '2025-04-15')).toBeNull();
  });

  it('starts the price line at the first trade and ends it at the current price', () => {
    const prices = [{ date: '2024-12-20', value: 99000 }, { date: '2025-03-10', value: 125000 }, { date: '2025-06-01', value: 128000 }];
    const c = buildSecurityChartData(log, prices, { today: '2025-06-01', currentPrice: 131000 });
    expect(c.price).toEqual([
      { date: '2025-01-01', value: 99000 }, { date: '2025-03-10', value: 125000 }, { date: '2025-06-01', value: 131000 },
    ]);
  });

  it('returns null without trades', () => {
    expect(buildSecurityChartData([], [], { today: '2025-06-01' })).toBeNull();
  });
});
