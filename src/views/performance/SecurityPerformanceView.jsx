import React, { useMemo, useState } from 'react';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Badge } from '../../components/ui';
import { computeSecurityPerformance } from '../../utils/performanceEngine.js';
import { assetClassLabel } from '../../utils/assetClasses.js';
import { fmtPct, fmtSignedVND, fmtVND, fmtDuration, toneOf } from '../../utils/formatters.js';

/** PP → Reports → Performance → Securities */
export default function SecurityPerformanceView() {
  const { replay, portfolio, today } = usePortfolioData();
  const [showClosed, setShowClosed] = useState(true);

  const rows = useMemo(() => computeSecurityPerformance(replay, portfolio, today), [replay, portfolio, today]);
  const cashInterest = useMemo(() => replay.earnings.filter(e => e.ticker === 'VNĐ').reduce((s, e) => s + e.amount, 0), [replay]);
  const visible = useMemo(() => (showClosed ? rows : rows.filter(r => r.isOpen)), [rows, showClosed]);

  const sum = (key) => (list) => list.reduce((s, r) => s + (r[key] || 0), 0);
  const totals = { unrealized: sum('unrealized')(rows), realized: sum('realized')(rows), earnings: sum('earnings')(rows), total: sum('totalPnL')(rows) };
  const signed = (key) => (list) => { const v = sum(key)(list); return <span className={toneOf(v)}>{fmtSignedVND(v)}</span>; };

  return (
    <>
      <PageHeader title="Hiệu suất theo chứng khoán" subtitle="Performance › Securities · tính từ giao dịch đầu tiên của từng mã" />
      <div className="pp-kpi-grid">
        <Kpi label="Lãi/lỗ chưa thực hiện" value={fmtSignedVND(totals.unrealized)} raw={totals.unrealized} />
        <Kpi label="Lãi/lỗ đã thực hiện" value={fmtSignedVND(totals.realized)} raw={totals.realized} />
        <Kpi label="Cổ tức & lãi nhận được" value={fmtSignedVND(totals.earnings)} raw={totals.earnings} />
        <Kpi label="Tổng lãi/lỗ" value={fmtSignedVND(totals.total)} raw={totals.total} />
      </div>
      <Card padded={false} title={`${visible.length} mã`}
        actions={<label className="pp-check"><input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Hiện mã đã đóng vị thế</label>}>
        <DataTable
          rows={visible}
          rowKey={r => r.ticker}
          defaultSort={{ key: 'marketValue', dir: 'desc' }}
          columns={[
            { key: 'ticker', label: 'Mã', render: r => (
              <>
                <div className="pp-strong">{r.ticker} {!r.isOpen && <Badge tone="gray">đã đóng</Badge>}</div>
                <div className="pp-meta">{assetClassLabel(r.assetClass)}</div>
              </>
            ), footer: () => <strong>Tổng cộng</strong> },
            { key: 'marketValue', label: 'Giá trị TT', align: 'right', render: r => fmtVND(r.marketValue), footer: l => fmtVND(sum('marketValue')(l)) },
            { key: 'purchaseValue', label: 'Giá vốn còn lại', align: 'right', render: r => fmtVND(r.purchaseValue), footer: l => fmtVND(sum('purchaseValue')(l)) },
            { key: 'unrealized', label: 'Chưa thực hiện', align: 'right', render: r => <span className={toneOf(r.unrealized)}>{fmtSignedVND(r.unrealized)}</span>, footer: signed('unrealized') },
            { key: 'realized', label: 'Đã thực hiện', align: 'right', render: r => (r.realized ? <span className={toneOf(r.realized)}>{fmtSignedVND(r.realized)}</span> : '—'), footer: signed('realized') },
            { key: 'earnings', label: 'Cổ tức', align: 'right', render: r => (r.earnings ? <span className="pp-up">{fmtSignedVND(r.earnings)}</span> : '—'), footer: signed('earnings') },
            { key: 'totalPnL', label: 'Tổng lãi/lỗ', align: 'right', render: r => <span className={`pp-strong ${toneOf(r.totalPnL)}`}>{fmtSignedVND(r.totalPnL)}</span>, footer: signed('totalPnL') },
            { key: 'totalPnLPct', label: '% / tổng mua', align: 'right', render: r => <span className={toneOf(r.totalPnLPct)}>{fmtPct(r.totalPnLPct)}</span> },
            { key: 'irr', label: 'IRR', align: 'right', sortValue: r => (r.irr === null ? -Infinity : r.irr), render: r => <span className={toneOf(r.irr || 0)}>{fmtPct(r.irr)}</span>, title: 'Lợi suất nội bộ năm hóa theo dòng tiền mua/bán/cổ tức của từng mã' },
            { key: 'holdingDays', label: 'Nắm giữ', align: 'right', render: r => fmtDuration(r.holdingDays) },
          ]}
        />
        {cashInterest > 0 && (
          <div className="pp-table-note">
            Lãi tiền gửi không gắn với mã nào: <span className="pp-up">{fmtSignedVND(cashInterest)}</span> — đã được tính trong lãi/lỗ tích lũy của cả danh mục.
          </div>
        )}
      </Card>
    </>
  );
}
