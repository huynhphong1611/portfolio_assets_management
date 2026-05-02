import React, { useMemo, useState } from 'react';

/**
 * 100% Stacked Area Chart for asset allocation over time.
 *
 * Each snapshot's assetClassBreakdown is normalised to 100% so the chart always
 * fills the full vertical space, showing the *proportion* of each asset class.
 *
 * @param {Array}  snapshots - [{ date, assetClassBreakdown: { className: value } }]
 * @param {number} height    - chart height in pixels
 */

const ASSET_COLORS = {
  'Tiền mặt VNĐ':   '#6366f1', // indigo
  'Tiền mặt USD':    '#3b82f6', // blue
  'Trái phiếu':      '#10b981', // emerald
  'Cổ phiếu':        '#f59e0b', // amber
  'Tài sản mã hóa':  '#ef4444', // red
  'Vàng':            '#eab308', // yellow-gold
};

const ASSET_ORDER = [
  'Tiền mặt VNĐ',
  'Tiền mặt USD',
  'Trái phiếu',
  'Cổ phiếu',
  'Tài sản mã hóa',
  'Vàng',
];

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr.substring(0, 5);
}

function formatVndShort(val) {
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + ' tỷ';
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + ' tr';
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + 'k';
  return val.toFixed(0);
}

