import React, { useMemo, useState } from 'react';
import LineChart from './LineChart.jsx';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';

/**
 * Performance chart: cumulative TTWROR (%) of the portfolio for the reporting
 * period, optionally compared with benchmarks rebased to the period start
 * (PP → Reports → Performance → Chart).
 *
 * @param {Array<{date, index}>} ttwrorPoints  from computePeriodReport
 */
export default function PerformanceChart({ ttwrorPoints = [], height = 320, showBenchmarks = true, showDrawdown = false }) {
  const { benchmarks } = usePortfolioData();
  const [enabled, setEnabled] = useState({ VNINDEX: true, BTC: true });

  const datasets = useMemo(() => {
    if (!ttwrorPoints.length) return [];
    const start = ttwrorPoints[0].date;
    const end = ttwrorPoints[ttwrorPoints.length - 1].date;

    const bench = {};
    if (showBenchmarks) {
      for (const key of ['VNINDEX', 'BTC']) {
        if (!enabled[key]) continue;
        const raw = (benchmarks[key] || []).filter(p => p.date && Number.isFinite(p.close)).sort((a, b) => a.date.localeCompare(b.date));
        if (!raw.length) continue;
        // baseline: last close on/before the period start, else first after
        let base = null;
        for (const p of raw) { if (p.date <= start) base = p.close; else break; }
        if (base === null) { const first = raw.find(p => p.date >= start); base = first ? first.close : null; }
        if (!base) continue;
        bench[key] = { base, map: Object.fromEntries(raw.filter(p => p.date >= start && p.date <= end).map(p => [p.date, p.close])) };
      }
    }

    const dates = new Set(ttwrorPoints.map(p => p.date));
    Object.values(bench).forEach(b => Object.keys(b.map).forEach(d => dates.add(d)));
    const sorted = Array.from(dates).sort();

    const ptfMap = Object.fromEntries(ttwrorPoints.map(p => [p.date, p.index]));
    let lastPtf = ttwrorPoints[0].index;
    const dataPtf = [];
    const dataBench = { VNINDEX: [], BTC: [] };
    const lastBench = { VNINDEX: bench.VNINDEX?.base, BTC: bench.BTC?.base };

    sorted.forEach(date => {
      lastPtf = ptfMap[date] ?? lastPtf;
      dataPtf.push({ x: date, y: parseFloat(((lastPtf - 1) * 100).toFixed(2)) });
      for (const key of Object.keys(bench)) {
        lastBench[key] = bench[key].map[date] ?? lastBench[key];
        dataBench[key].push({ x: date, y: parseFloat(((lastBench[key] / bench[key].base - 1) * 100).toFixed(2)) });
      }
    });

    const out = [{ label: 'Danh mục (TTWROR)', data: dataPtf, color: '#2563eb', fill: true }];
    if (bench.VNINDEX) out.push({ label: 'VN-Index', data: dataBench.VNINDEX, color: '#f59e0b', fill: false });
    if (bench.BTC) out.push({ label: 'Bitcoin (USD)', data: dataBench.BTC, color: '#10b981', fill: false });

    if (showDrawdown) {
      let peak = -Infinity;
      const dd = [];
      let lp = ttwrorPoints[0].index;
      sorted.forEach(date => {
        lp = ptfMap[date] ?? lp;
        if (lp > peak) peak = lp;
        dd.push({ x: date, y: parseFloat((((lp - peak) / peak) * 100).toFixed(2)) });
      });
      out.push({ label: 'Drawdown', data: dd, color: '#b91c1c', fill: true });
    }
    return out;
  }, [ttwrorPoints, benchmarks, enabled, showBenchmarks, showDrawdown]);

  if (!datasets.length) return <div className="chart-empty">Chưa đủ snapshot trong kỳ để vẽ biểu đồ hiệu suất</div>;

  return (
    <div>
      {showBenchmarks && (
        <div className="pp-chart-toggles">
          <label><input type="checkbox" checked={enabled.VNINDEX} onChange={e => setEnabled(s => ({ ...s, VNINDEX: e.target.checked }))} /> VN-Index</label>
          <label><input type="checkbox" checked={enabled.BTC} onChange={e => setEnabled(s => ({ ...s, BTC: e.target.checked }))} /> Bitcoin</label>
        </div>
      )}
      <LineChart datasets={datasets} height={height} yLabel="percent" />
    </div>
  );
}
