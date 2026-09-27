/**
 * Reporting period — the global time window every report is evaluated over
 * (the equivalent of Portfolio Performance's "reporting period" drop-down).
 */
import { addMonths, addYears, todayISO } from './dates.js';

export const PERIOD_PRESETS = [
  { key: '1M',     label: '1 tháng' },
  { key: '3M',     label: '3 tháng' },
  { key: '6M',     label: '6 tháng' },
  { key: 'YTD',    label: 'Từ đầu năm (YTD)' },
  { key: '1Y',     label: '1 năm' },
  { key: '2Y',     label: '2 năm' },
  { key: '3Y',     label: '3 năm' },
  { key: 'ALL',    label: 'Toàn bộ' },
  { key: 'CUSTOM', label: 'Tùy chọn…' },
];

export const DEFAULT_PERIOD = { preset: '1Y', customStart: '', customEnd: '' };

/**
 * Resolve a period selection to concrete ISO dates.
 *
 * The start date is the *baseline* date: the value at the end of that day is
 * the initial value, and only cash flows strictly after it are counted.
 * (For YTD this is 31 Dec of the previous year, exactly like Portfolio Performance.)
 */
export function resolvePeriod(selection, { firstDate = null, today = todayISO() } = {}) {
  const { preset = '1Y', customStart, customEnd } = selection || {};
  const end = today;
  const earliest = firstDate || addYears(today, -1);

  switch (preset) {
    case '1M':  return { start: addMonths(end, -1), end, label: '1 tháng' };
    case '3M':  return { start: addMonths(end, -3), end, label: '3 tháng' };
    case '6M':  return { start: addMonths(end, -6), end, label: '6 tháng' };
    case 'YTD': return { start: `${end.slice(0, 4) - 1}-12-31`, end, label: 'Từ đầu năm' };
    case '1Y':  return { start: addYears(end, -1), end, label: '1 năm' };
    case '2Y':  return { start: addYears(end, -2), end, label: '2 năm' };
    case '3Y':  return { start: addYears(end, -3), end, label: '3 năm' };
    case 'ALL': return { start: earliest, end, label: 'Toàn bộ' };
    case 'CUSTOM': {
      const s = customStart || earliest;
      const e = customEnd || end;
      return { start: s <= e ? s : e, end: e, label: 'Tùy chọn' };
    }
    default:    return { start: addYears(end, -1), end, label: '1 năm' };
  }
}

export function periodLabel(selection) {
  const p = PERIOD_PRESETS.find(x => x.key === (selection?.preset || '1Y'));
  if (selection?.preset === 'CUSTOM' && selection.customStart) {
    return `${selection.customStart} → ${selection.customEnd || 'nay'}`;
  }
  return p ? p.label : '1 năm';
}
