import { describe, it, expect } from 'vitest';
import { 
  calculateHoldings, 
  calculatePortfolio, 
  calculateNetWorth, 
  calculateTotalPnL 
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

      // BTC valuation chaining: qty (0.01) * 80000 (priceUsdt) * 25000 (usdtRate)
      // 0.01 * 80000 = 800
      // 800 * 25000 = 20,000,000
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
