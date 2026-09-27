import React, { useEffect, useMemo, useState } from 'react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Empty, TxTypeBadge } from '../components/ui';
import { calculateHoldingsByStorage } from '../utils/accounts.js';
import { assetClassLabel } from '../utils/assetClasses.js';
import { fmtPct, fmtPrice, fmtSignedVND, fmtVND, toneOf, formatQty, formatVND } from '../utils/formatters.js';
import { formatISO, toISO, parseVNDate } from '../utils/dates.js';

/** PP → Accounts → Securities Accounts (one account per broker / exchange / platform). */
export default function SecuritiesAccountsView() {
  const { transactions, portfolio, openTransactionModal } = usePortfolioData();
  const accounts = useMemo(() => calculateHoldingsByStorage(transactions, portfolio), [transactions, portfolio]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!accounts.length) return;
    if (!selected || !accounts.some(a => a.name === selected)) setSelected(accounts[0].name);
  }, [accounts, selected]);

  const account = accounts.find(a => a.name === selected) || null;
  const totalValue = accounts.reduce((s, a) => s + a.value, 0);

  const accountTx = useMemo(() => (
    account ? [...account.transactions].sort((a, b) => parseVNDate(b.date) - parseVNDate(a.date)) : []
  ), [account]);

  return (
    <>
      <PageHeader title="Tài khoản chứng khoán" subtitle="Securities Accounts · vị thế được tách theo nơi lưu ký (công ty chứng khoán, sàn crypto, nền tảng quỹ…)" />
      {!accounts.length ? (
        <Card><Empty title="Chưa có tài khoản" hint="Tài khoản được tạo tự động từ trường “Nơi lưu trữ” của giao dịch." /></Card>
      ) : (
        <div className="pp-split">
          <Card title="Tài khoản" padded={false} className="pp-split-list">
            <DataTable
              rows={accounts}
              rowKey={r => r.name}
              selectedKey={selected}
              onRowClick={r => setSelected(r.name)}
              columns={[
                { key: 'name', label: 'Tên', render: r => (
                  <>
                    <div className="pp-strong">{r.name}</div>
                    <div className="pp-meta">{r.positions.length} vị thế · {r.txCount} giao dịch</div>
                    {r.spellings.length > 1 && <div className="pp-meta" title="Tên nơi lưu ký được so khớp không phân biệt hoa/thường">Gộp: {r.spellings.join(', ')}</div>}
                  </>
                ), footer: () => <strong>Tổng</strong> },
                { key: 'value', label: 'Giá trị', align: 'right', render: r => fmtVND(r.value), footer: () => <strong>{fmtVND(totalValue)}</strong> },
              ]}
            />
          </Card>

          {account && (
            <div className="pp-split-detail">
              <div className="pp-kpi-grid pp-kpi-grid--3">
                <Kpi label={`Giá trị · ${account.name}`} value={formatVND(account.value)} tone="neutral"
                  sub={totalValue > 0 ? `${((account.value / totalValue) * 100).toFixed(1)}% tổng chứng khoán` : null} />
                <Kpi label="Giá vốn" value={formatVND(account.cost)} tone="neutral" />
                <Kpi label="Lãi/lỗ chưa thực hiện" value={fmtSignedVND(account.pnl)} raw={account.pnl}
                  sub={account.cost > 0 ? fmtPct(account.pnl / account.cost) : null} />
              </div>
              <Card title="Vị thế" padded={false}>
                <DataTable
                  rows={account.positions}
                  rowKey={r => r.ticker}
                  defaultSort={{ key: 'value', dir: 'desc' }}
                  emptyText="Tài khoản không còn vị thế nào"
                  columns={[
                    { key: 'ticker', label: 'Mã', render: r => <><div className="pp-strong">{r.ticker}</div><div className="pp-meta">{assetClassLabel(r.assetClass)}</div></>, footer: () => <strong>Tổng</strong> },
                    { key: 'qty', label: 'Số lượng', align: 'right', render: r => formatQty(r.qty, r.assetClass) },
                    { key: 'avgCost', label: 'Giá vốn BQ', align: 'right', render: r => fmtPrice(r.avgCost) },
                    { key: 'marketPrice', label: 'Giá', align: 'right', render: r => fmtPrice(r.marketPrice) },
                    { key: 'value', label: 'Giá trị', align: 'right', render: r => fmtVND(r.value), footer: l => fmtVND(l.reduce((s, r) => s + r.value, 0)) },
                    { key: 'pnl', label: 'Lãi/lỗ', align: 'right', render: r => <span className={toneOf(r.pnl)}>{fmtSignedVND(r.pnl)}</span>,
                      footer: l => { const v = l.reduce((s, r) => s + r.pnl, 0); return <span className={toneOf(v)}>{fmtSignedVND(v)}</span>; } },
                    { key: 'pnlPct', label: '%', align: 'right', render: r => <span className={toneOf(r.pnlPct)}>{fmtPct(r.pnlPct)}</span> },
                  ]}
                />
              </Card>
              <Card title="Giao dịch của tài khoản" padded={false}>
                <DataTable
                  rows={accountTx}
                  rowKey={(r, i) => r.id || i}
                  footer={false}
                  maxHeight={420}
                  onRowClick={tx => openTransactionModal(tx)}
                  columns={[
                    { key: 'date', label: 'Ngày', sortValue: r => parseVNDate(r.date).getTime(), render: r => formatISO(toISO(r.date)) },
                    { key: 'transactionType', label: 'Loại', render: r => <TxTypeBadge type={r.transactionType} /> },
                    { key: 'ticker', label: 'Mã', render: r => r.ticker || '—' },
                    { key: 'quantity', label: 'Số lượng', align: 'right', sortValue: r => Math.abs(r.quantity || 0), render: r => (r.ticker ? formatQty(Math.abs(r.quantity || 0), r.assetClass) : '—') },
                    { key: 'totalVND', label: 'Thành tiền', align: 'right', sortValue: r => Math.abs(r.totalVND || 0), render: r => fmtVND(Math.abs(r.totalVND || 0)) },
                  ]}
                />
                <div className="pp-table-note">Bấm vào một dòng để sửa giao dịch.</div>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
