import React, { useMemo, useState } from 'react';
import { niceTicks, compactVND, dateAxisLabel, dateTooltipLabel, isLongRange } from './scale.js';
import { useChartWidth } from './useChartWidth.js';
import { avgCostOn } from '../../utils/securityChart.js';
import { fmtPrice, formatQty } from '../../utils/formatters.js';

const COLORS = {
  price: 'var(--color-blue-600)',
  avg: 'var(--color-amber-500)',
  buy: 'var(--color-emerald-500)',
  sell: 'var(--color-rose-500)',
};
const DAY = 86400000;
const R_MIN = 5;
const R_MAX = 18;

/**
 * Market price, moving average cost and buy/sell markers of one security.
 * Marker area is proportional to the traded quantity.
 * @param {object} data - buildSecurityChartData(...) result
 * @param {Array} log - the security's trade log (for the average cost under the cursor)
 */
export default function SecurityTradeChart({ data, log = [], height = 320 }) {
  const [containerRef, width] = useChartWidth(800);
  const [hover, setHover] = useState(null);
  const compact = width < 520;
  const padding = { top: 20, right: compact ? 12 : 24, bottom: 36, left: compact ? 52 : 76 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const g = useMemo(() => {
    if (!data) return null;
    const t0 = Date.parse(data.start);
    const t1 = Math.max(Date.parse(data.end), t0 + DAY);
    const xOf = (iso) => padding.left + ((Date.parse(iso) - t0) / (t1 - t0)) * chartW;

    const values = [
      ...data.price.map(p => p.value),
      ...data.avgSegments.flat().map(p => p.value),
      ...data.trades.map(t => t.price),
    ].filter(v => v > 0);
    const axis = niceTicks(Math.min(...values), Math.max(...values), 4);
    const yOf = (v) => padding.top + chartH - ((v - axis.min) / (axis.max - axis.min)) * chartH;

    const pathOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');

    const maxQty = Math.max(...data.trades.map(t => t.qty));
    const rOf = (q) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(q / maxQty);
    // Big markers first so small ones stay on top and hoverable
    const markers = data.trades
      .map((t, i) => ({ ...t, i, x: xOf(t.date), y: yOf(t.price), r: rOf(t.qty) }))
      .sort((a, b) => b.r - a.r);

    // Dates the crosshair can snap to
    const byDate = new Map();
    for (const p of data.price) byDate.set(p.date, { date: p.date, price: p.value, trades: [] });
    for (const t of data.trades) {
      if (!byDate.has(t.date)) byDate.set(t.date, { date: t.date, price: null, trades: [] });
      byDate.get(t.date).trades.push(t);
    }
    const snaps = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)).map(s => ({ ...s, x: xOf(s.date) }));
    // Price on trade-only dates: last known quote
    let last = null;
    for (const s of snaps) { if (s.price !== null) last = s.price; else s.price = last; }

    const longRange = isLongRange(data.start, data.end);
    const nTicks = Math.max(2, Math.floor(chartW / 90));
    const xTicks = Array.from({ length: nTicks + 1 }, (_, i) => {
      const iso = new Date(t0 + ((t1 - t0) * i) / nTicks).toISOString().slice(0, 10);
      return { x: xOf(iso), label: dateAxisLabel(iso, longRange), anchor: i === 0 ? 'start' : i === nTicks ? 'end' : 'middle' };
    });

    const yStep = axis.ticks.length > 1 ? axis.ticks[1] - axis.ticks[0] : null;
    const yMaxAbs = Math.max(Math.abs(axis.min), Math.abs(axis.max));
    return {
      yTicks: axis.ticks.map(v => ({ v, y: yOf(v), label: compactVND(v, yStep, yMaxAbs) })),
      xTicks, pricePath: data.price.length > 1 ? pathOf(data.price) : null,
      avgPaths: data.avgSegments.map(pathOf), markers, snaps, yOf,
    };
  }, [data, chartW, chartH, padding.left, padding.top]);

  if (!g) return <div ref={containerRef} className="chart-empty">Chưa có giao dịch mua/bán cho mã này</div>;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let best = null;
    for (const s of g.snaps) if (!best || Math.abs(s.x - x) < Math.abs(best.x - x)) best = s;
    setHover(best);
  };

  const hoverAvg = hover ? avgCostOn(log, hover.date) : null;

  return (
    <div ref={containerRef} className="line-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        role="img" aria-label="Biểu đồ giá, giá vốn bình quân và các lệnh mua bán">
        {g.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} y1={t.y} x2={width - padding.right} y2={t.y} stroke="var(--color-slate-100)" strokeWidth="1" />
            <text x={padding.left - 10} y={t.y + 4} textAnchor="end" className="chart-axis-label">{t.label}</text>
          </g>
        ))}
        {g.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={height - 8} textAnchor={t.anchor} className="chart-axis-label">{t.label}</text>
        ))}

        {g.pricePath && <path d={g.pricePath} fill="none" stroke={COLORS.price} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {g.avgPaths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={COLORS.avg} strokeWidth="2" strokeDasharray="6 4" strokeLinejoin="round" />
        ))}

        {hover && (
          <line x1={hover.x} y1={padding.top} x2={hover.x} y2={padding.top + chartH} stroke="var(--color-slate-300)" strokeWidth="1" strokeDasharray="4" />
        )}

        {g.markers.map(m => {
          const active = hover && hover.date === m.date;
          return (
            <circle key={m.i} cx={m.x} cy={m.y} r={active ? m.r + 2 : m.r}
              fill={COLORS[m.side]} fillOpacity={active ? 0.85 : 0.55}
              stroke={COLORS[m.side]} strokeWidth="1.5" />
          );
        })}

        {hover && hover.price !== null && (
          <circle cx={hover.x} cy={g.yOf(hover.price)} r="4" fill={COLORS.price} stroke="white" strokeWidth="2" />
        )}
      </svg>

      {hover && (
        <div className="chart-tooltip">
          <div className="chart-tooltip-date">{dateTooltipLabel(hover.date)}</div>
          {hover.price !== null && (
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: COLORS.price }}></span>
              <span className="chart-tooltip-label">Giá thị trường</span>
              <span className="chart-tooltip-value"><strong>{fmtPrice(hover.price)}</strong></span>
            </div>
          )}
          {hoverAvg !== null && (
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: COLORS.avg }}></span>
              <span className="chart-tooltip-label">Giá vốn bình quân</span>
              <span className="chart-tooltip-value"><strong>{fmtPrice(hoverAvg)}</strong></span>
            </div>
          )}
          {hover.trades.map((t, i) => (
            <div key={i} className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: COLORS[t.side] }}></span>
              <span className="chart-tooltip-label">{t.side === 'buy' ? 'Mua' : 'Bán'} {formatQty(t.qty)}</span>
              <span className="chart-tooltip-value">@ <strong>{fmtPrice(t.price)}</strong></span>
            </div>
          ))}
        </div>
      )}

      <div className="chart-legend">
        <div className="chart-legend-item"><span className="chart-legend-line" style={{ background: COLORS.price }}></span><span>Giá thị trường</span></div>
        <div className="chart-legend-item"><span className="chart-legend-line chart-legend-line--dashed" style={{ color: COLORS.avg }}></span><span>Giá vốn bình quân</span></div>
        <div className="chart-legend-item"><span className="chart-legend-dot chart-legend-dot--round" style={{ background: COLORS.buy }}></span><span>Mua</span></div>
        <div className="chart-legend-item"><span className="chart-legend-dot chart-legend-dot--round" style={{ background: COLORS.sell }}></span><span>Bán</span></div>
        <div className="chart-legend-item chart-legend-note">Kích thước chấm = khối lượng</div>
      </div>
    </div>
  );
}
