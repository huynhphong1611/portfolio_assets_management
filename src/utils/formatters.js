export const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export const formatNum = (value) => new Intl.NumberFormat('vi-VN').format(value);
export const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

/**
 * Format a USD hint value (e.g. price_usd for crypto).
 * Always shows 2 decimal places.
 */
export const formatUSD = (value) => {
  if (!value && value !== 0) return null;
  const decimals = value >= 1000 ? 0 : value >= 1 ? 2 : 6;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Compute USD hint from a VND price and USDT/VND rate.
 * Returns null if rate is missing or zero.
 */
export const vndToUSD = (priceVND, usdtVndRate) => {
  if (!usdtVndRate || usdtVndRate <= 0 || !priceVND) return null;
  return priceVND / usdtVndRate;
};

/**
 * Format quantity with appropriate decimal places.
 * Crypto & Gold (Vàng) → 6 decimals for precision (e.g. 0.001234 BTC, 0.025000 PAXG)
 * Other assets → default locale formatting
 */
export const formatQty = (value, assetClass) => {
  if (assetClass === 'Tài sản mã hóa' || assetClass === 'Vàng') {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(value);
  }
  return new Intl.NumberFormat('vi-VN').format(value);
};
// ============================================================
// Portfolio Performance style helpers
// ============================================================

/** Fraction → "+12.34%" (null-safe). */
export const fmtPct = (fraction, digits = 2) => {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  const v = fraction * 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
};

/** Fraction → "12.34%" without sign. */
export const fmtPctPlain = (fraction, digits = 1) => {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
};

/** VND with explicit sign: "+1.234.567 ₫". */
export const fmtSignedVND = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const s = formatVND(Math.abs(value));
  return value > 0 ? `+${s}` : value < 0 ? `−${s}` : s;
};

/** Compact VND: 1.2 tỷ / 340 tr / 12k. */
export const fmtCompactVND = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)} tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)} tr`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}k`;
  return `${sign}${abs.toFixed(0)}`;
};

/** Plain VND number without currency symbol (null-safe). */
export const fmtVND = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
};

/** Price with sensible decimals (crypto sub-1 prices keep precision). */
export const fmtPrice = (value) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 0 : abs >= 1 ? 2 : 6;
  return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);
};

/** Holding period in days → "1 năm 2 tháng" / "45 ngày". */
export const fmtDuration = (days) => {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—';
  if (days < 31) return `${Math.round(days)} ngày`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0) return `${months} tháng`;
  return months > 0 ? `${years} năm ${months} tháng` : `${years} năm`;
};

/** CSS tone class for a signed number. */
export const toneOf = (value) => (value > 0 ? 'pp-up' : value < 0 ? 'pp-down' : 'pp-flat');
