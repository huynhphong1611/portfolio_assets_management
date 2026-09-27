import { describe, it, expect } from 'vitest';
import { buildCashLedger, calculateHoldingsByStorage, UNKNOWN_STORAGE } from '../accounts';
import { calculateHoldings, calculatePortfolio } from '../portfolioCalculator';
import { mockTransactions, mockMarketPrices } from './mockData';

const extra = [
  { assetClass: 'Cổ phiếu', currency: 'VNĐ', date: '20/03/2026 10:00:00', quantity: 800, unitPrice: 1250,
    totalVND: 1000000, ticker: 'FUEVN100', transactionType: 'Cổ tức', storage: 'TCBS' },
  { assetClass: 'Tiền mặt VNĐ', currency: 'VNĐ', date: '21/03/2026 10:00:00', quantity: 5000000, unitPrice: 1,
    totalVND: 5000000, ticker: '', transactionType: 'Rút tiền', storage: 'Techcombank' },
  // A purchase larger than the cash balance: the balance goes negative (it is never floored at 0)
  { assetClass: 'Cổ phiếu', currency: 'VNĐ', date: '22/03/2026 10:00:00', quantity: 10000, unitPrice: 10000,
    totalVND: 100000000, ticker: 'VNM', transactionType: 'Mua', storage: 'SSI' },
];

describe('buildCashLedger', () => {
  it('reconciles with the VNĐ holding of calculateHoldings', () => {
    for (const txs of [mockTransactions, [...mockTransactions, ...extra]]) {
      const ledger = buildCashLedger(txs);
      const cash = calculateHoldings(txs).find(h => h.ticker === 'VNĐ');
      expect(ledger.balance).toBeCloseTo(cash ? cash.qty : 0, 6);
    }
  });

  it('tracks running balances and net deposits', () => {
    const ledger = buildCashLedger([...mockTransactions, ...extra]);
    const balances = ledger.rows.map(r => r.balance);
    expect(balances[0]).toBe(100000000);
    expect(ledger.netDeposits).toBe(95000000);
    expect(ledger.mode).toBe('tracked');
    // 36.85M + 1M dividend − 5M withdrawal − 100M purchase
    const last = ledger.rows[ledger.rows.length - 1];
    expect(last.kind).toBe('buy');
    expect(last.delta).toBe(-100000000);
    expect(last.balance).toBe(-67150000);
    expect(ledger.minBalance).toBe(-67150000);
  });

  it('books implicit capital when the log has no deposits at all', () => {
    const txs = [
      { date: '01/01/2026 09:00:00', transactionType: 'Mua', ticker: 'VNM', assetClass: 'Cổ phiếu', quantity: 10, totalVND: 100 },
      { date: '02/01/2026 09:00:00', transactionType: 'Bán', ticker: 'VNM', assetClass: 'Cổ phiếu', quantity: -10, totalVND: 120 },
      { date: '03/01/2026 09:00:00', transactionType: 'Mua', ticker: 'FPT', assetClass: 'Cổ phiếu', quantity: 1, totalVND: 150 },
    ];
    const ledger = buildCashLedger(txs);
    expect(ledger.mode).toBe('implicit');
    expect(ledger.rows.map(r => r.kind)).toEqual(['implicit', 'buy', 'sell', 'implicit', 'buy']);
    expect(ledger.implicitDeposits).toBe(130);   // 100 + (150 − 120)
    expect(ledger.netDeposits).toBe(130);
    expect(ledger.balance).toBe(0);
    expect(ledger.minBalance).toBe(0);
  });
});

describe('calculateHoldingsByStorage', () => {
  it('splits holdings per storage and values them with market prices', () => {
    const portfolio = calculatePortfolio(calculateHoldings(mockTransactions), mockMarketPrices);
    const accounts = calculateHoldingsByStorage(mockTransactions, portfolio);
    const tcbs = accounts.find(a => a.name === 'TCBS');
    const binance = accounts.find(a => a.name === 'Binance');
    expect(tcbs.positions).toHaveLength(1);
    expect(tcbs.positions[0].qty).toBe(800);
    expect(tcbs.value).toBe(24000000);
    expect(tcbs.cost).toBe(20000000);
    expect(binance.positions.map(p => p.ticker).sort()).toEqual(['BTC', 'USDT']);
    expect(accounts.find(a => a.name === 'Techcombank').positions).toHaveLength(0);
    // total over accounts = total securities value of the portfolio
    const total = accounts.reduce((s, a) => s + a.value, 0);
    const securities = portfolio.filter(p => p.ticker !== 'VNĐ').reduce((s, p) => s + p.actualValue, 0);
    expect(total).toBeCloseTo(securities, 6);
  });

  it('matches storage names case-insensitively and shows the most used spelling', () => {
    const txs = [
      { date: '01/01/2026 09:00:00', transactionType: 'Mua', ticker: 'CMCP', assetClass: 'Tài sản mã hóa', quantity: 10, totalVND: 100, storage: 'Binance' },
      { date: '02/01/2026 09:00:00', transactionType: 'Mua', ticker: 'CMCP', assetClass: 'Tài sản mã hóa', quantity: 10, totalVND: 300, storage: 'Binance ' },
      { date: '03/01/2026 09:00:00', transactionType: 'Mua', ticker: 'CMCP', assetClass: 'Tài sản mã hóa', quantity: 20, totalVND: 400, storage: 'binance' },
    ];
    const accounts = calculateHoldingsByStorage(txs, []);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Binance');
    expect(accounts[0].spellings).toEqual(['Binance', 'binance']);
    expect(accounts[0].positions[0].qty).toBe(40);
    expect(accounts[0].positions[0].avgCost).toBe(20);
  });

  it('takes the part of a sale its account does not hold from the other accounts', () => {
    const txs = [
      { date: '01/01/2026 09:00:00', transactionType: 'Mua', ticker: 'DCBF', assetClass: 'Trái phiếu', quantity: 10, totalVND: 1000, storage: 'Fmarket' },
      { date: '02/01/2026 09:00:00', transactionType: 'Mua', ticker: 'DCBF', assetClass: 'Trái phiếu', quantity: 30, totalVND: 3300, storage: '' },
      { date: '03/01/2026 09:00:00', transactionType: 'Bán', ticker: 'DCBF', assetClass: 'Trái phiếu', quantity: -35, totalVND: 4200, storage: '' },
    ];
    const accounts = calculateHoldingsByStorage(txs, []);
    const held = accounts.flatMap(a => a.positions).reduce((s, p) => s + p.qty, 0);
    expect(held).toBeCloseTo(calculateHoldings(txs).find(h => h.ticker === 'DCBF').qty, 9);
    expect(held).toBeCloseTo(5, 9);
    expect(accounts.find(a => a.name === 'Fmarket').positions[0].qty).toBeCloseTo(5, 9);
    expect(accounts.find(a => a.name === UNKNOWN_STORAGE).positions).toHaveLength(0);
  });

  it('groups transactions without storage under a placeholder account', () => {
    const accounts = calculateHoldingsByStorage([{ date: '01/01/2026 00:00:00', transactionType: 'Mua', ticker: 'ABC', quantity: 1, totalVND: 10, assetClass: 'Cổ phiếu' }], []);
    expect(accounts[0].name).toBe(UNKNOWN_STORAGE);
    expect(accounts[0].value).toBe(10);
  });
});
