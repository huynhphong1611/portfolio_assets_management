import React from 'react';

/**
 * Key-figure widget (PP dashboard "indicator" widget).
 * tone: 'auto' colours by sign of `raw`, or 'up' | 'down' | 'neutral'.
 */
export default function Kpi({ label, value, sub, raw = null, tone = 'auto', hint, size = 'md' }) {
  let cls = 'pp-flat';
  if (tone === 'auto' && typeof raw === 'number') cls = raw > 0 ? 'pp-up' : raw < 0 ? 'pp-down' : 'pp-flat';
  else if (tone === 'up') cls = 'pp-up';
  else if (tone === 'down') cls = 'pp-down';
  else if (tone === 'neutral') cls = 'pp-neutral';
  return (
    <div className={`pp-kpi pp-kpi--${size}`} title={hint || ''}>
      <div className="pp-kpi-label">{label}</div>
      <div className={`pp-kpi-value ${cls}`}>{value}</div>
      {sub && <div className="pp-kpi-sub">{sub}</div>}
    </div>
  );
}
