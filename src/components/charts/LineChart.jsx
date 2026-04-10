import React, { useMemo, useState, useRef } from 'react';

/**
 * Professional SVG Line Chart
 * @param {Array} datasets - [{ label, data: [{x: 'date', y: number}], color, fill? }]
 * @param {number} height - chart height
 * @param {string} yLabel - y-axis label format: 'vnd' | 'number' | 'percent'
 */
export default function LineChart({ datasets = [], height = 280, yLabel = 'vnd', title }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  const padding = { top: 20, right: 20, bottom: 40, left: 80 };
  const width = 800;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const processed = useMemo(() => {
    if (!datasets.length || !datasets[0].data?.length) return null;

    const allX = datasets[0].data.map(d => d.x);
    let yMin = Infinity, yMax = -Infinity;
    datasets.forEach(ds => {
      ds.data.forEach(d => {
        if (d.y < yMin) yMin = d.y;
        if (d.y > yMax) yMax = d.y;
      });
    });

    // Add 10% padding to y range
    const yRange = yMax - yMin || 1;
    const trueMin = yMin - yRange * 0.1;
    yMin = yMin >= 0 && trueMin < 0 ? 0 : trueMin;
    yMax = yMax + yRange * 0.1;

    const xScale = (i) => padding.left + (i / Math.max(allX.length - 1, 1)) * chartW;
    const yScale = (val) => padding.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;

    // Y-axis ticks (5 ticks)
    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const val = yMin + (yMax - yMin) * (i / 4);
      yTicks.push({ val, y: yScale(val) });
    }

    // X-axis labels (max 8)
    const step = Math.max(1, Math.floor(allX.length / 7));
    const xLabels = allX.filter((_, i) => i % step === 0 || i === allX.length - 1)
      .map((label, i, arr) => ({
        label: formatDateLabel(label),
        x: xScale(allX.indexOf(label))
      }));

    // Build paths
    const paths = datasets.map(ds => {
      const points = ds.data.map((d, i) => ({ x: xScale(i), y: yScale(d.y), val: d.y, label: d.x, rawStr: d.rawStr }));
      const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      
      // Fix area path for zero-line when dealing with negative values
      const zeroY = yScale(Math.max(0, yMin)); 
      const areaPath = linePath + ` L${points[points.length - 1].x},${zeroY} L${points[0].x},${zeroY} Z`;
      
      return { ...ds, points, linePath, areaPath };
    });

    return { allX, yMin, yMax, yTicks, xLabels, paths, xScale };
  }, [datasets, chartW, chartH]);

  if (!processed) {
    return <div className="chart-empty">Chưa có dữ liệu biểu đồ</div>;
  }

  const formatYTick = (val) => {
    if (yLabel === 'vnd') {
      if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + ' tỷ';
      if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + ' tr';
      if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + 'k';
      return val.toFixed(0);
    }
    if (yLabel === 'percent') return val.toFixed(1) + '%';
    return new Intl.NumberFormat('vi-VN').format(Math.round(val));
  };

  const hoveredPoints = hoveredIdx !== null
    ? processed.paths.map(p => p.points[hoveredIdx]).filter(Boolean)
    : [];

  return (
    <div className="line-chart-container">
      {title && <h4 className="chart-title">{title}</h4>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart-svg"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          {processed.paths.map((p, i) => (
            <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={p.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {processed.yTicks.map((tick, i) => (
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
              {formatYTick(tick.val)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {processed.xLabels.map((l, i) => (
          <text key={i} x={l.x} y={height - 8} textAnchor="middle" className="chart-axis-label">
            {l.label}
          </text>
        ))}

        {/* Area fills */}
        {processed.paths.map((p, i) => p.fill !== false && (
          <path key={`area-${i}`} d={p.areaPath} fill={`url(#grad-${i})`} />
        ))}

        {/* Lines */}
        {processed.paths.map((p, i) => (
          <path
            key={`line-${i}`} d={p.linePath}
            fill="none" stroke={p.color} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="chart-line"
          />
        ))}

        {/* Hover zones */}
        {processed.allX.map((_, i) => (
          <rect
            key={i}
            x={processed.xScale(i) - chartW / processed.allX.length / 2}
            y={padding.top}
            width={chartW / processed.allX.length}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hover line & dots */}
        {hoveredIdx !== null && hoveredPoints.length > 0 && (
          <>
            <line
              x1={hoveredPoints[0].x} y1={padding.top}
              x2={hoveredPoints[0].x} y2={padding.top + chartH}
              stroke="var(--color-slate-300)" strokeWidth="1" strokeDasharray="4"
            />
            {hoveredPoints.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r="5"
                fill={processed.paths[i].color} stroke="white" strokeWidth="2"
              />
            ))}
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIdx !== null && hoveredPoints.length > 0 && (
        <div className="chart-tooltip">
          <div className="chart-tooltip-date">{hoveredPoints[0]?.label}</div>
          {hoveredPoints.map((pt, i) => (
            <div key={i} className="chart-tooltip-row">
              <span className="chart-tooltip-dot" style={{ background: processed.paths[i].color }}></span>
              <span className="chart-tooltip-label">{processed.paths[i].label}</span>
              <span className="chart-tooltip-value">
                {pt.rawStr && <span style={{ color: 'var(--text-color)', marginRight: '6px', fontSize: '11px' }}>{pt.rawStr}</span>}
                <strong>{formatYTick(pt.val)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="chart-legend">
        {processed.paths.map((p, i) => (
          <div key={i} className="chart-legend-item">
            <span className="chart-legend-dot" style={{ background: p.color }}></span>
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr.substring(0, 5);
}
