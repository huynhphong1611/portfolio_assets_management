import { describe, it, expect } from 'vitest';
import { 
  calculateHoldings, 
  calculatePortfolio, 
  calculateNetWorth, 
  calculateTotalPnL,
  replayCash,
  sortTransactions,
} from '../portfolioCalculator';
import { mockTransactions, mockMarketPrices, mockExternalAssets, mockLiabilities } from './mockData';

describe('portfolioCalculator logic', () => {

  describe('calculateHoldings', () => {
    it('aggregates transactions into proper asset holdings', () => {
      const holdings = calculateHoldings(mockTransactions);
      
      const vndHoldings = holdings.find(h => h.ticker === 'VNĐ');
      const fueHoldings = holdings.find(h => h.ticker === 'FUEVN100');
      const usdtHoldings = holdings.find(h => h.ticker === 'USDT');
      const btcHoldings = holdings.find(h => h.ticker === 'BTC');

      expect(vndHoldings).toBeDefined();
      expect(fueHoldings).toBeDefined();
      expect(usdtHoldings).toBeDefined();
      expect(btcHoldings).toBeDefined();

      // Check FUEVN100 (Bought 1000 @ 25M, Sold 200)
      // Remaining qty = 800
      expect(fueHoldings.qty).toBe(800);
      expect(fueHoldings.avgCost).toBe(25000); // 25M / 1000
      expect(fueHoldings.totalCost).toBe(20000000); // 800 * 25k

      // Check VNĐ Cash math
      // + 100,000,000 (Nạp)
      // - 25,000,000 (Mua FUE)
      // + 5,200,000 (Bán FUE)
      // - 25,500,000 (Mua USDT)
      // - 17,850,000 (Mua BTC)
      // Total VNĐ Cash = 36,850,000
      expect(vndHoldings.qty).toBe(36850000);
    });

    it('returns empty array when transactions is empty', () => {
       expect(calculateHoldings([])).toEqual([]);
    });
  });

  describe('calculatePortfolio', () => {
    it('calculates proper valuations including USDT chaining for Crypto', () => {
      const holdings = calculateHoldings(mockTransactions);
      const portfolio = calculatePortfolio(holdings, mockMarketPrices);

      const vnd = portfolio.find(p => p.ticker === 'VNĐ');
      const fue = portfolio.find(p => p.ticker === 'FUEVN100');
      const btc = portfolio.find(p => p.ticker === 'BTC');

      // VND valuation is exactly its qty
      expect(vnd.actualValue).toBe(36850000);

      // FUEVN100 valuation = 800 * 30,000 (marketPrice) = 24,000,000
      expect(fue.actualValue).toBe(24000000);
      expect(fue.pnl).toBe(4000000); // 24M - 20M cost

      // BTC valuation: qty (0.01) * 2,000,000,000 VND (already converted from USD)
      // = 20,000,000
      expect(btc.actualValue).toBe(20000000);
      expect(btc.pnl).toBe(20000000 - 17850000); // Value - Cost
    });
  });

  describe('calculateNetWorth', () => {
    it('groups properly into Liquid and Invested assets and calculates Net Worth', () => {
       const holdings = calculateHoldings(mockTransactions);
       const portfolio = calculatePortfolio(holdings, mockMarketPrices);

       const nw = calculateNetWorth(portfolio, mockExternalAssets, mockLiabilities);
       
       expect(nw.totalLiabilities).toBe(10000000);
       
       // Liquid Assets: VNĐ (36,850,000) + USDT (1,000 * 25,000 = 25,000,000) + Ngoại lai Sổ tiết kiệm (50,000,000) = 111,850,000
       expect(nw.totalLiquid).toBe(111850000);

       // Invested Assets: FUEVN100 (24,000,000) + BTC (20,000,000) + Ngoại lai Nhà đất (500,000,000) = 544,000,000
       expect(nw.totalInvest).toBe(544000000);

       // Net Worth = Liquid + Invested - Liabilities
       expect(nw.totalNetWorth).toBe(111850000 + 544000000 - 10000000);
    });
  });
});

