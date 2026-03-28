export const formatVND = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
export const formatNum = (value) => new Intl.NumberFormat('vi-VN').format(value);
export const formatPercent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;