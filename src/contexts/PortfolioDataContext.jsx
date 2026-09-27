import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import {
  apiGetTransactions, apiGetExternalAssets, apiGetRebalanceTargets,
  apiGetMarketPrices, apiGetLiabilities, apiGetSnapshots, apiSaveSnapshot,
  apiGetBenchmarkHistory, apiGetSecurities, apiGetAllSecurityPrices,
} from '../services/api.js';
import { resolveMarketPrices } from '../utils/priceResolver.js';
import {
  calculateHoldings, calculatePortfolio, calculateNetWorth,
  calculateRebalance, calculateTotalPnL, generateSnapshot,
} from '../utils/portfolioCalculator.js';
import { replayTransactions, buildValueSeries } from '../utils/performanceEngine.js';
import { findDataIssues } from '../utils/dataChecks.js';
import { toISO, todayISO } from '../utils/dates.js';

const PortfolioDataContext = createContext(null);

export function usePortfolioData() {
  const ctx = useContext(PortfolioDataContext);
  if (!ctx) throw new Error('usePortfolioData must be used inside <PortfolioDataProvider>');
  return ctx;
}

const EMPTY = {
  transactions: [], externalAssets: [], rebalanceTargets: {},
  marketPrices: {}, liabilities: [], snapshots: [], securities: [], userPrices: {},
};

/**
 * Single source of truth for the user's portfolio data.
 * Loads everything from the backend once, exposes derived data
 * (holdings, valuation, net worth, trade replay) and mutation helpers.
 */
export function PortfolioDataProvider({ children }) {
  const { currentUser } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [benchmarks, setBenchmarks] = useState({ VNINDEX: [], BTC: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Transaction modal (global so every view can open it)
  const [txModal, setTxModal] = useState({ open: false, tx: null });
  const openTransactionModal = useCallback((tx = null) => setTxModal({ open: true, tx }), []);
  const closeTransactionModal = useCallback(() => setTxModal({ open: false, tx: null }), []);

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    if (!currentUser) return;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const [txs, ext, targets, prices, debts, snaps, secs, ownPrices] = await Promise.all([
        apiGetTransactions().catch(() => []),
        apiGetExternalAssets().catch(() => []),
        apiGetRebalanceTargets().catch(() => ({})),
        apiGetMarketPrices().catch(() => ({})),
        apiGetLiabilities().catch(() => []),
        apiGetSnapshots().catch(() => []),
        apiGetSecurities().catch(() => []),
        apiGetAllSecurityPrices().catch(() => ({})),
      ]);
      setData({
        transactions: txs || [], externalAssets: ext || [], rebalanceTargets: targets || {},
        marketPrices: prices || {}, liabilities: debts || [], snapshots: snaps || [],
        securities: secs || [], userPrices: ownPrices || {},
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err.message || 'Không tải được dữ liệu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Benchmarks (VN-Index, BTC) — loaded once, non-blocking
  useEffect(() => {
    if (!currentUser) return;
    apiGetBenchmarkHistory(3650).then(res => { if (res) setBenchmarks(res); }).catch(() => {});
  }, [currentUser]);

  const refresh = useCallback(() => fetchAll({ silent: true }), [fetchAll]);

  // ── Derived data ──
  const { transactions, externalAssets, rebalanceTargets, liabilities, snapshots, securities, userPrices } = data;
  const systemMarketPrices = data.marketPrices;
  const today = todayISO();

  // System prices overlaid with the user's own prices (MANUAL / JSON securities, gaps)
  const marketPrices = useMemo(
    () => resolveMarketPrices(systemMarketPrices, securities, userPrices, today),
    [systemMarketPrices, securities, userPrices, today]
  );

  const holdings = useMemo(() => calculateHoldings(transactions), [transactions]);
  const portfolio = useMemo(() => calculatePortfolio(holdings, marketPrices), [holdings, marketPrices]);
  const netWorth = useMemo(() => calculateNetWorth(portfolio, externalAssets, liabilities), [portfolio, externalAssets, liabilities]);
  const pnlSummary = useMemo(() => calculateTotalPnL(portfolio, transactions), [portfolio, transactions]);
  const rebalanceData = useMemo(() => calculateRebalance(portfolio, rebalanceTargets), [portfolio, rebalanceTargets]);
  const replay = useMemo(() => replayTransactions(transactions), [transactions]);
  const dataIssues = useMemo(() => findDataIssues(transactions), [transactions]);
  const valueSeries = useMemo(() => buildValueSeries(snapshots, 'portfolioValue'), [snapshots]);

  const firstDate = useMemo(() => {
    const dates = [];
    if (valueSeries.length) dates.push(valueSeries[0].date);
    for (const t of transactions) { const d = toISO(t.date); if (d) dates.push(d); }
    return dates.length ? dates.sort()[0] : null;
  }, [valueSeries, transactions]);

  const usdtVndRate = useMemo(() => {
    const usdt = marketPrices['USDT'] || marketPrices['USDC'];
    return usdt?.exchangeRate || usdt?.price || 0;
  }, [marketPrices]);

  // ── Auto snapshot — once per day on load ──
  useEffect(() => {
    if (!currentUser || loading || transactions.length === 0) return;
    const today = todayISO();
    if (snapshots.some(s => s.date === today)) return;
    const snap = generateSnapshot(portfolio, externalAssets, liabilities, transactions);
    apiSaveSnapshot({ date: today, ...snap })
      .then(() => apiGetSnapshots().then(s => setData(d => ({ ...d, snapshots: s || [] }))))
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, transactions.length, snapshots.length]);

  const snapshotToday = useCallback(async () => {
    const today = todayISO();
    const snap = generateSnapshot(portfolio, externalAssets, liabilities, transactions);
    await apiSaveSnapshot({ date: today, ...snap });
    await refresh();
    return today;
  }, [portfolio, externalAssets, liabilities, transactions, refresh]);

  /** Re-fetch raw data from the backend, recompute and store today's snapshot. */
  const recomputeAndSnapshot = useCallback(async () => {
    const [txs, ext, debts, prices, secs, ownPrices] = await Promise.all([
      apiGetTransactions().catch(() => []),
      apiGetExternalAssets().catch(() => []),
      apiGetLiabilities().catch(() => []),
      apiGetMarketPrices().catch(() => ({})),
      apiGetSecurities().catch(() => []),
      apiGetAllSecurityPrices().catch(() => ({})),
    ]);
    const h = calculateHoldings(txs || []);
    const p = calculatePortfolio(h, resolveMarketPrices(prices || {}, secs || [], ownPrices || {}, todayISO()));
    const snap = generateSnapshot(p, ext || [], debts || [], txs || []);
    const today = todayISO();
    await apiSaveSnapshot({ date: today, ...snap });
    await refresh();
  }, [refresh]);

  const value = {
    // raw (marketPrices = system prices overlaid with the user's own prices)
    transactions, externalAssets, rebalanceTargets, marketPrices, systemMarketPrices, liabilities, snapshots, benchmarks,
    securities, userPrices,
    // derived
    holdings, portfolio, netWorth, pnlSummary, rebalanceData, replay, dataIssues, valueSeries, firstDate, usdtVndRate,
    today,
    // state
    loading, refreshing, error, lastUpdated,
    // actions
    refresh, snapshotToday, recomputeAndSnapshot,
    setRebalanceTargets: (targets) => setData(d => ({ ...d, rebalanceTargets: targets })),
    // transaction modal
    txModal, openTransactionModal, closeTransactionModal,
  };

  return (
    <PortfolioDataContext.Provider value={value}>
      {children}
    </PortfolioDataContext.Provider>
  );
}