describe('Cổ tức (earnings) transactions', () => {
  const dividend = {
    assetClass: 'Cổ phiếu', currency: 'VNĐ', date: '20/03/2026 10:00:00',
    quantity: 800, unitPrice: 1250, totalVND: 1000000, storage: 'TCBS',
    ticker: 'FUEVN100', transactionType: 'Cổ tức'
  };
  const interest = {
    assetClass: 'Tiền mặt VNĐ', currency: 'VNĐ', date: '21/03/2026 10:00:00',
    quantity: 50000, unitPrice: 1, totalVND: 50000, storage: 'Techcombank',
    ticker: '', transactionType: 'Cổ tức'
  };

  it('adds earnings to cash without changing cost basis or net capital', () => {
    const holdings = calculateHoldings([...mockTransactions, dividend, interest]);
    const cash = holdings.find(h => h.ticker === 'VNĐ');
    const fue  = holdings.find(h => h.ticker === 'FUEVN100');

    expect(cash.qty).toBe(36850000 + 1000000 + 50000);
    expect(cash.totalCost).toBe(100000000);        // net capital unchanged
    expect(fue.totalCost).toBe(20000000);           // cost basis unchanged
    expect(fue.qty).toBe(800);

    const portfolio = calculatePortfolio(holdings, mockMarketPrices);
    const pnl = calculateTotalPnL(portfolio, [...mockTransactions, dividend, interest]);
    expect(pnl.totalCost).toBe(100000000);
    // Earnings flow straight into total P&L
    const pnlWithout = calculateTotalPnL(calculatePortfolio(calculateHoldings(mockTransactions), mockMarketPrices), mockTransactions);
    expect(pnl.totalPnL - pnlWithout.totalPnL).toBe(1050000);
  });
});

describe('cash replay and net capital', () => {
  const t = (date, transactionType, ticker, quantity, totalVND, assetClass = 'Cổ phiếu') => ({
    date, transactionType, ticker, quantity, totalVND, assetClass: ticker ? assetClass : 'Tiền mặt VNĐ',
  });

  it('never floors the cash balance: a purchase larger than the balance leaves it negative', () => {
    const txs = [
      t('01/01/2026 09:00:00', 'Nạp tiền', '', 100, 100),
      t('02/01/2026 09:00:00', 'Mua', 'VNM', 1, 150),
    ];
    const holdings = calculateHoldings(txs);
    expect(holdings.find(h => h.ticker === 'VNĐ').qty).toBe(-50);
    const pnl = calculateTotalPnL(calculatePortfolio(holdings, {}), txs);
    // valued at cost there is no profit — the old floor showed +50
    expect(pnl.totalValue).toBe(100);
    expect(pnl.totalPnL).toBe(0);
  });

  it('reconciles a purchase recorded minutes before the deposit that paid for it', () => {
    const txs = [
      t('03/02/2026 21:40:13', 'Mua', 'USDT', 350, 9341500, 'Tiền mặt USD'),
      t('03/02/2026 21:41:49', 'Nạp tiền', '', 13345000, 13345000),
    ];
    const cash = replayCash(txs);
    expect(cash.mode).toBe('tracked');
    expect(cash.minBalance).toBe(-9341500);
    expect(cash.balance).toBe(13345000 - 9341500);
    expect(cash.netCapital).toBe(13345000);
  });

  it('books deposits before purchases that share their timestamp', () => {
    const txs = [
      t('05/02/2026 10:00:00', 'Mua', 'VNM', 10, 500),
      t('05/02/2026 10:00:00', 'Nạp tiền', '', 500, 500),
    ];
    expect(sortTransactions(txs).map(x => x.transactionType)).toEqual(['Nạp tiền', 'Mua']);
    expect(replayCash(txs).minBalance).toBe(0);
  });

  it('uses implicit capital for a trades-only log so realized gains and earnings count', () => {
    const txs = [
      t('01/01/2026 09:00:00', 'Mua', 'VNM', 10, 100),
      t('02/01/2026 09:00:00', 'Cổ tức', 'VNM', 10, 5),
      t('03/01/2026 09:00:00', 'Bán', 'VNM', -10, 110),
      t('04/01/2026 09:00:00', 'Mua', 'FPT', 1, 50),
    ];
    const holdings = calculateHoldings(txs);
    const cash = holdings.find(h => h.ticker === 'VNĐ');
    expect(cash.qty).toBe(65);          // 5 + 110 − 50: FPT was paid from the proceeds
    expect(cash.totalCost).toBe(100);   // capital actually put in
    const pnl = calculateTotalPnL(calculatePortfolio(holdings, {}), txs);
    expect(pnl.totalPnL).toBe(15);      // 10 realized + 5 dividend
    expect(pnl.totalPnLPercent).toBeCloseTo(15, 9);
  });

  it('keeps the profit when more was withdrawn than deposited (no clamp at 0)', () => {
    const txs = [
      t('01/01/2026 09:00:00', 'Nạp tiền', '', 100, 100),
      t('02/01/2026 09:00:00', 'Mua', 'VNM', 1, 100),
      t('03/01/2026 09:00:00', 'Bán', 'VNM', -1, 300),
      t('04/01/2026 09:00:00', 'Rút tiền', '', 200, 200),
    ];
    const pnl = calculateTotalPnL(calculatePortfolio(calculateHoldings(txs), {}), txs);
    expect(pnl.totalCost).toBe(-100);
    expect(pnl.totalValue).toBe(100);
    expect(pnl.totalPnL).toBe(200);
    expect(pnl.totalPnLPercent).toBe(0);
  });

  it('treats every deposit row as VNĐ cash, whatever its ticker', () => {
    const txs = [{ date: '01/01/2026 09:00:00', transactionType: 'Nạp tiền', ticker: 'USDT', assetClass: 'Tiền mặt USD', quantity: 2600000, totalVND: 2600000 }];
    const holdings = calculateHoldings(txs);
    expect(holdings.map(h => h.ticker)).toEqual(['VNĐ']);
    expect(calculateTotalPnL(calculatePortfolio(holdings, {}), txs).totalPnL).toBe(0);
  });
});

