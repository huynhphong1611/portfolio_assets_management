import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

const pad = n => String(n).padStart(2, '0');

/** "dd/mm/yyyy[ HH:mm[:ss]]" → "yyyy-MM-ddTHH:mm:ss" (the value a datetime-local input takes) */
export function toPickerValue(text) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*$/.exec(text || '');
  if (!m) return '';
  const [, d, mo, y, h = '0', mi = '0', s = '0'] = m;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:${pad(s)}`;
}

/** "yyyy-MM-ddTHH:mm[:ss]" → "dd/mm/yyyy HH:mm:ss" */
export function fromPickerValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value || '');
  if (!m) return '';
  const [, y, mo, d, h, mi, s = '00'] = m;
  return `${d}/${mo}/${y} ${h}:${mi}:${s}`;
}

/**
 * Text field for "dd/mm/yyyy HH:mm:ss" with a calendar button that opens the
 * browser's native date-time picker. Typing by hand still works.
 */
export default function DateTimeInput({ value, onChange, required, placeholder = 'dd/mm/yyyy HH:mm:ss' }) {
  const pickerRef = useRef(null);

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };

  return (
    <div className="datetime-input">
      <input type="text" className="form-input" value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
      <button type="button" className="datetime-input__btn" onClick={openPicker} title="Chọn ngày giờ" aria-label="Chọn ngày giờ">
        <CalendarDays size={16} />
      </button>
      <input ref={pickerRef} type="datetime-local" step="1" tabIndex={-1} aria-hidden="true"
        className="datetime-input__native" value={toPickerValue(value)}
        onChange={e => { const v = fromPickerValue(e.target.value); if (v) onChange(v); }} />
    </div>
  );
}
