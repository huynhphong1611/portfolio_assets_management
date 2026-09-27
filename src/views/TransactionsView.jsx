import React from 'react';
import { PlusCircle, Download } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { PageHeader } from '../components/ui';
import TransactionLog from '../components/TransactionLog.jsx';
import { parseVNDate } from '../utils/dates.js';

const CSV_COLUMNS = [
  ['date', 'Ngày giờ'], ['transactionType', 'Loại giao dịch'], ['assetClass', 'Loại tài sản'], ['ticker', 'Mã'],
  ['quantity', 'Số lượng'], ['unitPrice', 'Đơn giá'], ['currency', 'Loại tiền'], ['exchangeRate', 'Tỷ giá'],
  ['totalVND', 'Thành tiền (VNĐ)'], ['pnlVND', 'Lãi/Lỗ VNĐ'], ['storage', 'Nơi lưu trữ'], ['notes', 'Ghi chú'],
];

function toCSV(transactions) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const sorted = [...transactions].sort((a, b) => parseVNDate(a.date) - parseVNDate(b.date));
  const lines = [CSV_COLUMNS.map(c => c[1]).join(',')];
  for (const t of sorted) lines.push(CSV_COLUMNS.map(([k]) => esc(t[k])).join(','));
  return '﻿' + lines.join('\n');
}

/** PP → Accounts → All Transactions */
export default function TransactionsView() {
  const { transactions, loading, refresh, openTransactionModal } = usePortfolioData();

  const exportCSV = () => {
    const blob = new Blob([toCSV(transactions)], { type: 'text/csv;charset=utf-8' });
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
            <button type="button" className="pp-btn" onClick={exportCSV} disabled={!transactions.length}><Download size={15} /> Xuất CSV</button>
            <button type="button" className="pp-btn pp-btn--primary" onClick={() => openTransactionModal()}><PlusCircle size={15} /> Thêm giao dịch</button>
          </>
        )}
      />
      <TransactionLog transactions={transactions} loading={loading} onUpdate={refresh} onEdit={tx => openTransactionModal(tx)} />
    </>
  );
}