describe('average cost of securities', () => {
  const t = (date, transactionType, quantity, totalVND) => ({ date, transactionType, ticker: 'USDT', assetClass: 'Tiền mặt USD', quantity, totalVND });

  it('is a moving average that sales do not change', () => {
    const txs = [
      t('01/01/2026 09:00:00', 'Mua', 100, 2500000),
      t('02/01/2026 09:00:00', 'Mua', 100, 2700000),
      t('03/01/2026 09:00:00', 'Bán', -50, 1400000),
      t('04/01/2026 09:00:00', 'Mua', 50, 1300000),
    ];
    const usdt = calculateHoldings(txs).find(h => h.ticker === 'USDT');
    // (5.2M − 26,000 × 50 + 1.3M) / 200
    expect(usdt.qty).toBe(200);
    expect(usdt.avgCost).toBeCloseTo((5200000 - 26000 * 50 + 1300000) / 200, 9);
  });

  it('closes an oversold position at zero and starts the next purchase afresh', () => {
    const txs = [
      t('01/01/2026 09:00:00', 'Mua', 10, 260),
      t('02/01/2026 09:00:00', 'Bán', -12, 312),
      t('03/01/2026 09:00:00', 'Mua', 5, 130),
    ];
    const usdt = calculateHoldings(txs).find(h => h.ticker === 'USDT');
    expect(usdt.qty).toBe(5);
    expect(usdt.avgCost).toBe(26);
  });

  it('values a stablecoin without a price at its rate, the USDT rate, then its cost — never NaN', () => {
    const holdings = [
      { ticker: 'USDT', assetClass: 'Tiền mặt USD', qty: 10, totalCost: 260000, avgCost: 26000 },
      { ticker: 'USDC', assetClass: 'Tiền mặt USD', qty: 10, totalCost: 250000, avgCost: 25000 },
    ];
    const atCost = calculatePortfolio(holdings, {});
    expect(atCost.map(p => p.actualValue)).toEqual([260000, 250000]);
    const withRate = calculatePortfolio(holdings, { USDT: { exchangeRate: 26500 } });
    expect(withRate.map(p => p.marketPrice)).toEqual([26500, 26500]);
  });
});
