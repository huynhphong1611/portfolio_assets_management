import React, { useEffect, useRef } from 'react';

/**
 * SVG Donut Chart for asset allocation visualization
 * 
 * @param {Array} data - [{ label, value, color }]
 * @param {number} size - chart diameter in pixels
 */
export default function AssetAllocationChart({ data = [], size = 220 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  const radius = 80;
  const strokeWidth = 32;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedOffset = 0;

  const COLORS = [
    '#6366f1', // indigo
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
  ];

  const segments = data
    .filter(d => d.value > 0)
    .map((d, i) => {
      const percent = d.value / total;
      const dashLength = circumference * percent;
      const gapLength = circumference - dashLength;
      const offset = -accumulatedOffset;
      accumulatedOffset += dashLength;

      return {
        ...d,
        color: d.color || COLORS[i % COLORS.length],
        percent: percent * 100,
        dashArray: `${dashLength} ${gapLength}`,
        dashOffset: offset,
      };
    });

  return (
    <div className="donut-chart-container">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="donut-chart-svg"
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />

        {/* Data segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.dashOffset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${center} ${center})`}
            className="donut-segment"
            style={{ 
              animationDelay: `${i * 0.1}s`,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
            }}
          />
        ))}

        {/* Center text */}
        <text
          x={center}
          y={center - 8}
          textAnchor="middle"
          className="donut-center-label"
        >
          Tổng cộng
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          className="donut-center-value"
        >
          {segments.length} loại
        </text>
      </svg>

      {/* Legend */}
      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div key={i} className="donut-legend-item">
            <div
              className="donut-legend-dot"
              style={{ backgroundColor: seg.color }}
            />
            <span className="donut-legend-label">{seg.label}</span>
            <span className="donut-legend-value">{seg.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
