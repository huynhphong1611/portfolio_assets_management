import React, { useMemo, useState } from 'react';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Tabs } from '../../components/ui';
import { computeTrades } from '../../utils/performanceEngine.js';
import { fmtPct, fmtPctPlain, fmtSignedVND, fmtVND, fmtDuration, toneOf, formatQty } from '../../utils/formatters.js';
import { formatISO } from '../../utils/dates.js';

/** PP → Reports → Performance → Trades */
export default function TradesView() {
  const { replay, portfolio, today } = usePortfolioData();
  const { range, label } = useReportingPeriod();
  const [tab, setTab] = useState('closed');
  const [onlyPeriod, setOnlyPeriod] = useState(true);

  const { closed, open } = useMemo(() => computeTrades(replay, portfolio, today), [replay, portfolio, today]);
  const closedVisible = useMemo(
    () => (onlyPeriod ? closed.filter(t => t.end > range.start && t.end <= range.end) : closed),
    [closed, onlyPeriod, range]
  );

  const stats = useMemo(() => {
    const n = closedVisible.length;
    const wins = closedVisible.filter(t => t.pnl > 0).length;
    const pnl = closedVisible.reduce((s, t) => s + t.pnl, 0);
    const avgDays = n ? closedVisible.reduce((s, t) => s + t.days, 0) / n : 0;
    const openPnl = open.reduce((s, t) => s + t.pnl, 0);
    return { n, wins, winRate: n ? wins / n : null, pnl, avgDays, openPnl };
  }, [closedVisible, open]);

  const sum = (key) => (list) => list.reduce((s, r) => s + (r[key] || 0), 0);
  const signed = (key) => (list) => { const v = sum(key)(list); return <span className={toneOf(v)}>{fmtSignedVND(v)}</span>; };

  const columns = [
    { key: 'ticker', label: 'Mã', render: r => <span className="pp-strong">{r.ticker}</span>, footer: () => <strong>Tổng</strong> },
    { key: 'start', label: 'Mở', render: r => formatISO(r.start) },
    { key: 'end', label: tab === 'closed' ? 'Đóng' : 'Đến nay', render: r => (r.end ? formatISO(r.end) : '—') },
    { key: 'days', label: 'Thời gian', align: 'right', render: r => fmtDuration(r.days) },
    { key: 'qty', label: 'Số lượng', align: 'right', render: r => formatQty(r.qty, r.assetClass) },
    { key: 'entryValue', label: 'Giá trị vào', align: 'right', render: r => fmtVND(r.entryValue), footer: l => fmtVND(sum('entryValue')(l)) },
    { key: 'exitValue', label: tab === 'closed' ? 'Giá trị ra' : 'Giá trị hiện tại', align: 'right', render: r => fmtVND(r.exitValue), footer: l => fmtVND(sum('exitValue')(l)) },
    { key: 'pnl', label: 'Lãi/lỗ', align: 'right', render: r => <span className={toneOf(r.pnl)}>{fmtSignedVND(r.pnl)}</span>, footer: signed('pnl') },
    { key: 'pnlPct', label: '%', align: 'right', render: r => <span className={toneOf(r.pnlPct)}>{fmtPct(r.pnlPct)}</span> },
    { key: 'annualized', label: 'Năm hóa', align: 'right', sortValue: r => (r.annualized === null ? -Infinity : r.annualized),
      render: r => <span className={toneOf(r.annualized || 0)}>{fmtPct(r.annualized)}</span> },
  ];

  return (
    <>
      <PageHeader title="Giao dịch lãi/lỗ" subtitle="Trades · mỗi lệnh bán khớp với giá vốn bình quân của vị thế" />
      <div className="pp-kpi-grid">
        <Kpi label="Lệnh đã đóng" value={String(stats.n)} tone="neutral" sub={onlyPeriod ? `trong kỳ ${label}` : 'toàn thời gian'} />
        <Kpi label="Tỷ lệ thắng" value={fmtPctPlain(stats.winRate)} tone="neutral" sub={`${stats.wins} lệnh có lãi`} />
        <Kpi label="Lãi/lỗ đã thực hiện" value={fmtSignedVND(stats.pnl)} raw={stats.pnl} sub={`Nắm giữ TB ${fmtDuration(stats.avgDays)}`} />
        <Kpi label="Vị thế đang mở" value={String(open.length)} tone="neutral" sub={`Lãi/lỗ tạm tính ${fmtSignedVND(stats.openPnl)}`} />
      </div>
      <Tabs tabs={[{ key: 'closed', label: `Đã đóng (${closedVisible.length})` }, { key: 'open', label: `Đang mở (${open.length})` }]} active={tab} onChange={setTab} />
      <Card padded={false}
        actions={tab === 'closed' ? <label className="pp-check"><input type="checkbox" checked={onlyPeriod} onChange={e => setOnlyPeriod(e.target.checked)} /> Chỉ trong kỳ báo cáo</label> : null}
        title={tab === 'closed' ? 'Lệnh đã đóng' : 'Vị thế đang mở'}>
        <DataTable
          key={tab}
          rows={tab === 'closed' ? closedVisible : open}
          rowKey={(r, i) => `${r.ticker}-${r.start}-${r.end || 'open'}-${i}`}
          columns={columns}
          defaultSort={tab === 'closed' ? { key: 'end', dir: 'desc' } : { key: 'exitValue', dir: 'desc' }}
          emptyText={tab === 'closed' ? 'Chưa có lệnh bán nào trong kỳ' : 'Không có vị thế đang mở'}
        />
      </Card>
    </>
  );
}
