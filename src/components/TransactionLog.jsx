import React, { useState, useMemo } from 'react';
import { Trash2, Search, Filter, ChevronLeft, ChevronRight, ArrowUpDown, FileDown } from 'lucide-react';
import { apiDeleteTransaction } from '../services/api';
import { formatVND, formatNum } from '../utils/formatters';

const ITEMS_PER_PAGE = 15;

const TX_TYPE_STYLES = {
  'Nạp tiền': { bg: 'var(--color-emerald-100)', color: 'var(--color-emerald-700)', label: 'N' },
  'Mua': { bg: 'var(--color-blue-100)', color: 'var(--color-blue-700)', label: 'M' },
  'Bán': { bg: 'var(--color-rose-100)', color: 'var(--color-rose-700)', label: 'B' },
};

export default function TransactionLog({ transactions = [], loading = false, onUpdate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterAssetClass, setFilterAssetClass] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

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

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (sortField === 'totalVND') {
        valA = Math.abs(a.totalVND || 0);
        valB = Math.abs(b.totalVND || 0);
      } else if (sortField === 'ticker') {
        valA = a.ticker || '';
        valB = b.ticker || '';
      }

      if (sortDir === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    return result;
  }, [transactions, searchTerm, filterType, filterAssetClass, sortField, sortDir]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    try {
      await apiDeleteTransaction(id);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Lỗi khi xóa giao dịch.');
    }
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
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="filter-selects">
          <select
            className="filter-select"
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">Tất cả loại GD</option>
            <option value="Nạp tiền">Nạp tiền</option>
            <option value="Mua">Mua</option>
            <option value="Bán">Bán</option>
          </select>

          <select
            className="filter-select"
            value={filterAssetClass}
            onChange={e => { setFilterAssetClass(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">Tất cả tài sản</option>
            {assetClasses.map(ac => (
              <option key={ac} value={ac}>{ac}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card table-wrapper">
        <div className="table-scroll">
          <table className="data-table">
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
                <th className="text-center">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="table-empty">
                  <div className="spinner"></div>
                  Đang tải dữ liệu...
                </td></tr>
              ) : paginatedData.length === 0 ? (
                <tr><td colSpan={10} className="table-empty">
                  Không có giao dịch nào.
                </td></tr>
              ) : paginatedData.map(tx => {
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
                      {tx.quantity ? formatNum(Math.abs(tx.quantity)) : '—'}
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
                    <td className="text-center">
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => handleDelete(tx.id)}
                        title="Xóa giao dịch"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pagination-info">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
