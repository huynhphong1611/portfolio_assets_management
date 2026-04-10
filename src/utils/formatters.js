export const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export const formatNum = (value) => new Intl.NumberFormat('vi-VN').format(value);
export const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

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