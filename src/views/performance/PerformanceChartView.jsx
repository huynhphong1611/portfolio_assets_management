import React, { useMemo, useState } from 'react';
import { usePeriodReport } from '../../hooks/usePeriodReport.js';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { Card, Empty, PageHeader, DataTable } from '../../components/ui';
import PerformanceChart from '../../components/charts/PerformanceChart.jsx';
import HeatmapWidget from '../../components/widgets/HeatmapWidget.jsx';
import { Link } from '../../router/useHashRoute.jsx';
import { clipSeries, computeTTWROR, computeVolatility, computeDrawdown } from '../../utils/performanceEngine.js';
import { fmtPct, fmtPctPlain, toneOf } from '../../utils/formatters.js';

const BENCHMARKS = [
  { key: 'VNINDEX', label: 'VN-Index' },
  { key: 'BTC', label: 'Bitcoin (USD)' },
];

/** PP → Reports → Performance → Chart (+ Returns / Volatility) */
export default function PerformanceChartView() {
  const report = usePeriodReport('portfolioValue');
  const { benchmarks } = usePortfolioData();
  const { range, label } = useReportingPeriod();
  const [showDrawdown, setShowDrawdown] = useState(false);

  const stats = useMemo(() => {
    const rows = [{
      key: 'portfolio', label: 'Danh mục', hasData: report.hasData,
      cumulative: report.ttwror, annualized: report.ttwrorAnnualized,
      volatility: report.volatility, maxDrawdown: report.hasData ? report.maxDrawdown : null,
    }];
    for (const b of BENCHMARKS) {
      const series = (benchmarks[b.key] || [])
        .filter(p => p && p.date && Number.isFinite(p.close) && p.close > 0)
        .map(p => ({ date: p.date, value: p.close }))
        .sort((x, y) => x.date.localeCompare(y.date));
      const pts = clipSeries(series, range.start, range.end);
      if (pts.length < 2) { rows.push({ key: b.key, label: b.label, hasData: false }); continue; }
      const t = computeTTWROR(pts);
      rows.push({
        key: b.key, label: b.label, hasData: true,
        cumulative: t.cumulative, annualized: t.annualized,
        volatility: computeVolatility(t.returns).volatility,
        maxDrawdown: computeDrawdown(t.points).maxDrawdown,
      });
    }
    return rows;
  }, [report, benchmarks, range]);

  return (
    <>
      <PageHeader title="Biểu đồ hiệu suất" subtitle={`Performance Chart · TTWROR tích lũy · kỳ: ${label}`} />
      <Card
        title="TTWROR tích lũy"
        actions={(
          <label className="pp-check">
            <input type="checkbox" checked={showDrawdown} onChange={e => setShowDrawdown(e.target.checked)} /> Hiện drawdown
          </label>
        )}
      >
        {report.hasData
          ? <PerformanceChart ttwrorPoints={report.ttwrorPoints} height={360} showDrawdown={showDrawdown} />
          : <Empty title="Chưa đủ snapshot trong kỳ" action={<Link to="/settings" className="pp-btn">Tạo snapshot lịch sử</Link>} />}
      </Card>

      <Card title="Lợi suất / Biến động" subtitle="So sánh rủi ro – lợi nhuận với chỉ số tham chiếu trong cùng kỳ" padded={false}>
        <DataTable
          rows={stats}
          rowKey={r => r.key}
          footer={false}
          columns={[
            { key: 'label', label: 'Chuỗi', render: r => <span className="pp-strong">{r.label}</span> },
            { key: 'cumulative', label: 'Lợi suất tích lũy', align: 'right', render: r => (r.hasData ? <span className={toneOf(r.cumulative)}>{fmtPct(r.cumulative)}</span> : '—') },
            { key: 'annualized', label: 'Năm hóa', align: 'right', render: r => (r.hasData ? <span className={toneOf(r.annualized || 0)}>{fmtPct(r.annualized)}</span> : '—') },
            { key: 'volatility', label: 'Biến động', align: 'right', render: r => (r.hasData ? fmtPctPlain(r.volatility) : '—') },
            { key: 'maxDrawdown', label: 'Max Drawdown', align: 'right', render: r => (r.hasData ? <span className="pp-down">{fmtPct(-r.maxDrawdown)}</span> : '—') },
          ]}
        />
      </Card>

      <Card title="Lợi nhuận theo tháng" subtitle="Toàn bộ lịch sử (không phụ thuộc kỳ báo cáo)">
        <HeatmapWidget months={report.monthlyReturns} years={report.yearlyReturns} />
      </Card>
    </>
  );
}
