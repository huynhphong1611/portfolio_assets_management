import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGetDailyPriceHistory } from '../services/api.js';

/**
 * System daily price history (admin/scheduler maintained), turned into
 * per-ticker ascending series: { TICKER: [{date, value}] }.
 */
export function useDailyPriceHistory(limit = 365) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetDailyPriceHistory(limit);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  const seriesByTicker = useMemo(() => {
    const out = {};
    const sorted = [...entries].filter(e => e && e.date).sort((a, b) => a.date.localeCompare(b.date));
    for (const e of sorted) {
      for (const [ticker, price] of Object.entries(e.prices || {})) {
        const v = Number(price);
        if (!Number.isFinite(v) || v <= 0) continue;
        (out[ticker] = out[ticker] || []).push({ date: e.date, value: v });
      }
      const usdt = Number(e.usdt_vnd_rate);
      if (Number.isFinite(usdt) && usdt > 0 && !(e.prices || {}).USDT) {
        (out.USDT = out.USDT || []).push({ date: e.date, value: usdt });
      }
    }
    return out;
  }, [entries]);

  return { entries, seriesByTicker, loading, reload: load };
}

/** Last value and change vs. the previous observation. */
export function lastChange(series = []) {
  if (!series.length) return { last: null, prev: null, change: null, date: null };
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  return {
    last: last.value, date: last.date, prev: prev ? prev.value : null,
    change: prev && prev.value > 0 ? last.value / prev.value - 1 : null,
  };
}
