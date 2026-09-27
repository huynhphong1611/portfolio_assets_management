/**
 * Price resolution — Portfolio Performance "quote feed" model, per user.
 *
 *   AUTO          system prices (vnstock / CoinGecko / SJC) win; the user's own
 *                 prices only fill dates the system does not know
 *   MANUAL        prices entered or imported by the user (never downloaded)
 *   GENERIC-JSON  prices downloaded from a JSON URL configured by the user
 *
 * Mirrors apply_user_prices() in backend/app/services/portfolio_service.py.
 */
import { todayISO } from './dates.js';

export const FEEDS = { AUTO: 'AUTO', MANUAL: 'MANUAL', JSON: 'GENERIC-JSON' };

export const FEED_LABELS = {
  AUTO: 'Tự động',
  MANUAL: 'Nhập tay',
  'GENERIC-JSON': 'JSON',
};

export const FEED_HINTS = {
  AUTO: 'Giá lấy tự động từ vnstock, CoinGecko hoặc SJC. Giá bạn nhập chỉ dùng cho những ngày hệ thống không có giá.',
  MANUAL: 'Bạn tự nhập hoặc import giá từ CSV. Phù hợp với vàng nhẫn, trái phiếu riêng lẻ, tài sản không có API.',
  'GENERIC-JSON': 'Hệ thống tải một URL trả về JSON và đọc giá theo đường dẫn JSONPath, mỗi sáng và khi bạn bấm Cập nhật giá.',
};

const USER_PRICED = new Set([FEEDS.MANUAL, FEEDS.JSON]);
const STABLECOINS = new Set(['USDT', 'USDC']);

/** ticker → feed id (defaults to AUTO). */
export function securityFeeds(securities = []) {
  const map = {};
  for (const s of securities || []) {
    const ticker = String(s.ticker || s.id || '').trim().toUpperCase();
    if (ticker) map[ticker] = String(s.feed || FEEDS.AUTO).toUpperCase();
  }
  return map;
}

export function feedOf(securitiesOrFeeds, ticker) {
  const feeds = Array.isArray(securitiesOrFeeds) ? securityFeeds(securitiesOrFeeds) : securitiesOrFeeds;
  return feeds[ticker] || FEEDS.AUTO;
}

/** Most recent {date, price} on/before `date` in a {"YYYY-MM-DD": price} map. */
export function latestOnOrBefore(priceMap, date = todayISO()) {
  let best = null;
  for (const d of Object.keys(priceMap || {})) {
    if (d <= date && (best === null || d > best)) best = d;
  }
  if (best === null) return null;
  const price = Number(priceMap[best]);
  return Number.isFinite(price) && price > 0 ? { date: best, price } : null;
}

/**
 * System market prices overlaid with the user's own prices for `date`.
 * Returns a new map compatible with calculatePortfolio().
 */
export function resolveMarketPrices(systemPrices = {}, securities = [], userPrices = {}, date = todayISO()) {
  const out = { ...(systemPrices || {}) };
  const feeds = securityFeeds(securities);
  const tickers = new Set([...Object.keys(userPrices || {}), ...Object.keys(feeds)]);
  for (const ticker of tickers) {
    const latest = latestOnOrBefore(userPrices?.[ticker], date);
    if (!latest) continue;
    const feed = feeds[ticker] || FEEDS.AUTO;
    const hasSystem = !!(out[ticker] && out[ticker].price);
    if (USER_PRICED.has(feed) || !hasSystem) {
      const entry = { price: latest.price, date: latest.date, source: 'user' };
      if (STABLECOINS.has(ticker)) entry.exchangeRate = latest.price;
      out[ticker] = entry;
    }
  }
  return out;
}

/**
 * Price history for charts: system series and the user's own prices merged by date.
 * The winner on a shared date follows the same rule as resolveMarketPrices().
 * @returns {Array<{date, value, source: 'system'|'user'}>}
 */
export function mergePriceSeries(systemSeries = [], userMap = {}, feed = FEEDS.AUTO) {
  const byDate = new Map();
  const userFirst = USER_PRICED.has(feed);
  const put = (date, value, source, priority) => {
    const cur = byDate.get(date);
    if (!cur || priority > cur.priority) byDate.set(date, { date, value, source, priority });
  };
  for (const p of systemSeries || []) {
    if (p && p.date && Number(p.value) > 0) put(p.date, Number(p.value), 'system', userFirst ? 1 : 2);
  }
  for (const [date, value] of Object.entries(userMap || {})) {
    if (Number(value) > 0) put(date, Number(value), 'user', userFirst ? 2 : 1);
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, value, source }) => ({ date, value, source }));
}
