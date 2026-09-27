/**
 * Asset class metadata shared by every chart and table
 * (one colour per class everywhere in the app).
 */
import { ASSET_CLASS_LABELS, ASSET_CLASS_GROUPS } from './portfolioCalculator.js';

export const ASSET_CLASS_ORDER = [
  'Tiền mặt VNĐ',
  'Tiền mặt USD',
  'Trái phiếu',
  'Cổ phiếu',
  'Tài sản mã hóa',
  'Vàng',
];

export const ASSET_CLASS_COLORS = {
  'Tiền mặt VNĐ':   '#6366f1',
  'Tiền mặt USD':   '#3b82f6',
  'Trái phiếu':     '#10b981',
  'Cổ phiếu':       '#f59e0b',
  'Tài sản mã hóa': '#ef4444',
  'Vàng':           '#eab308',
};

/** Categorical palette for series without a fixed colour (securities, accounts…). */
export const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b', '#84cc16', '#0ea5e9'];

export const assetClassLabel = (cls) => ASSET_CLASS_LABELS[cls] || cls || 'Khác';
export const assetClassColor = (cls, i = 0) => ASSET_CLASS_COLORS[cls] || PALETTE[i % PALETTE.length];
export const assetClassGroup = (cls) => ASSET_CLASS_GROUPS[cls] || 'Đầu tư';

/** Donut data by asset class from a valued portfolio. */
export function allocationByAssetClass(portfolio = []) {
  const map = {};
  for (const p of portfolio) map[p.assetClass] = (map[p.assetClass] || 0) + (p.actualValue || 0);
  const ordered = [...ASSET_CLASS_ORDER, ...Object.keys(map).filter(k => !ASSET_CLASS_ORDER.includes(k))];
  return ordered
    .filter(cls => (map[cls] || 0) > 0)
    .map((cls, i) => ({ key: cls, label: assetClassLabel(cls), value: map[cls], color: assetClassColor(cls, i) }));
}

/** Donut data for the largest N positions (+ "Khác"). */
export function allocationBySecurity(portfolio = [], top = 9) {
  const items = portfolio
    .filter(p => p.actualValue > 0)
    .map(p => ({ label: p.ticker === 'VNĐ' ? 'Tiền mặt VNĐ' : p.ticker, value: p.actualValue }))
    .sort((a, b) => b.value - a.value);
  const head = items.slice(0, top);
  const rest = items.slice(top).reduce((s, x) => s + x.value, 0);
  if (rest > 0) head.push({ label: 'Khác', value: rest });
  return head.map((x, i) => ({ ...x, color: PALETTE[i % PALETTE.length] }));
}
