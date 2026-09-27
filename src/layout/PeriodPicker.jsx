import React from 'react';
import { CalendarRange } from 'lucide-react';
import { useReportingPeriod } from '../contexts/ReportingPeriodContext.jsx';
import { PERIOD_PRESETS } from '../utils/reportingPeriod.js';
import { formatISO } from '../utils/dates.js';

/** Reporting period selector shown in the toolbar. */
export default function PeriodPicker() {
  const { selection, setPreset, setCustom, range } = useReportingPeriod();
  const isCustom = selection.preset === 'CUSTOM';

  return (
    <div className="pp-period" title="Kỳ báo cáo áp dụng cho mọi báo cáo">
      <CalendarRange size={15} className="pp-period-icon" />
      <select
        className="pp-select"
        value={selection.preset}
        onChange={e => {
          const v = e.target.value;
          if (v === 'CUSTOM') setCustom(selection.customStart || range.start, selection.customEnd || range.end);
          else setPreset(v);
        }}
        aria-label="Kỳ báo cáo"
      >
        {PERIOD_PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {isCustom ? (
        <span className="pp-period-custom">
          <input type="date" className="pp-date" value={selection.customStart || ''} max={selection.customEnd || undefined}
            onChange={e => setCustom(e.target.value, selection.customEnd)} aria-label="Từ ngày" />
          <span className="pp-muted">→</span>
          <input type="date" className="pp-date" value={selection.customEnd || ''} min={selection.customStart || undefined}
            onChange={e => setCustom(selection.customStart, e.target.value)} aria-label="Đến ngày" />
        </span>
      ) : (
        <span className="pp-period-range">{formatISO(range.start)} – {formatISO(range.end)}</span>
      )}
    </div>
  );
}
