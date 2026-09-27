import React, { useState } from 'react';
import { PlusCircle, Download, Upload } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { PageHeader } from '../components/ui';
import TransactionLog from '../components/TransactionLog.jsx';
import ImportCSVModal from '../components/ImportCSVModal.jsx';
import DataIssues from '../components/DataIssues.jsx';
import { sortTransactions } from '../utils/portfolioCalculator.js';

const CSV_COLUMNS = [
  ['date', 'Ngày giờ'], ['transactionType', 'Loại giao dịch'], ['assetClass', 'Loại tài sản'], ['ticker', 'Mã'],
  ['quantity', 'Số lượng'], ['unitPrice', 'Đơn giá'], ['currency', 'Loại tiền'], ['exchangeRate', 'Tỷ giá'],
  ['totalVND', 'Thành tiền (VNĐ)'], ['pnlVND', 'Lãi/Lỗ VNĐ'], ['storage', 'Nơi lưu trữ'], ['notes', 'Ghi chú'],
];

/**
 * CSV export. "Lãi/Lỗ VNĐ" of a sale is the realized P&L the engine computes
 * now (proceeds − average cost on the sale date), not the figure stored when
 * the row was entered, which goes stale once earlier rows are edited.
 */
function toCSV(transactions, realizedById) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const value = (t, k) => (k === 'pnlVND' && realizedById.has(t.id) ? Math.round(realizedById.get(t.id)) : t[k]);
  const lines = [CSV_COLUMNS.map(c => c[1]).join(',')];
  for (const t of sortTransactions(transactions)) lines.push(CSV_COLUMNS.map(([k]) => esc(value(t, k))).join(','));
  return '﻿' + lines.join('\n');
}

/** PP → Accounts → All Transactions */
export default function TransactionsView() {
  const { transactions, replay, dataIssues, loading, refresh, openTransactionModal } = usePortfolioData();
  const [importOpen, setImportOpen] = useState(false);
  const hasWarnings = dataIssues.some(i => i.level === 'warning');
  const [notice, setNotice] = useState(null);

  const exportCSV = () => {
    const realizedById = new Map();
    for (const t of replay.trades) if (t.id) realizedById.set(t.id, (realizedById.get(t.id) || 0) + t.pnl);
    const blob = new Blob([toCSV(transactions, realizedById)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giao-dich-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Tất cả giao dịch"
        subtitle="All Transactions · nạp/rút, mua/bán và cổ tức, nhóm theo năm và tháng"
        actions={(
          <>
            <button type="button" className="pp-btn" onClick={() => setImportOpen(true)}><Upload size={15} /> Nhập CSV</button>
            <button type="button" className="pp-btn" onClick={exportCSV} disabled={!transactions.length}><Download size={15} /> Xuất CSV</button>
            <button type="button" className="pp-btn pp-btn--primary" onClick={() => openTransactionModal()}><PlusCircle size={15} /> Thêm giao dịch</button>
          </>
        )}
      />
      {notice && <div className="pp-alert pp-alert--ok">{notice}</div>}
      <DataIssues
        key={hasWarnings ? 'open' : 'closed'}
        issues={dataIssues}
        onEdit={tx => openTransactionModal(tx)}
        defaultOpen={hasWarnings}
      />
      <TransactionLog transactions={transactions} loading={loading} onUpdate={refresh} onEdit={tx => openTransactionModal(tx)} />
      <ImportCSVModal
        mode="transactions"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={async (res) => { await refresh(); setNotice(`Đã nhập ${res?.imported ?? 0} giao dịch${res?.duplicates?.length ? `, bỏ qua ${res.duplicates.length} giao dịch trùng` : ''}.`); }}
      />
    </>
  );
}
