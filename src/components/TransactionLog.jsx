import React, { useState, useMemo } from 'react';
import { Trash2, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, FileDown, Edit, ChevronDown, ChevronUp } from 'lucide-react';
import { apiDeleteTransaction } from '../services/api';
import { formatVND, formatNum, formatQty } from '../utils/formatters';

const TX_TYPE_STYLES = {
  'Nạp tiền': { bg: 'var(--color-emerald-100)', color: 'var(--color-emerald-700)', label: 'N' },
  'Mua': { bg: 'var(--color-blue-100)', color: 'var(--color-blue-700)', label: 'M' },
  'Bán': { bg: 'var(--color-rose-100)', color: 'var(--color-rose-700)', label: 'B' },
};

/**
 * Parse Vietnamese date "dd/mm/yyyy HH:MM:SS" → { year, month, day, Date }
 */
function parseVNDate(dateStr) {
  if (!dateStr) return { year: '????', month: '??', day: '??', ts: new Date(0) };
  const parts = dateStr.split(' ');
  const d = (parts[0] || '').split('/');
  const t = (parts[1] || '00:00:00').split(':');
  if (d.length === 3) {
    return {
      year: d[2],
      month: d[1],
      day: d[0],
      ts: new Date(parseInt(d[2]), parseInt(d[1]) - 1, parseInt(d[0]),
        parseInt(t[0] || 0), parseInt(t[1] || 0), parseInt(t[2] || 0))
    };
  }
  return { year: '????', month: '??', day: '??', ts: new Date(dateStr || 0) };
}

const MONTH_NAMES = {
  '01': 'Tháng 1', '02': 'Tháng 2', '03': 'Tháng 3', '04': 'Tháng 4',
  '05': 'Tháng 5', '06': 'Tháng 6', '07': 'Tháng 7', '08': 'Tháng 8',
  '09': 'Tháng 9', '10': 'Tháng 10', '11': 'Tháng 11', '12': 'Tháng 12',
};

