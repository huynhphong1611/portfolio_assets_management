import React, { useMemo } from 'react';
import { fmtPct } from '../../utils/formatters.js';

const cellText = (r) => `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r * 100).toFixed(1)}`;

const MONTHS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];

function cellStyle(r) {
  if (r === null || r === undefined) return {};
  const capped = Math.max(-0.1, Math.min(0.1, r));
  const alpha = 0.12 + Math.abs(capped) / 0.1 * 0.7;
  return r >= 0
    ? { background: `rgba(21, 128, 61, ${alpha})`, color: alpha > 0.5 ? '#fff' : '#14532d' }
    : { background: `rgba(185, 28, 28, ${alpha})`, color: alpha > 0.5 ? '#fff' : '#7f1d1d' };
}

/**
 * Monthly returns heatmap (PP dashboard widget "Heatmap").
 * @param {Map<string, number>} months  "YYYY-MM" → return fraction
 * @param {Map<string, number>} years   "YYYY" → return fraction
 * @param {string[]} [onlyYears]        restrict to these years
 */
export default function HeatmapWidget({ months, years, onlyYears = null }) {
  const rows = useMemo(() => {
    const set = new Set();
    for (const k of months.keys()) set.add(k.slice(0, 4));
    let list = Array.from(set).sort().reverse();
    if (onlyYears && onlyYears.length) list = list.filter(y => onlyYears.includes(y));
    return list;
  }, [months, onlyYears]);

  if (!rows.length) return <div className="pp-empty pp-empty--sm">Chưa đủ dữ liệu theo tháng</div>;

  return (
    <div className="pp-heatmap-wrap">
      <table className="pp-heatmap">
        <thead>
          <tr>
            <th className="pp-heatmap-unit" title="Đơn vị: %">%</th>
            {MONTHS.map(m => <th key={m}>{m}</th>)}
            <th className="pp-heatmap-year-col">Năm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(y => (
            <tr key={y}>
              <th className="pp-heatmap-year">{y}</th>
              {MONTHS.map((_, i) => {
                const key = `${y}-${String(i + 1).padStart(2, '0')}`;
                const r = months.has(key) ? months.get(key) : null;
                return (
                  <td key={key} style={cellStyle(r)} title={r !== null ? `${key}: ${fmtPct(r)}` : key}>
                    {r !== null ? cellText(r) : ''}
                  </td>
                );
              })}
              <td className="pp-heatmap-year-col" style={cellStyle(years.get(y) ?? null)}>
                {years.has(y) ? cellText(years.get(y)) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
