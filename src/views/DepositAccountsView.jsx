import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, TxTypeBadge, Empty } from '../components/ui';
import { Link } from '../router/useHashRoute.jsx';
import { buildCashLedger } from '../utils/accounts.js';
import { fmtSignedVND, fmtVND, fmtPrice, toneOf, formatVND, formatQty } from '../utils/formatters.js';
import { formatISO } from '../utils/dates.js';

/** PP → Accounts → Deposit Accounts (cash with running balance). */
export default function DepositAccountsView() {
  const { transactions, portfolio, externalAssets, openTransactionModal } = usePortfolioData();
  const ledger = useMemo(() => buildCashLedger(transactions), [transactions]);
  const rows = useMemo(() => [...ledger.rows].reverse(), [ledger]);
  const stablecoins = useMemo(() => portfolio.filter(p => p.assetClass === 'Tiền mặt USD'), [portfolio]);
  const liquidExternal = useMemo(() => externalAssets.filter(a => a.group === 'Thanh khoản'), [externalAssets]);
  const earningsTotal = useMemo(() => ledger.rows.filter(r => r.tx.transactionType === 'Cổ tức').reduce((s, r) => s + r.delta, 0), [ledger]);
  const shortfall = useMemo(() => ledger.rows.filter(r => r.requested < r.delta - 0.5), [ledger]);

  return (
    <>
      <PageHeader title="Tài khoản tiền mặt" subtitle="Deposit Accounts · sổ quỹ với số dư lũy kế sau từng giao dịch" />
      <div className="pp-kpi-grid">
        <Kpi label="Số dư VNĐ" value={formatVND(ledger.balance)} tone="neutral" />
        <Kpi label="Nạp ròng (nạp − rút)" value={formatVND(ledger.netDeposits)} tone="neutral" />
        <Kpi label="Cổ tức & lãi đã nhận" value={fmtSignedVND(earningsTotal)} raw={earningsTotal} />
        <Kpi label="Stablecoin (quy đổi)" value={formatVND(stablecoins.reduce((s, p) => s + p.actualValue, 0))} tone="neutral"
          sub={stablecoins.map(s => s.ticker).join(', ') || 'Không có'} />
      </div>

      {shortfall.length > 0 && (
        <div className="pp-alert">
          <AlertTriangle size={16} />
          <span>{shortfall.length} lệnh mua vượt số dư tiền mặt tại thời điểm đó — số dư được giữ ở 0. Hãy kiểm tra các khoản nạp tiền còn thiếu.</span>
        </div>
      )}

      <Card title="Tiền mặt VNĐ" subtitle="Nạp/rút, tiền mua/bán chứng khoán và thu nhập" padded={false}>
        <DataTable
          rows={rows}
          rowKey={(r, i) => r.id || i}
          footer={false}
          maxHeight={560}
          onRowClick={r => openTransactionModal(r.tx)}
          emptyText="Chưa có giao dịch tiền mặt. Hãy ghi nhận một khoản “Nạp tiền”."
          columns={[
            { key: 'date', label: 'Ngày', render: r => formatISO(r.date), sortValue: r => r.date },
            { key: 'type', label: 'Loại', sortValue: r => r.tx.transactionType, render: r => <TxTypeBadge type={r.tx.transactionType} /> },
            { key: 'ticker', label: 'Mã', sortValue: r => r.tx.ticker || '', render: r => r.tx.ticker || '—' },
            { key: 'notes', label: 'Ghi chú', sortable: false, className: 'pp-td--notes', render: r => r.tx.notes || r.tx.storage || '' },
            { key: 'delta', label: 'Phát sinh', align: 'right', render: r => (
              <span className={toneOf(r.delta)} title={r.requested !== r.delta ? `Yêu cầu ${fmtSignedVND(r.requested)}` : ''}>
                {fmtSignedVND(r.delta)}{r.requested < r.delta - 0.5 && ' ⚠'}
              </span>
            ) },
            { key: 'balance', label: 'Số dư', align: 'right', render: r => <span className="pp-strong">{fmtVND(r.balance)}</span> },
          ]}
        />
      </Card>

      <div className="pp-grid-2">
        <Card title="Tài khoản USD (stablecoin)" padded={false}>
          <DataTable
            rows={stablecoins}
            rowKey={r => r.ticker}
            footer={false}
            emptyText="Không nắm giữ USDT/USDC"
            columns={[
              { key: 'ticker', label: 'Mã', render: r => <><div className="pp-strong">{r.ticker}</div><div className="pp-meta">{r.storage || '—'}</div></> },
              { key: 'qty', label: 'Số dư', align: 'right', render: r => formatQty(r.qty, r.assetClass) },
              { key: 'marketPrice', label: 'Tỷ giá', align: 'right', render: r => fmtPrice(r.marketPrice) },
              { key: 'actualValue', label: 'Quy đổi VNĐ', align: 'right', render: r => fmtVND(r.actualValue) },
              { key: 'pnl', label: 'Chênh lệch tỷ giá', align: 'right', render: r => <span className={toneOf(r.pnl)}>{fmtSignedVND(r.pnl)}</span> },
            ]}
          />
        </Card>
        <Card title="Tiền gửi ngoài danh mục" padded={false} actions={<Link to="/accounts/other" className="pp-link">Quản lý →</Link>}>
          {liquidExternal.length ? (
            <DataTable
              rows={liquidExternal}
              rowKey={r => r.id}
              columns={[
                { key: 'name', label: 'Tên', render: r => r.name, footer: () => <strong>Tổng</strong> },
                { key: 'value', label: 'Giá trị', align: 'right', render: r => fmtVND(r.value || 0), footer: l => <strong>{fmtVND(l.reduce((s, r) => s + (r.value || 0), 0))}</strong> },
              ]}
            />
          ) : <Empty title="Chưa có" hint="Tài sản thanh khoản ngoài danh mục (tiết kiệm, ví…) được quản lý ở mục Tài sản khác & Nợ." />}
        </Card>
      </div>
    </>
  );
}
