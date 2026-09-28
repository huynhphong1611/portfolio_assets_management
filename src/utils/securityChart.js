/**
 * Data for the per-security trade chart (Performance › Securities):
 * market price line, moving average cost (a step line, broken while the
 * position is closed) and one marker per buy / sell.
 */

/**
 * @param {Array} log - replay.securities[ticker].log: [{date, side, qty, amount, price, avgCost, qtyAfter}]
 * @param {Array} priceSeries - [{date, value}] ascending market prices
 * @param {{ today: string, currentPrice?: number }} opts
 * @returns {{ start, end, price: [{date,value}], avgSegments: [[{date,value}]], trades: [...] } | null}
 */
export function buildSecurityChartData(log = [], priceSeries = [], { today, currentPrice = 0 } = {}) {
  const trades = (log || []).filter(t => t && t.date && t.qty > 0);
  if (!trades.length) return null;

  const start = trades[0].date;
  const end = today && today > trades[trades.length - 1].date ? today : trades[trades.length - 1].date;

  // Market prices from the first trade on (plus the last quote before it, so the line starts at the left edge)
  const sorted = (priceSeries || []).filter(p => p && p.date && p.value > 0 && p.date <= end);
  let price = sorted.filter(p => p.date >= start);
  const before = sorted.filter(p => p.date < start).pop();
  if (before) price = [{ date: start, value: before.value }, ...price];
  if (currentPrice > 0) {
    price = price.filter(p => p.date < end);
    price.push({ date: end, value: currentPrice });
  }

  // Average cost holds until the next trade; a full sale ends the segment.
  const avgSegments = [];
  let seg = null;
  for (const t of trades) {
    if (seg) seg.push({ date: t.date, value: seg[seg.length - 1].value });
    if (t.qtyAfter > 1e-4) {
      if (!seg) { seg = []; avgSegments.push(seg); }
      if (t.side === 'buy') seg.push({ date: t.date, value: t.avgCost });
    } else {
      seg = null;
    }
  }
  if (seg) seg.push({ date: end, value: seg[seg.length - 1].value });

  return { start, end, price, avgSegments: avgSegments.filter(s => s.length > 1), trades };
}

/** Average cost on `date` (after that day's trades), or null when nothing was held. */
export function avgCostOn(log = [], date) {
  let avg = null;
  for (const t of log) {
    if (t.date > date) break;
    avg = t.qtyAfter > 1e-4 ? t.avgCost : null;
  }
  return avg;
}
