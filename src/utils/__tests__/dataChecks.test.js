import { describe, it, expect } from 'vitest';
import { findDataIssues, positionBefore, oversellsIntroducedBy } from '../dataChecks';

const t = (id, date, transactionType, ticker, quantity, totalVND, storage = '') => ({
  id, date, transactionType, ticker, quantity, totalVND, storage,
  assetClass: ticker ? 'Tiền mặt USD' : 'Tiền mặt VNĐ',
});

const log = [
  t('d1', '01/12/2025 09:00:00', 'Nạp tiền', '', 5000000, 5000000),
  t('b1', '02/12/2025 22:31:41', 'Mua', 'USDT', 111.28, 111.28 * 25800, 'Binance'),
  t('s1', '02/12/2025 22:33:34', 'Bán', 'USDT', -116.48, 116.48 * 25765, 'binance'),
  t('b2', '03/02/2026 21:40:13', 'Mua', 'USDT', 350, 9341500, 'Binance'),
  t('d2', '03/02/2026 21:41:49', 'Nạp tiền', '', 13345000, 13345000),
  t('x1', '04/02/2026 10:00:00', 'Mua', '', 1, 1000),
];

describe('findDataIssues', () => {
  const issues = findDataIssues(log);
  const byKind = (kind) => issues.filter(i => i.kind === kind);

  it('reports sales larger than the position held', () => {
    const [oversell] = byKind('oversell');
    expect(oversell.level).toBe('warning');
    expect(oversell.txs.map(x => x.id)).toEqual(['s1']);
    expect(oversell.detail).toContain('116,48');
    expect(oversell.detail).toContain('111,28');
  });

  it('reports a negative cash stretch and the row that covered it', () => {
    const [negative] = byKind('negative-cash');
    expect(negative.txs.map(x => x.id)).toEqual(['b2', 'd2']);
    expect(negative.level).toBe('info');   // covered the same day
  });

  it('warns when the balance is still negative at the end', () => {
    const open = findDataIssues(log.filter(x => x.id !== 'd2')).filter(i => i.kind === 'negative-cash');
    expect(open).toHaveLength(1);
    expect(open[0].level).toBe('warning');
    expect(open[0].txs.map(x => x.id)).toEqual(['b2']);
  });

  it('notes storage names written in several ways and rows the engine ignores', () => {
    const [spelling] = byKind('storage-spelling');
    expect(spelling.title).toContain('Binance');
    expect(spelling.txs.map(x => x.id)).toEqual(['s1']);
    expect(byKind('ignored-row').map(i => i.txs[0].id)).toEqual(['x1']);
  });

  it('lists warnings before notes and finds nothing in a clean log', () => {
    expect(issues[0].level).toBe('warning');
    expect(issues[issues.length - 1].level).toBe('info');
    expect(findDataIssues(log.slice(0, 2))).toEqual([]);
  });
});

describe('transaction form helpers', () => {
  const txs = [
    t('d1', '01/01/2026 09:00:00', 'Nạp tiền', '', 10000000, 10000000),
    t('b1', '02/01/2026 09:00:00', 'Mua', 'VNM', 100, 5000000),
    t('b2', '10/01/2026 09:00:00', 'Mua', 'VNM', 100, 7000000),
    t('s1', '20/01/2026 09:00:00', 'Bán', 'VNM', -150, 9000000),
  ];

  it('prices a backdated sale with the average cost of its own date', () => {
    const early = positionBefore(txs, { date: '05/01/2026 09:00:00', ticker: 'vnm' });
    expect(early).toEqual({ qty: 100, avgCost: 50000, cash: 5000000 });
    const later = positionBefore(txs, { date: '15/01/2026 09:00:00', ticker: 'VNM' });
    expect(later.qty).toBe(200);
    expect(later.avgCost).toBe(60000);
  });

  it('leaves the edited row out of the position', () => {
    expect(positionBefore(txs, { date: '25/01/2026 09:00:00', ticker: 'VNM' }, 's1').qty).toBe(200);
  });

  it('blocks a backdated sale that would starve a later sale', () => {
    const sale = { date: '05/01/2026 09:00:00', transactionType: 'Bán', ticker: 'VNM', quantity: -80, totalVND: 4400000 };
    const problems = oversellsIntroducedBy(txs, sale);
    expect(problems.map(i => i.id)).toEqual(['s1']);   // 150 sold on 20/01 but only 120 left
  });

  it('allows editing a row that was already inconsistent without making it worse', () => {
    const bad = [...txs, t('s2', '21/01/2026 09:00:00', 'Bán', 'VNM', -60, 3600000)];
    const s2 = bad.find(x => x.id === 's2');
    expect(oversellsIntroducedBy(bad, { ...s2, notes: 'ghi chú mới' }, 's2')).toEqual([]);
    expect(oversellsIntroducedBy(bad, { ...s2, quantity: -70 }, 's2')).toHaveLength(1);
  });

  it('blocks shrinking a purchase that later sales depend on', () => {
    const b2 = txs.find(x => x.id === 'b2');
    expect(oversellsIntroducedBy(txs, { ...b2, quantity: 10, totalVND: 700000 }, 'b2')).toHaveLength(1);
  });
});
