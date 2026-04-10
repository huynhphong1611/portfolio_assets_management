import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Briefcase, ArrowRightLeft, Scale, TrendingUp, TrendingDown,
  Wallet, PieChart, Activity, Menu, X, PlusCircle, RefreshCw, Search,
  Upload, Loader2, Landmark, BarChart3, Camera, AlertTriangle, LogOut
} from 'lucide-react';

import { useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Auth/Login.jsx';

import { formatVND, formatNum, formatPercent, formatQty } from './utils/formatters.js';
import {
  calculateHoldings, calculatePortfolio, calculateNetWorth,
  calculateRebalance, calculateTotalPnL, generateSnapshot
} from './utils/portfolioCalculator.js';
import {
  apiGetTransactions, apiGetExternalAssets, apiGetRebalanceTargets,
  apiGetMarketPrices, apiGetLiabilities, apiGetSnapshots,
  apiGetDailyPrices, apiGetFunds, apiInitializeFunds,
  apiSaveSnapshot
} from './services/api.js';
import { importCSVToFirestore, CSV_RAW_DATA } from './scripts/importCSV.js';

import TransactionLog from './components/TransactionLog.jsx';
import AddTransactionModal from './components/AddTransactionModal.jsx';
import AssetAllocationChart from './components/AssetAllocationChart.jsx';
import RebalanceSettings from './components/RebalanceSettings.jsx';
import NetWorthExternalManager from './components/NetWorthExternalManager.jsx';
import LiabilitiesManager from './components/LiabilitiesManager.jsx';
import FundManager from './components/FundManager.jsx';
import PriceManager from './components/PriceManager.jsx';
import LineChart from './components/charts/LineChart.jsx';

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Data state (fetched from backend API)
  const [transactions, setTransactions] = useState([]);
  const [externalAssets, setExternalAssets] = useState([]);
  const [rebalanceTargets, setRebalanceTargets] = useState({});
  const [marketPrices, setMarketPrices] = useState({});
  const [liabilities, setLiabilities] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [dailyPrices, setDailyPrices] = useState([]);
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // ============================================================
  // DATA FETCHING (replaced Firestore subscriptions)
  // ============================================================

  const fetchAllData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [txs, extAssets, targets, mktPrices, debts, snaps, dailyP, fundsData] =
        await Promise.all([
          apiGetTransactions().catch(() => []),
          apiGetExternalAssets().catch(() => []),
          apiGetRebalanceTargets().catch(() => ({})),
          apiGetMarketPrices().catch(() => ({})),
          apiGetLiabilities().catch(() => []),
          apiGetSnapshots().catch(() => []),
          apiGetDailyPrices().catch(() => []),
          apiGetFunds().catch(() => []),
        ]);

      setTransactions(txs || []);
      setExternalAssets(extAssets || []);
      setRebalanceTargets(targets || {});
      setMarketPrices(mktPrices || {});
      setLiabilities(debts || []);
      setSnapshots(snaps || []);
      setDailyPrices(dailyP || []);
      setFunds(fundsData || []);

      // Initialize default funds if empty
      if (!fundsData || fundsData.length === 0) {
        await apiInitializeFunds().catch(console.error);
        const newFunds = await apiGetFunds().catch(() => []);
        setFunds(newFunds || []);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Expose refreshData for child components to trigger after mutations
  const refreshData = useCallback(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================================
  // AUTO SNAPSHOT — once per day on app load
  // ============================================================

  useEffect(() => {
    if (!currentUser || loading || transactions.length === 0 || funds.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const alreadyExists = snapshots.some(s => s.date === today);
    if (alreadyExists) return;

    // Recalculate for snapshot
    const h = calculateHoldings(transactions);
    const p = calculatePortfolio(h, marketPrices);
    const snap = generateSnapshot(p, externalAssets, liabilities, funds);
    apiSaveSnapshot({ date: today, ...snap }).then(() => {
      console.log('📸 Auto-snapshot saved for', today);
      // Re-fetch snapshots
      apiGetSnapshots().then(s => setSnapshots(s || []));
    }).catch(console.error);
  }, [loading, transactions.length, snapshots.length, funds.length]);

  // ============================================================
  // CALCULATED DATA
  // ============================================================

  const holdings = useMemo(() => calculateHoldings(transactions), [transactions]);
  const portfolio = useMemo(() => calculatePortfolio(holdings, marketPrices), [holdings, marketPrices]);
  const netWorth = useMemo(() => calculateNetWorth(portfolio, externalAssets, liabilities), [portfolio, externalAssets, liabilities]);
  const rebalanceData = useMemo(() => calculateRebalance(portfolio, rebalanceTargets), [portfolio, rebalanceTargets]);
  const pnlSummary = useMemo(() => calculateTotalPnL(portfolio), [portfolio]);

  // Growth chart data from snapshots
  const growthChartData = useMemo(() => {
    if (snapshots.length < 1) return [];
    return [
      { label: 'Tổng tài sản', data: snapshots.map(s => ({ x: s.date, y: s.totalAssets || 0 })), color: '#3b82f6' },
      { label: 'Tổng nợ', data: snapshots.map(s => ({ x: s.date, y: s.totalLiabilities || 0 })), color: '#f43f5e', fill: false },
      { label: 'Tài sản ròng', data: snapshots.map(s => ({ x: s.date, y: s.netWorth || 0 })), color: '#10b981' },
    ];
  }, [snapshots]);

  const portfolioGrowthData = useMemo(() => {
    if (snapshots.length < 1) return [];
    return [
      { label: 'Giá trị DM', data: snapshots.map(s => ({ x: s.date, y: s.portfolioValue || 0 })), color: '#6366f1' },
      { label: 'Tiền vốn', data: snapshots.map(s => ({ x: s.date, y: s.portfolioCost || 0 })), color: '#94a3b8', fill: false },
      { label: 'Lãi/Lỗ', data: snapshots.map(s => ({ x: s.date, y: s.portfolioPnL || 0 })), color: '#10b981', fill: false },
    ];
  }, [snapshots]);

  // Allocation chart data
  const allocationChartData = useMemo(() => {
    const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const classMap = {};
    portfolio.forEach(p => {
      if (!classMap[p.assetClass]) classMap[p.assetClass] = 0;
      classMap[p.assetClass] += p.actualValue;
    });

    // Include remaining cash from all funds into "Tiền mặt VNĐ"
    const totalFundCash = funds.reduce((sum, f) => sum + (parseFloat(f.cashBalance) || 0), 0);
    if (totalFundCash > 0) {
      if (!classMap['Tiền mặt VNĐ']) classMap['Tiền mặt VNĐ'] = 0;
      classMap['Tiền mặt VNĐ'] += totalFundCash;
    }

    return Object.entries(classMap)
      .filter(([, v]) => v > 0)
      .map(([label, value], i) => ({ label, value, color: COLORS[i % COLORS.length] }));
  }, [portfolio, funds]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleImportCSV = async () => {
    if (transactions.length > 0 && !confirm(`Import thêm dữ liệu CSV?`)) return;
    setImporting(true);
    try {
      const count = await importCSVToFirestore(CSV_RAW_DATA);
      alert(`✅ Import thành công ${count} giao dịch!`);
    } catch (err) { alert('❌ Lỗi: ' + err.message); }
    finally { setImporting(false); }
  };

  const handleManualSnapshot = async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const snap = generateSnapshot(portfolio, externalAssets, liabilities, funds);
      await apiSaveSnapshot({ date: today, ...snap });
      alert('📸 Snapshot đã được lưu cho ngày ' + today);
      refreshData();
    } catch (err) { alert('Lỗi: ' + err.message); }
  };

  // ============================================================
  // NAV
  // ============================================================

  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: "Tổng quan" },
    { id: 'portfolio', icon: <Briefcase size={20} />, label: "Danh mục Đầu tư" },
    { id: 'funds', icon: <Landmark size={20} />, label: "Quỹ Đầu tư" },
    { id: 'rebalance', icon: <Scale size={20} />, label: "Tái cơ cấu" },
    { id: 'prices', icon: <BarChart3 size={20} />, label: "Bảng giá" },
    { id: 'transactions', icon: <ArrowRightLeft size={20} />, label: "Nhật ký GD" },
  ];

  // ============================================================
  // LOADING & AUTH
  // ============================================================

  if (!currentUser) {
    return <Login />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo"><Activity size={40} /></div>
          <h2 className="loading-title">Portfolio Manager V5</h2>
          <p className="loading-subtitle">Đang tải dữ liệu...</p>
          <div className="loading-bar"><div className="loading-bar-fill"></div></div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app-layout">
      <AddTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} funds={funds} onSuccess={refreshData} />

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo"><Activity size={22} /></div>
          <div>
            <h1 className="sidebar-title">Portfolio Management</h1>
            <p className="sidebar-subtitle">Quản lý tài sản cá nhân</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? 'nav-item--active' : ''}`}>
              <span className="nav-icon">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ padding: '0.2rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            User: <strong style={{ color: 'var(--text-main)' }}>{currentUser.username}</strong>
          </div>
          <button className="btn-glass import-btn" onClick={logout} style={{ color: 'var(--color-rose-400)', borderColor: 'rgba(244, 63, 94, 0.2)', marginBottom: '0.5rem' }}>
            <LogOut size={16} /> Đăng xuất
          </button>

          {transactions.length === 0 && (
            <button className="btn-glass import-btn" onClick={handleImportCSV} disabled={importing}>
              {importing ? <><Loader2 size={16} className="spin" /> Đang import...</> : <><Upload size={16} /> Import CSV</>}
            </button>
          )}
          <button className="btn-glass import-btn" onClick={handleManualSnapshot}>
            <Camera size={16} /> Snapshot hôm nay
          </button>
        </div>
      </aside>

      <div className="main-container">
        {/* MOBILE HEADER */}
        <header className="mobile-header">
          <div className="mobile-header-brand"><Activity size={22} className="color-primary" /><h1>Portfolio Management</h1></div>
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>
        {isMobileMenuOpen && (
          <div className="mobile-nav-dropdown">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`nav-item ${activeTab === item.id ? 'nav-item--active' : ''}`}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}

        <main className="main-content">
          <div className="content-wrapper">

            {/* ===== TAB 1: DASHBOARD ===== */}
            {activeTab === 'dashboard' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Tổng quan Tài sản</h2>
                    <p className="section-subtitle">Net Worth, Tài sản vs Nợ, và biểu đồ tăng trưởng.</p>
                  </div>
                  <button className="btn-primary btn-hidden-mobile" onClick={() => setIsModalOpen(true)}>
                    <PlusCircle size={18} /> Ghi nhận Giao dịch
                  </button>
                </div>

                {/* KPI Cards */}
                <div className="kpi-grid kpi-grid--4">
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--blue"><Wallet size={24} /></div>
                    <h3 className="kpi-label">Tổng Tài Sản</h3>
                    <p className="kpi-value">{formatVND(netWorth.totalAssets)}</p>
                  </div>
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--rose"><AlertTriangle size={24} /></div>
                    <h3 className="kpi-label">Tổng Nợ</h3>
                    <p className="kpi-value color-down">{formatVND(netWorth.totalLiabilities)}</p>
                  </div>
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--emerald"><TrendingUp size={24} /></div>
                    <h3 className="kpi-label">Tài Sản Ròng (Net Worth)</h3>
                    <p className="kpi-value">{formatVND(netWorth.totalNetWorth)}</p>
                  </div>
                  <div className="kpi-card glass-card kpi-card--pnl">
                    <div className="kpi-header-row">
                      <div className={`kpi-icon ${pnlSummary.totalPnL >= 0 ? 'kpi-icon--emerald' : 'kpi-icon--rose'}`}>
                        {pnlSummary.totalPnL >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                      </div>
                      <span className={`kpi-badge ${pnlSummary.totalPnL >= 0 ? 'kpi-badge--up' : 'kpi-badge--down'}`}>
                        {formatPercent(pnlSummary.totalPnLPercent)}
                      </span>
                    </div>
                    <h3 className="kpi-label">Lãi/Lỗ Danh mục</h3>
                    <p className={`kpi-value ${pnlSummary.totalPnL >= 0 ? 'color-up' : 'color-down'}`}>
                      {pnlSummary.totalPnL > 0 ? '+' : ''}{formatVND(pnlSummary.totalPnL)}
                    </p>
                  </div>
                </div>

                {/* Assets vs Liabilities Bar */}
                <div className="glass-card section-card">
                  <h3 className="card-title">Tài sản vs Nợ</h3>
                  <div className="assets-debt-bar">
                    <div className="assets-debt-bar-asset"
                      style={{ width: `${netWorth.totalAssets > 0 ? (netWorth.totalAssets / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100 : 100}%` }}>
                      <span>Tài sản {netWorth.totalAssets > 0 ? ((netWorth.totalAssets / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100).toFixed(1) : 100}%</span>
                    </div>
                    {netWorth.totalLiabilities > 0 && (
                      <div className="assets-debt-bar-debt"
                        style={{ width: `${(netWorth.totalLiabilities / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100}%` }}>
                        <span>Nợ {((netWorth.totalLiabilities / (netWorth.totalAssets + netWorth.totalLiabilities)) * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="assets-debt-details">
                    <div className="assets-debt-item"><div className="dot dot--liquid"></div> Thanh khoản: <strong>{formatVND(netWorth.totalLiquid)}</strong></div>
                    <div className="assets-debt-item"><div className="dot dot--invest"></div> Đầu tư: <strong>{formatVND(netWorth.totalInvest)}</strong></div>
                    <div className="assets-debt-item"><div className="dot dot--debt"></div> Nợ: <strong className="color-down">{formatVND(netWorth.totalLiabilities)}</strong></div>
                  </div>
                </div>

                {/* Net Worth Growth Chart */}
                {growthChartData.length > 0 && (
                  <div className="glass-card section-card">
                    <LineChart datasets={growthChartData} height={300} title="Tăng trưởng Tài sản theo ngày" />
                  </div>
                )}

                {/* External Assets */}
                <div className="glass-card section-card">
                  <NetWorthExternalManager externalAssets={externalAssets} onUpdate={refreshData} />
                </div>

                {/* Liabilities */}
                <div className="glass-card section-card">
                  <LiabilitiesManager liabilities={liabilities} onUpdate={refreshData} />
                </div>
              </div>
            )}

            {/* ===== TAB 2: PORTFOLIO (= overview of all funds) ===== */}
            {activeTab === 'portfolio' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Danh mục Đầu tư</h2>
                    <p className="section-subtitle">
                      Tổng hợp tất cả quỹ — {portfolio.filter(p => p.ticker !== 'VNĐ').length} mã tài sản
                    </p>
                  </div>
                </div>

                {/* Portfolio KPIs */}
                <div className="kpi-grid">
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--indigo"><PieChart size={24} /></div>
                    <h3 className="kpi-label">Tổng giá trị Danh mục</h3>
                    <p className="kpi-value">{formatVND(pnlSummary.totalValue)}</p>
                  </div>
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--blue"><Wallet size={24} /></div>
                    <h3 className="kpi-label">Tổng vốn đã đầu tư</h3>
                    <p className="kpi-value">{formatVND(pnlSummary.totalCost)}</p>
                  </div>
                  <div className="kpi-card glass-card">
                    <div className={`kpi-icon ${pnlSummary.totalPnL >= 0 ? 'kpi-icon--emerald' : 'kpi-icon--rose'}`}>
                      {pnlSummary.totalPnL >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                    </div>
                    <h3 className="kpi-label">Lãi / Lỗ hiện tại</h3>
                    <p className={`kpi-value ${pnlSummary.totalPnL >= 0 ? 'color-up' : 'color-down'}`}>
                      {pnlSummary.totalPnL > 0 ? '+' : ''}{formatVND(pnlSummary.totalPnL)} ({formatPercent(pnlSummary.totalPnLPercent)})
                    </p>
                  </div>
                </div>

                {/* Allocation Donut */}
                {allocationChartData.length > 0 && (
                  <div className="glass-card section-card">
                    <h3 className="card-title">Phân bổ theo loại tài sản</h3>
                    <AssetAllocationChart data={allocationChartData} size={240} />
                  </div>
                )}

                {/* Portfolio Growth Chart */}
                {portfolioGrowthData.length > 0 && (
                  <div className="glass-card section-card">
                    <LineChart datasets={portfolioGrowthData} height={300} title="Tăng trưởng Danh mục theo ngày" />
                  </div>
                )}

                {/* Holdings Table */}
                <div className="glass-card section-card">
                  <div className="portfolio-table-header">
                    <h3 className="card-title" style={{ marginBottom: 0 }}>Tất cả tài sản đang nắm giữ</h3>
                    <div className="search-box search-box-sm">
                      <Search size={14} className="search-icon" />
                      <input type="text" placeholder="Tìm mã..." className="search-input" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Mã / Quỹ</th>
                          <th className="text-right">SL</th>
                          <th className="text-right">Giá vốn</th>
                          <th className="text-right">Giá trị</th>
                          <th className="text-right">L/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio
                          .filter(p => p.ticker !== 'VNĐ')
                          .filter(p => !searchTerm || p.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
                          .map((item, idx) => (
                            <tr key={idx} className="table-row-hover">
                              <td>
                                <div className="td-ticker">{item.ticker}</div>
                                <div className="td-meta">{item.assetClass}{item.fundName ? ` • ${item.fundName}` : ''}</div>
                              </td>
                              <td className="text-right td-mono">{formatQty(item.qty, item.assetClass)}</td>
                              <td className="text-right td-mono td-muted">{formatVND(item.totalCost)}</td>
                              <td className="text-right td-mono td-bold">{formatVND(item.actualValue)}</td>
                              <td className="text-right">
                                <span className={`pnl-badge ${item.pnl >= 0 ? 'pnl-badge--up' : 'pnl-badge--down'}`}>
                                  {item.pnl > 0 ? '+' : ''}{formatVND(item.pnl)} ({formatPercent(item.pnlPercent)})
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== TAB 3: FUNDS ===== */}
            {activeTab === 'funds' && (
              <FundManager funds={funds} portfolio={portfolio} transactions={transactions} snapshots={snapshots} onUpdate={refreshData} />
            )}

            {/* ===== TAB 4: REBALANCE ===== */}
            {activeTab === 'rebalance' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Tái cơ cấu (Rebalance)</h2>
                    <p className="section-subtitle">So sánh tỷ trọng thực tế với mục tiêu.</p>
                  </div>
                  <RebalanceSettings currentTargets={rebalanceTargets} onSave={targets => { setRebalanceTargets(targets); }} onUpdate={refreshData} />
                </div>
                <div className="rebalance-grid">
                  {rebalanceData.map((item, idx) => {
                    const styles = {
                      hold: { bg: 'var(--glass-bg)', color: 'var(--text-secondary)', border: 'var(--glass-border)' },
                      buy: { bg: 'var(--color-emerald-500)', color: '#fff', border: 'var(--color-emerald-500)' },
                      sell: { bg: 'var(--color-rose-500)', color: '#fff', border: 'var(--color-rose-500)' },
                    };
                    const s = styles[item.action.type];
                    return (
                      <div key={idx} className="rebalance-card glass-card">
                        <div className="rebalance-card-header">
                          <div>
                            <h3 className="rebalance-card-title">{item.label || item.assetClass}</h3>
                            <p className="rebalance-card-value">{formatVND(item.actualValue)}</p>
                          </div>
                          <span className="rebalance-action-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                            {item.action.text}
                          </span>
                        </div>
                        <div className="rebalance-card-body">
                          <div className="rebalance-weights">
                            <span>Thực tế: <strong>{item.actualWeight.toFixed(2)}%</strong></span>
                            <span>Mục tiêu: <strong>{item.targetWeight.toFixed(2)}%</strong></span>
                          </div>
                          <div className="rebalance-bar">
                            <div className="rebalance-bar-target" style={{ left: `${Math.min(item.targetWeight, 100)}%` }}></div>
                            <div className={`rebalance-bar-fill rebalance-bar-fill--${item.action.type}`} style={{ width: `${Math.min(item.actualWeight, 100)}%` }}></div>
                          </div>
                          <div className="rebalance-variance">
                            <span className={`rebalance-variance-value rebalance-variance--${item.action.type}`}>
                              Độ lệch: {item.variance > 0 ? '+' : ''}{item.variance.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== TAB 5: PRICES ===== */}
            {activeTab === 'prices' && (
              <PriceManager dailyPrices={dailyPrices} transactions={transactions} apiEnabled={true} onUpdate={refreshData} />
            )}

            {/* ===== TAB 6: TRANSACTIONS ===== */}
            {activeTab === 'transactions' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Nhật ký Giao dịch</h2>
                    <p className="section-subtitle">Lịch sử giao dịch và ghi chú đầu tư.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <PlusCircle size={18} /> Thêm Giao dịch
                  </button>
                </div>
                <TransactionLog transactions={transactions} loading={loading} onUpdate={refreshData} />
              </div>
            )}

          </div>
        </main>

        <button className="fab" onClick={() => setIsModalOpen(true)}><PlusCircle size={24} /></button>
      </div>
    </div>
  );
}