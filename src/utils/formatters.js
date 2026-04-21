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