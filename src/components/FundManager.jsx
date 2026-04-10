import React, { useState, useMemo, useEffect } from 'react';
import { Landmark, PlusCircle, MinusCircle, Wallet, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Clock, FileText } from 'lucide-react';
import { apiUpdateFund, apiGetFundCashHistory, apiAddFundCashHistory } from '../services/api';
import { formatVND, formatNum, formatPercent, formatQty } from '../utils/formatters';
import LineChart from './charts/LineChart';

export default function FundManager({ funds = [], portfolio = [], transactions = [], snapshots = [], onUpdate }) {
  const [expandedFund, setExpandedFund] = useState(null);
  const [depositForm, setDepositForm] = useState({ fundId: null, type: 'deposit', amount: '', note: '' });
  const [cashHistories, setCashHistories] = useState({}); // { fundId: [...records] }
  const [showHistory, setShowHistory] = useState({}); // { fundId: boolean }

  // Fetch cash history when a fund is expanded
  useEffect(() => {
    if (expandedFund && !cashHistories[expandedFund]) {
      apiGetFundCashHistory(expandedFund)
        .then(data => {
          setCashHistories(prev => ({ ...prev, [expandedFund]: data || [] }));
        })
        .catch(err => {
          console.error('Error fetching cash history:', err);
          setCashHistories(prev => ({ ...prev, [expandedFund]: [] }));
        });
    }
  }, [expandedFund]);

  // Calculate fund holdings from portfolio
  const fundData = useMemo(() => {
    return funds.map(fund => {
      // Holdings in this fund (matched by assetClass)
      const holdings = portfolio.filter(p =>
        p.assetClass === fund.assetClass ||
        (fund.assetClass === 'Tiền mặt' && (p.assetClass === 'Tiền mặt VNĐ' || p.assetClass === 'Tiền mặt USD'))
      );

      const holdingsValue = holdings.reduce((s, h) => s + h.actualValue, 0);
      const holdingsCost = holdings.reduce((s, h) => s + h.totalCost, 0);
      const pnl = holdingsValue - holdingsCost;
      const pnlPercent = holdingsCost > 0 ? (pnl / holdingsCost) * 100 : 0;
      const cashBalance = parseFloat(fund.cashBalance) || 0;
      const totalValue = holdingsValue + cashBalance;

      return {
        ...fund,
        holdings,
        holdingsValue,
        holdingsCost,
        pnl,
        pnlPercent,
        cashBalance,
        totalValue,
      };
    });
  }, [funds, portfolio]);

  const totalAllFunds = fundData.reduce((s, f) => s + f.totalValue, 0);

  const handleDeposit = async () => {
    const fund = funds.find(f => f.id === depositForm.fundId);
    if (!fund || !depositForm.amount) return;

    const amount = parseFloat(depositForm.amount) || 0;
    const currentCash = parseFloat(fund.cashBalance) || 0;

    if (depositForm.type === 'withdraw' && amount > currentCash) {
      alert('Số tiền rút vượt quá số dư tiền mặt trong quỹ!');
      return;
    }

    const newCash = depositForm.type === 'deposit'
      ? currentCash + amount
      : currentCash - amount;

    try {
      // Record cash history with note
      await apiAddFundCashHistory(fund.id, {
        fundId: fund.id,
        fundName: fund.name,
        type: depositForm.type,
        amount: amount,
        balanceBefore: currentCash,
        balanceAfter: newCash,
        note: depositForm.note || '',
      });

      // Refresh local cache of this fund's history
      const updatedHistory = await apiGetFundCashHistory(fund.id);
      setCashHistories(prev => ({ ...prev, [fund.id]: updatedHistory || [] }));

      setDepositForm({ fundId: null, type: 'deposit', amount: '', note: '' });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi cập nhật quỹ.');
    }
  };

  // Fund growth chart data from snapshots
  const getFundChartData = (fundName) => {
    const data = snapshots
      .filter(s => s.funds && s.funds[fundName])
      .map(s => ({
        x: s.date,
        y: s.funds[fundName].value || 0
      }));
    return data.length > 1 ? [{ label: fundName, data, color: funds.find(f => f.name === fundName)?.color || '#3b82f6' }] : [];
  };

  const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Quỹ Đầu tư</h2>
          <p className="section-subtitle">Quản lý danh mục theo từng quỹ — Tổng: {formatVND(totalAllFunds)}</p>
        </div>
      </div>

      <div className="fund-grid">
        {fundData.map(fund => {
          const isExpanded = expandedFund === fund.id;
          const isDepositing = depositForm.fundId === fund.id;
          const pctOfTotal = totalAllFunds > 0 ? (fund.totalValue / totalAllFunds) * 100 : 0;
          const history = cashHistories[fund.id] || [];
          const isHistoryVisible = showHistory[fund.id] || false;

          return (
            <div key={fund.id} className={`fund-card glass-card ${isExpanded ? 'fund-card--expanded' : ''}`}>
              {/* Card Header */}
              <div className="fund-card-header" onClick={() => setExpandedFund(isExpanded ? null : fund.id)}>
                <div className="fund-card-info">
                  <div className="fund-card-icon" style={{ background: fund.color || '#6366f1' }}>
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 className="fund-card-name">{fund.name}</h3>
                    <p className="fund-card-desc">
                      {fund.description}
                      <span style={{ display: 'inline-block', marginLeft: '6px', paddingLeft: '6px', borderLeft: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                        Tiền mặt: <strong>{formatVND(fund.cashBalance)}</strong>
                      </span>
                    </p>
                  </div>
                </div>
                <div className="fund-card-values">
                  <div className="fund-card-total">{formatVND(fund.totalValue)}</div>
                  <div className={`fund-card-pnl ${fund.pnl >= 0 ? 'color-up' : 'color-down'}`}>
                    {fund.pnl > 0 ? '+' : ''}{formatVND(fund.pnl)} ({formatPercent(fund.pnlPercent)})
                  </div>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* Allocation bar */}
              <div className="fund-allocation-bar">
                <div className="fund-allocation-fill" style={{ width: `${pctOfTotal}%`, background: fund.color }}></div>
              </div>
              <div className="fund-allocation-label">{pctOfTotal.toFixed(1)}% danh mục</div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="fund-card-body">
                  {/* Cash Balance */}
                  <div className="fund-cash-row">
                    <div className="fund-cash-info">
                      <Wallet size={16} />
                      <span>Tiền mặt trong quỹ</span>
                    </div>
                    <span className="fund-cash-value">{formatVND(fund.cashBalance)}</span>
                  </div>

                  {/* Deposit/Withdraw */}
                  {isDepositing ? (
                    <div className="fund-deposit-form">
                      <div className="tx-type-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <button
                          type="button"
                          className={`tx-type-btn ${depositForm.type === 'deposit' ? 'tx-type-btn--active tx-type-btn--emerald' : ''}`}
                          onClick={() => setDepositForm(p => ({ ...p, type: 'deposit' }))}
                        >
                          <PlusCircle size={14} /> Nạp tiền
                        </button>
                        <button
                          type="button"
                          className={`tx-type-btn ${depositForm.type === 'withdraw' ? 'tx-type-btn--active tx-type-btn--rose' : ''}`}
                          onClick={() => setDepositForm(p => ({ ...p, type: 'withdraw' }))}
                        >
                          <MinusCircle size={14} /> Rút tiền
                        </button>
                      </div>
                      <input
                        type="number" className="form-input form-input-sm"
                        placeholder="Số tiền (VNĐ)"
                        value={depositForm.amount}
                        onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
                      />
                      <input
                        type="text" className="form-input form-input-sm"
                        placeholder="Ghi chú (VD: DCA tháng 4, Rút lãi crypto...)"
                        value={depositForm.note}
                        onChange={e => setDepositForm(p => ({ ...p, note: e.target.value }))}
                      />
                      <div className="fund-deposit-actions">
                        <button className="btn-primary btn-sm" onClick={handleDeposit}>Xác nhận</button>
                        <button className="btn-ghost btn-sm" onClick={() => setDepositForm({ fundId: null, type: 'deposit', amount: '', note: '' })}>Hủy</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-glass btn-sm fund-deposit-btn"
                      onClick={() => setDepositForm({ fundId: fund.id, type: 'deposit', amount: '', note: '' })}
                    >
                      <Wallet size={14} /> Nạp / Rút tiền quỹ
                    </button>
                  )}

                  {/* Cash History Toggle */}
                  <button
                    className="btn-glass btn-sm fund-history-btn"
                    onClick={() => setShowHistory(prev => ({ ...prev, [fund.id]: !prev[fund.id] }))}
                    style={{ marginTop: '0.5rem' }}
                  >
                    <Clock size={14} />
                    {isHistoryVisible ? 'Ẩn lịch sử nạp/rút' : `Xem lịch sử nạp/rút (${history.length})`}
                  </button>

                  {/* Cash History Table */}
                  {isHistoryVisible && history.length > 0 && (
                    <div className="fund-cash-history">
                      <table className="data-table fund-table">
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Loại</th>
                            <th className="text-right">Số tiền</th>
                            <th className="text-right">Số dư sau</th>
                            <th>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((h, i) => (
                            <tr key={h.id || i}>
                              <td className="td-date">{formatHistoryDate(h.createdAt)}</td>
                              <td>
                                <span
                                  className="tx-badge"
                                  style={{
                                    background: h.type === 'deposit' ? 'var(--color-emerald-100)' : 'var(--color-rose-100)',
                                    color: h.type === 'deposit' ? 'var(--color-emerald-700)' : 'var(--color-rose-700)',
                                  }}
                                >
                                  {h.type === 'deposit' ? 'Nạp' : 'Rút'}
                                </span>
                              </td>
                              <td className={`text-right td-mono ${h.type === 'deposit' ? 'color-up' : 'color-down'}`}>
                                {h.type === 'deposit' ? '+' : '-'}{formatVND(h.amount)}
                              </td>
                              <td className="text-right td-mono">{formatVND(h.balanceAfter)}</td>
                              <td className="td-notes" title={h.note || ''}>
                                {h.note ? (
                                  <span className="notes-text"><FileText size={12} style={{ marginRight: 4, opacity: 0.5 }} />{h.note}</span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isHistoryVisible && history.length === 0 && (
                    <p className="fund-history-empty">Chưa có lịch sử nạp/rút tiền.</p>
                  )}

                  {/* Holdings Table */}
                  {fund.holdings.length > 0 && (
                    <div className="fund-holdings">
                      <h4 className="fund-holdings-title">Tài sản trong quỹ</h4>
                      <table className="data-table fund-table">
                        <thead>
                          <tr>
                            <th>Mã</th>
                            <th className="text-right">SL</th>
                            <th className="text-right">Giá vốn</th>
                            <th className="text-right">Giá trị</th>
                            <th className="text-right">L/L</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fund.holdings.map((h, i) => (
                            <tr key={i}>
                              <td className="td-ticker">{h.ticker}</td>
                              <td className="text-right td-mono">{formatQty(h.qty, h.assetClass)}</td>
                              <td className="text-right td-mono td-muted">{formatNum(h.avgCost)}</td>
                              <td className="text-right td-mono td-bold">{formatVND(h.actualValue)}</td>
                              <td className={`text-right td-mono ${h.pnl >= 0 ? 'color-up' : 'color-down'}`}>
                                <span className={`pnl-badge ${h.pnl >= 0 ? 'pnl-badge--up' : 'pnl-badge--down'}`}>
                                  {formatPercent(h.pnlPercent)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Fund Growth Chart */}
                  {(() => {
                    const chartData = getFundChartData(fund.name);
                    return chartData.length > 0 ? (
                      <div className="fund-chart-section">
                        <LineChart datasets={chartData} height={200} title={`Tăng trưởng ${fund.name}`} />
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
