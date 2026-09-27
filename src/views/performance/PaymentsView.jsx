import React, { useMemo } from 'react';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Empty } from '../../components/ui';
import BarChart from '../../components/charts/BarChart.jsx';
import { computeMonthlyCashFlows } from '../../utils/performanceEngine.js';
import { TX_TYPES } from '../../utils/portfolioCalculator.js';
import { fmtSignedVND, fmtVND, toneOf, formatVND } from '../../utils/formatters.js';
import { toISO, formatISO } from '../../utils/dates.js';

const monthLabel = (k) => `${k.slice(5, 7)}/${k.slice(2, 4)}`;

/** PP → Reports → Performance → Payments (earnings + cash flows) */
export default function PaymentsView() {
  const { transactions, replay } = usePortfolioData();
  const { range, label } = useReportingPeriod();

  const inRange = (iso) => iso > range.start && iso <= range.end;

  const periodTx = useMemo(() => transactions.filter(t => inRange(toISO(t.date))), [transactions, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => {
    const t = { deposits: 0, withdrawals: 0, earnings: 0 };
    for (const tx of periodTx) {
      const amt = Math.abs(Number(tx.totalVND) || 0);
      if (tx.transactionType === TX_TYPES.DEPOSIT) t.deposits += amt;
      else if (tx.transactionType === TX_TYPES.REMOVAL) t.withdrawals += amt;
      else if (tx.transactionType === TX_TYPES.EARNINGS) t.earnings += amt;
    }
    return t;
  }, [periodTx]);

  const months = useMemo(() => computeMonthlyCashFlows(periodTx), [periodTx]);
  const earnings = useMemo(() => replay.earnings.filter(e => inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date)), [replay, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = months.map(m => ({ label: monthLabel(m.month), values: [m.deposits, -m.withdrawals, m.earnings] }));
  const sum = (key) => (list) => list.reduce((s, r) => s + (r[key] || 0), 0);

  return (
    <>
      <PageHeader title="Cổ tức & Dòng tiền" subtitle={`Payments · thu nhập và nạp/rút tiền · kỳ: ${label}`} />
      <div className="pp-kpi-grid">
        <Kpi label="Tổng nạp" value={formatVND(totals.deposits)} tone="neutral" />
        <Kpi label="Tổng rút" value={formatVND(totals.withdrawals)} tone="neutral" />
        <Kpi label="Nạp ròng" value={fmtSignedVND(totals.deposits - totals.withdrawals)} raw={totals.deposits - totals.withdrawals} />
        <Kpi label="Cổ tức & lãi" value={fmtSignedVND(totals.earnings)} raw={totals.earnings} sub={`${earnings.length} khoản`} />
      </div>

      <Card title="Dòng tiền theo tháng">
        {months.length
          ? <BarChart data={chartData} height={260} series={[
              { label: 'Nạp tiền', color: '#16a34a' },
              { label: 'Rút tiền', color: '#dc2626' },
              { label: 'Cổ tức & lãi', color: '#7c3aed' },
            ]} />
          : <Empty title="Không có dòng tiền trong kỳ" />}
      </Card>

      <div className="pp-grid-2">
        <Card title="Khoản thu nhập" subtitle="Giao dịch loại “Cổ tức” (cổ tức, coupon, lãi tiền gửi)" padded={false}>
          <DataTable
            rows={earnings}
            rowKey={(r, i) => r.id || i}
            defaultSort={{ key: 'date', dir: 'desc' }}
            emptyText="Chưa có khoản cổ tức/lãi nào trong kỳ. Ghi nhận bằng loại giao dịch “Cổ tức”."
            columns={[
              { key: 'date', label: 'Ngày', render: r => formatISO(r.date), footer: () => <strong>Tổng</strong> },
              { key: 'ticker', label: 'Mã', render: r => (r.ticker === 'VNĐ' ? 'Tiền gửi' : r.ticker) },
              { key: 'storage', label: 'Nơi nhận', render: r => r.storage || '—' },
              { key: 'amount', label: 'Số tiền', align: 'right', render: r => <span className="pp-up">{fmtSignedVND(r.amount)}</span>, footer: l => <span className="pp-up">{fmtSignedVND(sum('amount')(l))}</span> },
            ]}
          />
        </Card>
        <Card title="Tổng hợp theo tháng" padded={false}>
          <DataTable
            rows={[...months].reverse()}
            rowKey={r => r.month}
            columns={[
              { key: 'month', label: 'Tháng', render: r => monthLabel(r.month), footer: () => <strong>Tổng</strong> },
              { key: 'deposits', label: 'Nạp', align: 'right', render: r => fmtVND(r.deposits), footer: l => fmtVND(sum('deposits')(l)) },
              { key: 'withdrawals', label: 'Rút', align: 'right', render: r => fmtVND(r.withdrawals), footer: l => fmtVND(sum('withdrawals')(l)) },
              { key: 'earnings', label: 'Cổ tức', align: 'right', render: r => fmtVND(r.earnings), footer: l => fmtVND(sum('earnings')(l)) },
              { key: 'net', label: 'Ròng', align: 'right', sortValue: r => r.deposits - r.withdrawals,
                render: r => <span className={toneOf(r.deposits - r.withdrawals)}>{fmtSignedVND(r.deposits - r.withdrawals)}</span>,
                footer: l => { const v = sum('deposits')(l) - sum('withdrawals')(l); return <span className={toneOf(v)}>{fmtSignedVND(v)}</span>; } },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