export default function TransactionLog({ transactions = [], loading = false, onUpdate, onEdit }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  // Track collapsed year/month sections; default all expanded
  const [collapsedSections, setCollapsedSections] = useState({});

  // Get unique asset classes for filter
  const assetClasses = useMemo(() => {
    const classes = new Set(transactions.map(t => t.assetClass).filter(Boolean));
    return Array.from(classes).sort();
  }, [transactions]);

  // Filter & sort
  const filtered = useMemo(() => {
    let result = [...transactions];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        (t.ticker || '').toLowerCase().includes(term) ||
        (t.notes || '').toLowerCase().includes(term) ||
        (t.assetClass || '').toLowerCase().includes(term)
      );
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(t => t.transactionType === filterType);
    }

    // Filter by asset class
    if (filterAssetClass !== 'all') {
      result = result.filter(t => t.assetClass === filterAssetClass);
    }

    // Sort by date (always desc by default for grouping to show newest first)
    result.sort((a, b) => {
      const pa = parseVNDate(a.date);
      const pb = parseVNDate(b.date);

      if (sortField === 'date') {
        return sortDir === 'desc' ? pb.ts - pa.ts : pa.ts - pb.ts;
      } else if (sortField === 'totalVND') {
        const va = Math.abs(a.totalVND || 0);
        const vb = Math.abs(b.totalVND || 0);
        return sortDir === 'desc' ? vb - va : va - vb;
      } else if (sortField === 'ticker') {
        const va = a.ticker || '';
        const vb = b.ticker || '';
        return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
      }
      return 0;
    });

    return result;
  }, [transactions, searchTerm, filterType, filterAssetClass, sortField, sortDir]);

  // Group filtered transactions: Year → Month → txs[]
  const grouped = useMemo(() => {
    const years = {};
    filtered.forEach(tx => {
      const p = parseVNDate(tx.date);
      if (!years[p.year]) years[p.year] = { months: {}, total: 0 };
      if (!years[p.year].months[p.month]) years[p.year].months[p.month] = [];
      years[p.year].months[p.month].push(tx);
      years[p.year].total += Math.abs(tx.totalVND || 0);
    });

    // Sort years desc
    const sortedYears = Object.keys(years).sort((a, b) =>
      sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
    );

    return sortedYears.map(year => {
      const sortedMonths = Object.keys(years[year].months).sort((a, b) =>
        sortDir === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
      );
      return {
        year,
        yearTotal: years[year].total,
        months: sortedMonths.map(month => ({
          month,
          label: MONTH_NAMES[month] || `Tháng ${month}`,
          txs: years[year].months[month],
          monthTotal: years[year].months[month].reduce((s, t) => s + Math.abs(t.totalVND || 0), 0),
        }))
      };
    });
  }, [filtered, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const toggleSection = (key) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDelete = async (tx) => {
    if (!confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    try {
      await apiDeleteTransaction(tx.id);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Lỗi khi xóa giao dịch.');
    }
  };

  const renderTxRow = (tx) => {
    const typeStyle = TX_TYPE_STYLES[tx.transactionType] || TX_TYPE_STYLES['Mua'];
    return (
      <tr key={tx.id} className="table-row-hover">
        <td className="td-date">{tx.date}</td>
        <td>
          <span
            className="tx-badge"
            style={{ background: typeStyle.bg, color: typeStyle.color }}
          >
            {tx.transactionType}
          </span>
        </td>
        <td className="td-muted">{tx.assetClass}</td>
        <td className="td-ticker">{tx.ticker}</td>
        <td className="text-right td-mono">
          {tx.quantity ? formatQty(Math.abs(tx.quantity), tx.assetClass) : '—'}
        </td>
        <td className="text-right td-mono td-muted">
          {tx.unitPrice ? formatNum(tx.unitPrice) : '—'}
        </td>
        <td className="text-right td-mono td-muted">
          {tx.exchangeRate && tx.exchangeRate !== 1 ? formatNum(tx.exchangeRate) : '—'}
        </td>
        <td className="text-right td-mono td-bold">
          {formatVND(Math.abs(tx.totalVND || 0))}
        </td>
        <td className="td-muted">{tx.storage || '—'}</td>
        <td className="td-notes" title={tx.notes || ''}>
          {tx.notes ? (
            <span className="notes-text">{tx.notes}</span>
          ) : '—'}
        </td>
        <td className="text-center" style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            className="btn-icon"
            onClick={() => onEdit(tx)}
            title="Sửa giao dịch"
          >
            <Edit size={14} />
          </button>
          <button
            className="btn-icon btn-icon-danger"
            onClick={() => handleDelete(tx)}
            title="Xóa giao dịch"
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="animate-fade-in">
      <header className="section-header">
        <div>
          <h2 className="section-title">Nhật ký Giao dịch</h2>
          <p className="section-subtitle">
            Lịch sử giao dịch chi tiết — {filtered.length} giao dịch
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="filters-bar glass-card">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Tìm mã, ghi chú..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); }}
          />
        </div>

        <div className="filter-selects">
          <select
            className="filter-select"
            value={filterType}
            onChange={e => { setFilterType(e.target.value); }}
          >
            <option value="all">Tất cả loại GD</option>
            <option value="Nạp tiền">Nạp tiền</option>
            <option value="Mua">Mua</option>
            <option value="Bán">Bán</option>
          </select>

          <select
            className="filter-select"
            value={filterAssetClass}
            onChange={e => { setFilterAssetClass(e.target.value); }}
          >
            <option value="all">Tất cả tài sản</option>
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>{ac}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grouped Table */}
      <div className="glass-card table-wrapper">
        {loading ? (
          <div className="table-empty" style={{ padding: '48px', textAlign: 'center' }}>
            <div className="spinner"></div>
            Đang tải dữ liệu...
          </div>
        ) : grouped.length === 0 ? (
          <div className="table-empty" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Không có giao dịch nào.
          </div>
        ) : (
          grouped.map(yearGroup => {
            const yearKey = `year-${yearGroup.year}`;
            const yearCollapsed = collapsedSections[yearKey];
            return (
              <div key={yearGroup.year} className="tx-year-group">
                {/* Year header */}
                <div
                  className="tx-group-header tx-year-header"
                  onClick={() => toggleSection(yearKey)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="tx-group-header-left">
                    {yearCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    <span className="tx-group-year-label">Năm {yearGroup.year}</span>
                  </div>
                  <div className="tx-group-header-right">
                    <span className="tx-group-count">
                      {yearGroup.months.reduce((s, m) => s + m.txs.length, 0)} giao dịch
                    </span>
                    <span className="tx-group-total">{formatVND(yearGroup.yearTotal)}</span>
                  </div>
                </div>

                {!yearCollapsed && yearGroup.months.map(monthGroup => {
                  const monthKey = `month-${yearGroup.year}-${monthGroup.month}`;
                  const monthCollapsed = collapsedSections[monthKey];
                  return (
                    <div key={monthGroup.month} className="tx-month-group">
                      {/* Month header */}
                      <div
                        className="tx-group-header tx-month-header"
                        onClick={() => toggleSection(monthKey)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="tx-group-header-left">
                          {monthCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                          <span className="tx-group-month-label">{monthGroup.label}</span>
                        </div>
                        <div className="tx-group-header-right">
                          <span className="tx-group-count">{monthGroup.txs.length} GD</span>
                          <span className="tx-group-total">{formatVND(monthGroup.monthTotal)}</span>
                        </div>
                      </div>

                      {!monthCollapsed && (
                        <div className="table-scroll">
                          <table className="data-table tx-grouped-table">
                            <thead>
                              <tr>
                                <th className="th-sortable" onClick={() => handleSort('date')}>
                                  Ngày giờ
                                  <ArrowUpDown size={12} />
                                </th>
                                <th>Loại</th>
                                <th>Tài sản</th>
                                <th className="th-sortable" onClick={() => handleSort('ticker')}>
                                  Mã
                                  <ArrowUpDown size={12} />
                                </th>
                                <th className="text-right">Số lượng</th>
                                <th className="text-right">Đơn giá</th>
                                <th className="text-right">Tỷ giá</th>
                                <th className="text-right th-sortable" onClick={() => handleSort('totalVND')}>
                                  Thành tiền (VNĐ)
                                  <ArrowUpDown size={12} />
                                </th>
                                <th>Nơi lưu trữ</th>
                                <th>Ghi chú</th>
                                <th className="text-center">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthGroup.txs.map(tx => renderTxRow(tx))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