export default function StackedAreaChart({ snapshots = [], height = 300 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const width = 800;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const processed = useMemo(() => {
    // Filter snapshots that have assetClassBreakdown
    const valid = snapshots
      .filter(s => s.assetClassBreakdown && Object.keys(s.assetClassBreakdown).length > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (valid.length < 2) return null;

    // Determine all asset classes present
    const allClasses = new Set();
    valid.forEach(s => {
      Object.keys(s.assetClassBreakdown).forEach(c => allClasses.add(c));
    });

    // Use ordered list, then add any extras
    const orderedClasses = ASSET_ORDER.filter(c => allClasses.has(c));
    allClasses.forEach(c => {
      if (!orderedClasses.includes(c)) orderedClasses.push(c);
    });

    const dates = valid.map(s => s.date);

    // Build normalised data: for each date, compute cumulative percentages
    const stackedData = valid.map(s => {
      const bd = s.assetClassBreakdown;
      const total = Object.values(bd).reduce((sum, v) => sum + (v || 0), 0);
      if (total <= 0) {
        return { date: s.date, layers: orderedClasses.map(() => ({ pct: 0, value: 0 })), total: 0 };
      }
      const layers = orderedClasses.map(cls => ({
        pct: ((bd[cls] || 0) / total) * 100,
        value: bd[cls] || 0,
      }));
      return { date: s.date, layers, total };
    });

    // Scales
    const xScale = (i) => padding.left + (i / Math.max(dates.length - 1, 1)) * chartW;
    const yScale = (pct) => padding.top + chartH - (pct / 100) * chartH;

    // Build area paths for each layer (bottom-up stacking)
    const areaPaths = orderedClasses.map((cls, layerIdx) => {
      // For each date point, compute the y0 (bottom) and y1 (top) of this layer
      const points = stackedData.map((d, i) => {
        // Sum of layers below this one
        let y0Pct = 0;
        for (let k = 0; k < layerIdx; k++) {
          y0Pct += d.layers[k].pct;
        }
        const y1Pct = y0Pct + d.layers[layerIdx].pct;
        return {
          x: xScale(i),
          y0: yScale(y0Pct),
          y1: yScale(y1Pct),
          pct: d.layers[layerIdx].pct,
          value: d.layers[layerIdx].value,
        };
      });

      // Build SVG path: top edge left→right, then bottom edge right→left
      const topLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y1}`).join(' ');
      const bottomLine = [...points].reverse().map((p, i) => `${i === 0 ? 'L' : 'L'}${p.x},${p.y0}`).join(' ');
      const path = `${topLine} ${bottomLine} Z`;

      return {
        className: cls,
        color: ASSET_COLORS[cls] || '#94a3b8',
        path,
        points,
      };
    });

    // Y-axis ticks (0%, 25%, 50%, 75%, 100%)
    const yTicks = [0, 25, 50, 75, 100].map(pct => ({
      pct,
      y: yScale(pct),
      label: pct + '%',
    }));

    // X-axis labels
    const step = Math.max(1, Math.floor(dates.length / 7));
    const xLabels = dates
      .filter((_, i) => i % step === 0 || i === dates.length - 1)
      .map(label => ({
        label: formatDateLabel(label),
        x: xScale(dates.indexOf(label)),
      }));

    return { dates, orderedClasses, stackedData, areaPaths, yTicks, xLabels, xScale };
  }, [snapshots, chartW, chartH]);

  if (!processed) {
    return (
      <div className="chart-empty">
        Chưa đủ dữ liệu phân bổ tài sản (cần ít nhất 2 snapshots có breakdown)
      </div>
    );
  }

  const { dates, orderedClasses, stackedData, areaPaths, yTicks, xLabels, xScale } = processed;

  // Hovered data
  const hoveredData = hoveredIdx !== null ? stackedData[hoveredIdx] : null;

  return (
    <div className="stacked-area-chart-container line-chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart-svg"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {areaPaths.map((ap, i) => (
            <linearGradient key={i} id={`sa-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ap.color} stopOpacity="0.85" />
              <stop offset="100%" stopColor={ap.color} stopOpacity="0.55" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left} y1={tick.y}
              x2={width - padding.right} y2={tick.y}
              stroke="var(--color-slate-100)" strokeWidth="1"
            />
            <text
              x={padding.left - 10} y={tick.y + 4}
              textAnchor="end" className="chart-axis-label"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {l.label}
          </text>
        ))}

        {/* Stacked areas — render bottom-up so first layer is at bottom */}
        {areaPaths.map((ap, i) => (
          <path
            key={i}
            d={ap.path}
            fill={`url(#sa-grad-${i})`}
            stroke={ap.color}
            strokeWidth="0.5"
            strokeOpacity="0.4"
            className="stacked-area-path"
          />
        ))}

        {/* Hover zones */}
        {dates.map((_, i) => (
          <rect
            key={i}
            x={xScale(i) - chartW / dates.length / 2}
            y={padding.top}
            width={chartW / dates.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hover vertical line */}
        {hoveredIdx !== null && (
          <line
            x1={xScale(hoveredIdx)} y1={padding.top}
            x2={xScale(hoveredIdx)} y2={padding.top + chartH}
            stroke="var(--color-slate-300)" strokeWidth="1" strokeDasharray="4"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoveredData && (
        <div className="chart-tooltip">
          <div className="chart-tooltip-date">{hoveredData.date}</div>
          {orderedClasses.map((cls, i) => {
            const layer = hoveredData.layers[i];
            if (layer.pct <= 0) return null;
            return (
              <div key={i} className="chart-tooltip-row">
                <span className="chart-tooltip-dot" style={{ background: ASSET_COLORS[cls] || '#94a3b8' }}></span>
                <span className="chart-tooltip-label">{cls}</span>
                <span className="chart-tooltip-value">
                  <span style={{ color: 'var(--text-color)', marginRight: '6px', fontSize: '11px' }}>
                    {formatVndShort(layer.value)}
                  </span>
                  <strong>{layer.pct.toFixed(1)}%</strong>
                </span>
              </div>
            );
          })}
          <div className="chart-tooltip-row" style={{ borderTop: '1px solid var(--glass-border)', marginTop: '4px', paddingTop: '4px' }}>
            <span className="chart-tooltip-label" style={{ fontWeight: 600 }}>Tổng</span>
            <span className="chart-tooltip-value">
              <strong>{formatVndShort(hoveredData.total)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="chart-legend">
        {areaPaths.map((ap, i) => (
          <div key={i} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: ap.color }}></span>
            <span>{ap.className}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
