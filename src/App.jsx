import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Briefcase, ArrowRightLeft, Scale, TrendingUp, TrendingDown,
  Wallet, PieChart, Activity, Menu, X, PlusCircle, RefreshCw, Search,
  Database, Upload, Loader2, AlertCircle
} from 'lucide-react';

import { formatVND, formatNum, formatPercent } from './utils/formatters.js';
import {
  calculateHoldings, calculatePortfolio, calculateNetWorth,
  calculateRebalance, calculateTotalPnL
} from './utils/portfolioCalculator.js';
import {
  subscribeTransactions, subscribeExternalAssets,
  subscribeRebalanceTargets, subscribeMarketPrices
} from './services/firestoreService.js';
import { importCSVToFirestore, CSV_RAW_DATA } from './scripts/importCSV.js';

import TransactionLog from './components/TransactionLog.jsx';
import AddTransactionModal from './components/AddTransactionModal.jsx';
import AssetAllocationChart from './components/AssetAllocationChart.jsx';
import RebalanceSettings from './components/RebalanceSettings.jsx';
import NetWorthExternalManager from './components/NetWorthExternalManager.jsx';

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Firebase realtime state
  const [transactions, setTransactions] = useState([]);
  const [externalAssets, setExternalAssets] = useState([]);
  const [rebalanceTargets, setRebalanceTargets] = useState({});
  const [marketPrices, setMarketPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // ============================================================
  // FIREBASE REALTIME SUBSCRIPTIONS
  // ============================================================

  useEffect(() => {
    setLoading(true);
    let loaded = { tx: false, ext: false, rb: false, mp: false };

    const checkLoaded = () => {
      if (loaded.tx && loaded.ext && loaded.rb && loaded.mp) {
        setLoading(false);
      }
    };

    const unsubTx = subscribeTransactions((items) => {
      setTransactions(items);
      loaded.tx = true;
      checkLoaded();
    });

    const unsubExt = subscribeExternalAssets((items) => {
      setExternalAssets(items);
      loaded.ext = true;
      checkLoaded();
    });

    const unsubRb = subscribeRebalanceTargets((targets) => {
      setRebalanceTargets(targets);
      loaded.rb = true;
      checkLoaded();
    });

    const unsubMp = subscribeMarketPrices((prices) => {
      setMarketPrices(prices);
      loaded.mp = true;
      checkLoaded();
    });

    // Timeout fallback
    const timer = setTimeout(() => setLoading(false), 5000);

    return () => {
      unsubTx();
      unsubExt();
      unsubRb();
      unsubMp();
      clearTimeout(timer);
    };
  }, []);

  // ============================================================
  // CALCULATED DATA
  // ============================================================

  const holdings = useMemo(() => calculateHoldings(transactions), [transactions]);
  const portfolio = useMemo(() => calculatePortfolio(holdings, marketPrices), [holdings, marketPrices]);
  const netWorth = useMemo(() => calculateNetWorth(portfolio, externalAssets), [portfolio, externalAssets]);
  const rebalanceData = useMemo(() => calculateRebalance(portfolio, rebalanceTargets), [portfolio, rebalanceTargets]);
  const pnlSummary = useMemo(() => calculateTotalPnL(portfolio), [portfolio]);

  // Filtered portfolio for search
  const filteredPortfolio = useMemo(() => {
    if (!searchTerm) return portfolio.filter(p => p.ticker !== 'VNĐ');
    return portfolio
      .filter(p => p.ticker !== 'VNĐ')
      .filter(p => p.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [portfolio, searchTerm]);

  // ============================================================
  // CSV IMPORT HANDLER
  // ============================================================

  const handleImportCSV = async () => {
    if (transactions.length > 0) {
      if (!confirm(`Hiện có ${transactions.length} giao dịch trong Firebase. Bạn muốn import thêm ${CSV_RAW_DATA.split('\n').length - 1} giao dịch từ CSV?`)) {
        return;
      }
    }

    setImporting(true);
    try {
      const count = await importCSVToFirestore(CSV_RAW_DATA);
      alert(`✅ Import thành công ${count} giao dịch!`);
    } catch (err) {
      console.error('Import error:', err);
      alert('❌ Lỗi import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ============================================================
  // NAV ITEMS
  // ============================================================

  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: "Tổng quan" },
    { id: 'portfolio', icon: <Briefcase size={20} />, label: "Danh mục Đầu tư" },
    { id: 'rebalance', icon: <Scale size={20} />, label: "Tái cơ cấu" },
    { id: 'transactions', icon: <ArrowRightLeft size={20} />, label: "Nhật ký GD" },
  ];

  // Donut chart data
  const allocationChartData = useMemo(() => {
    const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const classMap = {};
    portfolio.forEach(p => {
      if (!classMap[p.assetClass]) classMap[p.assetClass] = 0;
      classMap[p.assetClass] += p.actualValue;
    });
    return Object.entries(classMap)
      .filter(([, v]) => v > 0)
      .map(([label, value], i) => ({
        label,
        value,
        color: COLORS[i % COLORS.length]
      }));
  }, [portfolio]);

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <Activity size={40} />
          </div>
          <h2 className="loading-title">V5.0 Portfolio</h2>
          <p className="loading-subtitle">Đang kết nối Firebase...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app-layout">
      {/* Transaction Modal */}
      <AddTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* --- SIDEBAR --- */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="sidebar-title">V5.0 Portfolio</h1>
            <p className="sidebar-subtitle">Quản lý tài sản cá nhân</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? 'nav-item--active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer — Exchange Rates */}
        <div className="sidebar-footer">
          <div className="sidebar-rates glass-card-mini">
            <h4 className="sidebar-rates-title">
              Tỷ giá tham chiếu
              <RefreshCw size={14} className="sidebar-rates-refresh" />
            </h4>
            <div className="sidebar-rates-list">
              <div className="sidebar-rate-row">
                <span>USDT/VNĐ</span>
                <span className="sidebar-rate-value">
                  {marketPrices['USDT']?.exchangeRate
                    ? formatNum(marketPrices['USDT'].exchangeRate)
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* CSV Import Button */}
          {transactions.length === 0 && (
            <button className="btn-glass import-btn" onClick={handleImportCSV} disabled={importing}>
              {importing ? (
                <><Loader2 size={16} className="spin" /> Đang import...</>
              ) : (
                <><Upload size={16} /> Import dữ liệu CSV</>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* --- MOBILE HEADER --- */}
      <div className="main-container">
        <header className="mobile-header">
          <div className="mobile-header-brand">
            <Activity size={22} className="color-primary" />
            <h1>V5.0 Portfolio</h1>
          </div>
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile Dropdown */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-dropdown">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                className={`nav-item ${activeTab === item.id ? 'nav-item--active' : ''}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        )}

        {/* --- MAIN CONTENT --- */}
        <main className="main-content">
          <div className="content-wrapper">

            {/* ===== DASHBOARD ===== */}
            {activeTab === 'dashboard' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Tổng quan Tài sản</h2>
                    <p className="section-subtitle">Cập nhật Net Worth và hiệu suất danh mục đầu tư.</p>
                  </div>
                  <button className="btn-primary btn-hidden-mobile" onClick={() => setIsModalOpen(true)}>
                    <PlusCircle size={18} />
                    Ghi nhận Giao dịch
                  </button>
                </div>

                {/* KPI Cards */}
                <div className="kpi-grid">
                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--blue">
                      <Wallet size={24} />
                    </div>
                    <h3 className="kpi-label">Tổng Tài Sản (Net Worth)</h3>
                    <p className="kpi-value">{formatVND(netWorth.totalNetWorth)}</p>
                  </div>

                  <div className="kpi-card glass-card">
                    <div className="kpi-icon kpi-icon--indigo">
                      <PieChart size={24} />
                    </div>
                    <h3 className="kpi-label">Giá trị Danh mục Đầu tư</h3>
                    <p className="kpi-value">{formatVND(pnlSummary.totalValue)}</p>
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
                    <h3 className="kpi-label">Tổng Lãi/Lỗ Danh mục</h3>
                    <p className={`kpi-value ${pnlSummary.totalPnL >= 0 ? 'color-up' : 'color-down'}`}>
                      {pnlSummary.totalPnL > 0 ? '+' : ''}{formatVND(pnlSummary.totalPnL)}
                    </p>
                  </div>
                </div>

                {/* Asset Allocation */}
                <div className="glass-card section-card">
                  <h3 className="card-title">Cơ cấu Tổng tài sản</h3>

                  {/* Progress bar */}
                  <div className="allocation-bar">
                    <div
                      className="allocation-bar-segment allocation-bar-segment--liquid"
                      style={{ width: `${netWorth.totalNetWorth > 0 ? (netWorth.totalLiquid / netWorth.totalNetWorth) * 100 : 0}%` }}
                      title="Thanh khoản"
                    ></div>
                    <div
                      className="allocation-bar-segment allocation-bar-segment--invest"
                      style={{ width: `${netWorth.totalNetWorth > 0 ? (netWorth.totalInvest / netWorth.totalNetWorth) * 100 : 0}%` }}
                      title="Đầu tư"
                    ></div>
                  </div>

                  <div className="allocation-grid">
                    {/* Liquid */}
                    <div>
                      <div className="allocation-header">
                        <div className="allocation-header-left">
                          <div className="dot dot--liquid"></div>
                          <h4>Thanh khoản cao</h4>
                        </div>
                        <span className="allocation-pct allocation-pct--liquid">
                          {netWorth.totalNetWorth > 0 ? ((netWorth.totalLiquid / netWorth.totalNetWorth) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="allocation-items">
                        {netWorth.liquidAssets.map(item => (
                          <div key={item.id} className="allocation-item">
                            <span className="allocation-item-name">{item.name}</span>
                            <span className="allocation-item-value">{formatVND(item.value)}</span>
                          </div>
                        ))}
                        {netWorth.liquidAssets.length === 0 && (
                          <p className="allocation-empty">Chưa có tài sản thanh khoản</p>
                        )}
                      </div>
                    </div>

                    {/* Invest */}
                    <div>
                      <div className="allocation-header">
                        <div className="allocation-header-left">
                          <div className="dot dot--invest"></div>
                          <h4>Đầu tư dài hạn</h4>
                        </div>
                        <span className="allocation-pct allocation-pct--invest">
                          {netWorth.totalNetWorth > 0 ? ((netWorth.totalInvest / netWorth.totalNetWorth) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="allocation-items">
                        {netWorth.investAssets.map(item => (
                          <div key={item.id} className="allocation-item">
                            <span className="allocation-item-name">{item.name}</span>
                            <span className="allocation-item-value">{formatVND(item.value)}</span>
                          </div>
                        ))}
                        {netWorth.investAssets.length === 0 && (
                          <p className="allocation-empty">Chưa có tài sản đầu tư</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Donut Chart */}
                {allocationChartData.length > 0 && (
                  <div className="glass-card section-card">
                    <h3 className="card-title">Phân bổ theo loại tài sản</h3>
                    <AssetAllocationChart data={allocationChartData} size={240} />
                  </div>
                )}

                {/* External Assets Manager */}
                <div className="glass-card section-card">
                  <NetWorthExternalManager externalAssets={externalAssets} />
                </div>
              </div>
            )}

            {/* ===== PORTFOLIO ===== */}
            {activeTab === 'portfolio' && (
              <div className="animate-fade-in">
                <div className="section-header section-header-row">
                  <div>
                    <h2 className="section-title">Danh mục & Tỷ giá</h2>
                    <p className="section-subtitle">
                      Chi tiết hiệu suất từng mã tài sản đang nắm giữ — {filteredPortfolio.length} mã
                    </p>
                  </div>
                  <div className="search-box">
                    <Search size={16} className="search-icon" />
                    <input
                      type="text"
                      placeholder="Tìm mã (VD: VFF, BTC...)"
                      className="search-input"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="glass-card table-wrapper">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tài sản / Mã</th>
                          <th className="text-right">Số lượng</th>
                          <th className="text-right">Giá vốn TB</th>
                          <th className="text-right">Giá HT</th>
                          <th className="text-right">Tổng GT (VNĐ)</th>
                          <th className="text-right">Lãi / Lỗ</th>
                          <th className="text-right">% L/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPortfolio.length === 0 ? (
                          <tr><td colSpan={7} className="table-empty">Không có tài sản nào</td></tr>
                        ) : filteredPortfolio.map((item, idx) => (
                          <tr key={idx} className="table-row-hover">
                            <td>
                              <div className="td-ticker">{item.ticker}</div>
                              <div className="td-meta">{item.assetClass} • {item.storage || '—'}</div>
                            </td>
                            <td className="text-right td-mono">{formatNum(item.qty)}</td>
                            <td className="text-right td-mono td-muted">{formatNum(item.avgCost)}</td>
                            <td className="text-right td-mono td-muted">{formatNum(item.marketPrice)}</td>
                            <td className="text-right td-mono td-bold">{formatVND(item.actualValue)}</td>
                            <td className={`text-right td-mono td-bold ${item.pnl >= 0 ? 'color-up' : 'color-down'}`}>
                              {item.pnl > 0 ? '+' : ''}{formatVND(item.pnl)}
                            </td>
                            <td className="text-right">
                              <span className={`pnl-badge ${item.pnl >= 0 ? 'pnl-badge--up' : 'pnl-badge--down'}`}>
                                {formatPercent(item.pnlPercent)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {filteredPortfolio.length > 0 && (
                        <tfoot>
                          <tr className="table-footer-row">
                            <td colSpan={4} className="td-bold">Tổng cộng</td>
                            <td className="text-right td-bold">{formatVND(pnlSummary.totalValue)}</td>
                            <td className={`text-right td-bold ${pnlSummary.totalPnL >= 0 ? 'color-up' : 'color-down'}`}>
                              {pnlSummary.totalPnL > 0 ? '+' : ''}{formatVND(pnlSummary.totalPnL)}
                            </td>
                            <td className="text-right">
                              <span className={`pnl-badge ${pnlSummary.totalPnL >= 0 ? 'pnl-badge--up' : 'pnl-badge--down'}`}>
                                {formatPercent(pnlSummary.totalPnLPercent)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ===== REBALANCE ===== */}
            {activeTab === 'rebalance' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Bảng Tái cơ cấu (Rebalance)</h2>
                    <p className="section-subtitle">
                      So sánh tỷ trọng thực tế với mục tiêu. Chênh lệch lớn yêu cầu Mua/Bán.
                    </p>
                  </div>
                  <RebalanceSettings
                    currentTargets={rebalanceTargets}
                    onSave={(targets) => setRebalanceTargets(targets)}
                  />
                </div>

                <div className="rebalance-grid">
                  {rebalanceData.map((item, idx) => {
                    const actionStyles = {
                      hold: { bg: 'var(--glass-bg)', color: 'var(--text-secondary)', border: 'var(--glass-border)' },
                      buy: { bg: 'var(--color-emerald-500)', color: '#fff', border: 'var(--color-emerald-500)' },
                      sell: { bg: 'var(--color-rose-500)', color: '#fff', border: 'var(--color-rose-500)' },
                    };
                    const style = actionStyles[item.action.type];

                    return (
                      <div key={idx} className="rebalance-card glass-card">
                        <div className="rebalance-card-header">
                          <div>
                            <h3 className="rebalance-card-title">{item.label || item.assetClass}</h3>
                            <p className="rebalance-card-value">{formatVND(item.actualValue)}</p>
                          </div>
                          <span
                            className="rebalance-action-badge"
                            style={{ background: style.bg, color: style.color, borderColor: style.border }}
                          >
                            {item.action.text}
                          </span>
                        </div>

                        <div className="rebalance-card-body">
                          <div className="rebalance-weights">
                            <span>Thực tế: <strong>{item.actualWeight.toFixed(2)}%</strong></span>
                            <span>Mục tiêu: <strong>{item.targetWeight.toFixed(2)}%</strong></span>
                          </div>

                          <div className="rebalance-bar">
                            <div
                              className="rebalance-bar-target"
                              style={{ left: `${Math.min(item.targetWeight, 100)}%` }}
                            ></div>
                            <div
                              className={`rebalance-bar-fill rebalance-bar-fill--${item.action.type}`}
                              style={{ width: `${Math.min(item.actualWeight, 100)}%` }}
                            ></div>
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

            {/* ===== TRANSACTIONS ===== */}
            {activeTab === 'transactions' && (
              <div className="animate-fade-in">
                <div className="section-header">
                  <div>
                    <h2 className="section-title">Nhật ký Giao dịch</h2>
                    <p className="section-subtitle">Lịch sử giao dịch và ghi chú đầu tư.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <PlusCircle size={18} />
                    Thêm Giao dịch
                  </button>
                </div>

                <TransactionLog
                  transactions={transactions}
                  loading={loading}
                />
              </div>
            )}

          </div>
        </main>

        {/* Mobile FAB */}
        <button className="fab" onClick={() => setIsModalOpen(true)}>
          <PlusCircle size={24} />
        </button>
      </div>
    </div>
  );
}