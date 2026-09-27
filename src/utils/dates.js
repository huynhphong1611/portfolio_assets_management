/**
 * Date helpers.
 *
 * Two date formats live in this project:
 *   - Transactions use the Vietnamese format  "dd/MM/yyyy HH:mm:ss"
 *   - Snapshots / prices use ISO dates          "YYYY-MM-DD"
 * Everything in the reporting layer works with ISO dates.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Parse "dd/MM/yyyy[ HH:mm:ss]" or an ISO string into a Date (local time). */
export function parseVNDate(str) {
  if (!str) return new Date(0);
  if (str instanceof Date) return str;
  const s = String(str).trim();
  if (s.includes('/')) {
    const [datePart, timePart = '00:00:00'] = s.split(' ');
    const [d, m, y] = datePart.split('/').map(Number);
    const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);
    if (y && m && d) return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/** Format a Date as local ISO date "YYYY-MM-DD". */
export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Convert any supported date string to "YYYY-MM-DD". */
export function toISO(str) {
  if (!str) return '';
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return toISODate(parseVNDate(s));
}

/** Today as local ISO date. */
export function todayISO() {
  return toISODate(new Date());
}

/** Whole days between two ISO dates (b − a). DST-safe (uses UTC arithmetic). */
export function daysBetween(a, b) {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Add n days to an ISO date. */
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

/** Add n months to an ISO date (clamps to month end). */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toISODate(target);
}

/** Add n years to an ISO date. */
export function addYears(iso, n) {
  return addMonths(iso, n * 12);
}

/** "YYYY-MM" key of an ISO date. */
export function monthKey(iso) {
  return iso.slice(0, 7);
}

/** Format an ISO date as "dd/MM/yyyy". */
export function formatISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Format a Vietnamese date string as "dd/MM/yyyy" (drops the time part). */
export function formatVNDateShort(str) {
  return formatISO(toISO(str));
}

/** Current timestamp in the transaction format "dd/MM/yyyy HH:mm:ss". */
export function nowVN() {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
