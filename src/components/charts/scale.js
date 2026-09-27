/**
 * Axis helpers shared by the SVG charts: "nice" tick values and compact labels.
 */

/** Round a raw step to the closest of 1, 2, 2.5, 5 × 10^n. */
export function niceStep(span, target = 4) {
  const raw = Math.abs(span) / Math.max(1, target);
  if (!Number.isFinite(raw) || raw === 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  // closest nice value (Heckbert-style rounding)
  const nice = norm < 1.5 ? 1 : norm < 2.25 ? 2 : norm < 3.5 ? 2.5 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

/**
 * Nice axis bounds and ticks covering [min, max].
 * @returns {{ min: number, max: number, ticks: number[] }}
 */
export function niceTicks(min, max, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad; max += pad;
  }
  const step = niceStep(max - min, target);
  const lo = Math.floor(min / step) * step;
  let hi = Math.ceil(max / step) * step;
  if (hi - lo < step) hi = lo + step;
  const n = Math.round((hi - lo) / step);
  const ticks = [];
  for (let i = 0; i <= n; i++) {
    const v = lo + i * step;
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return { min: lo, max: hi, ticks };
}

const trim = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');

/** 1.2 tỷ / 340 tr / 12k — VND axis labels. */
export function compactVND(val) {
  const abs = Math.abs(val);
  const sign = val < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${trim((abs / 1e9).toFixed(2))} tỷ`;
  if (abs >= 1e6) return `${sign}${trim((abs / 1e6).toFixed(1))} tr`;
  if (abs >= 1e3) return `${sign}${trim((abs / 1e3).toFixed(0))}k`;
  return `${sign}${trim(abs.toFixed(0))}`;
}

/** 12% / 12.5% — percent axis labels. */
export function compactPct(val) {
  return `${trim(val.toFixed(1))}%`;
}

/** Axis date label: dd/MM for short ranges, MM/yy for long ones. */
export function dateAxisLabel(iso, longRange) {
  if (!iso || iso.length < 10) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return longRange ? `${m}/${y.slice(2)}` : `${d}/${m}`;
}

/** Tooltip date label: dd/MM/yyyy. */
export function dateTooltipLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** True when the ISO dates span more than ~10 months. */
export function isLongRange(firstIso, lastIso) {
  const a = Date.parse(firstIso), b = Date.parse(lastIso);
  return Number.isFinite(a) && Number.isFinite(b) && (b - a) / 86400000 > 300;
}
