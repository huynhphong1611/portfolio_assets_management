import React, { useState } from 'react';
import { formatVND } from '../../utils/formatters.js';
import { niceTicks, compactVND } from './scale.js';
import { useChartWidth } from './useChartWidth.js';

/**
 * Simple grouped bar chart (SVG).
 * @param {Array<{label: string, values: number[]}>} data
 * @param {Array<{label: string, color: string}>} series
 */
export default function BarChart({ data = [], series = [], height = 240, valueFormatter = formatVND }) {
  const [hover, setHover] = useState(null);
  const [containerRef, width] = useChartWidth(800);
  const padding = { top: 16, right: width < 520 ? 8 : 16, bottom: 36, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  if (!data.length || !series.length) {
    return <div ref={containerRef} className="chart-empty">Chưa có dữ liệu biểu đồ</div>;
  }

  let max = 0, min = 0;
  data.forEach(d => d.values.forEach(v => { if (v > max) max = v; if (v < min) min = v; }));
  if (max === 0 && min === 0) max = 1;
  const axis = niceTicks(min, max, 4);
  min = axis.min; max = axis.max;
  const range = max - min || 1;
  const yScale = (v) => padding.top + chartH - ((v - min) / range) * chartH;
  const zeroY = yScale(0);

  const groupW = chartW / data.length;
  const barW = Math.max(2, (groupW * 0.7) / series.length);
  const labelStep = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(chartW / 48))));

  const ticks = axis.ticks;

  return (
    <div ref={containerRef} className="line-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={yScale(t)} y2={yScale(t)} stroke="var(--pp-border)" strokeWidth="1" />
            <text x={padding.left - 8} y={yScale(t) + 4} textAnchor="end" className="chart-axis-label">{compactVND(t)}</text>
          </g>
        ))}
        {data.map((d, gi) => {
          const x0 = padding.left + gi * groupW + (groupW - barW * series.length) / 2;
          return (
            <g key={gi} onMouseEnter={() => setHover(gi)}>
              <rect x={padding.left + gi * groupW} y={padding.top} width={groupW} height={chartH} fill="transparent" />
              {series.map((s, si) => {
                const v = d.values[si] || 0;
                const y = v >= 0 ? yScale(v) : zeroY;
                const h = Math.abs(yScale(v) - zeroY);
                return <rect key={si} x={x0 + si * barW} y={y} width={barW - 1} height={h} fill={s.color} opacity={hover === null || hover === gi ? 0.9 : 0.5} rx="1" />;
              })}
              {gi % labelStep === 0 && (
                <text x={padding.left + gi * groupW + groupW / 2} y={height - 10} textAnchor="middle" className="chart-axis-label">{d.label}</text>
              )}
            </g>
          );
        })}
        <line x1={padding.left} x2={width - padding.right} y1={zeroY} y2={zeroY} stroke="var(--pp-muted)" strokeWidth="1" />
      </svg>
      {hover !== null && data[hover] && (
        <div className="chart-tooltip">
          <div className="chart-tooltip-date">{data[hover].label}</div>
          {series.map((s, si) => (
            <div key={si} className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: s.color }}></span>
              <span className="chart-tooltip-label">{s.label}</span>
              <span className="chart-tooltip-value"><strong>{valueFormatter(data[hover].values[si] || 0)}</strong></span>
            </div>
          ))}
        </div>
      )}
      <div className="chart-legend">
        {series.map((s, i) => (
          <div key={i} className="chart-legend-item"><span className="chart-legend-dot" style={{ background: s.color }}></span><span>{s.label}</span></div>
        ))}
      </div>
    </div>
  );
}
