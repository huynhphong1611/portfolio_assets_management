import React, { useMemo, useState } from 'react';
import LineChart from './LineChart.jsx';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { clipSeries, buildValueSeries } from '../../utils/performanceEngine.js';

const LINES = [
  { key: 'portfolioValue', label: 'Giá trị danh mục', color: '#2563eb', fill: true, on: true },
  { key: 'portfolioCost', label: 'Vốn đầu tư ròng', color: '#64748b', fill: false, on: true },
  { key: 'netWorth', label: 'Tài sản ròng', color: '#10b981', fill: false, on: false },
  { key: 'totalAssets', label: 'Tổng tài sản', color: '#8b5cf6', fill: false, on: false },
  { key: 'totalLiabilities', label: 'Tổng nợ', color: '#f43f5e', fill: false, on: false },
];

/** Asset chart: absolute values over the reporting period (PP → Statement of Assets → Chart). */
export default function AssetChart({ height = 320, lines = LINES }) {
  const { snapshots } = usePortfolioData();
  const { range } = useReportingPeriod();
  const [enabled, setEnabled] = useState(() => Object.fromEntries(lines.map(l => [l.key, l.on])));

  const datasets = useMemo(() => {
    const out = [];
    for (const l of lines) {
      if (!enabled[l.key]) continue;
      const series = clipSeries(buildValueSeries(snapshots, l.key), range.start, range.end);
      if (series.length < 2) continue;
      out.push({ label: l.label, color: l.color, fill: l.fill, data: series.map(p => ({ x: p.date, y: p.value })) });
    }
    // LineChart shares the x-axis of the first dataset; align others by date map
    if (out.length > 1) {
      const dates = out[0].data.map(d => d.x);
      for (let i = 1; i < out.length; i++) {
        const map = Object.fromEntries(out[i].data.map(d => [d.x, d.y]));
        let last = out[i].data[0].y;
        out[i].data = dates.map(x => { last = map[x] ?? last; return { x, y: last }; });
      }
    }
    return out;
  }, [snapshots, range, enabled, lines]);

  return (
    <div>
      <div className="pp-chart-toggles">
        {lines.map(l => (
          <label key={l.key}>
            <input type="checkbox" checked={!!enabled[l.key]} onChange={e => setEnabled(s => ({ ...s, [l.key]: e.target.checked }))} />
            <span className="chart-legend-dot" style={{ background: l.color }}></span> {l.label}
          </label>
        ))}
      </div>
      {datasets.length ? <LineChart datasets={datasets} height={height} yLabel="vnd" /> : <div className="chart-empty">Chưa đủ snapshot trong kỳ báo cáo</div>}
    </div>
  );
}
