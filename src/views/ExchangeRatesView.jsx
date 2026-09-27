import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Empty } from '../components/ui';
import LineChart from '../components/charts/LineChart.jsx';
import { useDailyPriceHistory, lastChange } from '../hooks/useDailyPriceHistory.js';
import { fmtPrice, fmtPct } from '../utils/formatters.js';
import { formatISO } from '../utils/dates.js';

const RATES = [
  { ticker: 'USDT', label: 'USDT / VNĐ', color: '#0ea5e9' },
  { ticker: 'USDC', label: 'USDC / VNĐ', color: '#2563eb' },
  { ticker: 'GOLD', label: 'Vàng SJC (VNĐ/lượng)', color: '#eab308' },
];

/** PP → General Data → Exchange Rates (stablecoins and SJC gold). */
export default function ExchangeRatesView() {
  const { marketPrices } = usePortfolioData();
  const { seriesByTicker, loading } = useDailyPriceHistory(365);

  const cards = RATES.map(r => {
    const quote = marketPrices[r.ticker] || {};
    const hist = lastChange(seriesByTicker[r.ticker]);
    return { ...r, value: quote.exchangeRate || quote.sell || quote.price || hist.last || null, date: quote.date || hist.date, change: hist.change, buy: quote.buy, sell: quote.sell };
  });

  const table = useMemo(() => {
    const dates = new Set();
    RATES.forEach(r => (seriesByTicker[r.ticker] || []).forEach(p => dates.add(p.date)));
    const maps = Object.fromEntries(RATES.map(r => [r.ticker, Object.fromEntries((seriesByTicker[r.ticker] || []).map(p => [p.date, p.value]))]));
    return Array.from(dates).sort().reverse().slice(0, 60).map(date => ({ date, ...Object.fromEntries(RATES.map(r => [r.ticker, maps[r.ticker][date] ?? null])) }));
  }, [seriesByTicker]);

  const chart = (ticker, color, label) => {
    const s = seriesByTicker[ticker] || [];
    if (s.length < 2) return <Empty title={`Chưa có lịch sử ${label}`} />;
    return <LineChart height={240} yLabel="number" datasets={[{ label, color, fill: true, data: s.map(p => ({ x: p.date, y: p.value })) }]} />;
  };

  return (
    <>
      <PageHeader title="Tỷ giá & Vàng" subtitle="Exchange Rates · tỷ giá stablecoin và giá vàng dùng để quy đổi tài sản về VNĐ" />
      <div className="pp-kpi-grid pp-kpi-grid--3">
        {cards.map(c => (
          <Kpi key={c.ticker} label={c.label} value={c.value ? fmtPrice(c.value) : '—'} tone="neutral"
            sub={[c.date ? formatISO(c.date) : null, c.change !== null ? `${fmtPct(c.change)} so với phiên trước` : null, c.buy && c.sell ? `mua ${fmtPrice(c.buy)} · bán ${fmtPrice(c.sell)}` : null].filter(Boolean).join(' · ')} />
        ))}
      </div>
      {loading ? <Card><div className="pp-loading-inline"><Loader2 size={16} className="spin" /> Đang tải lịch sử…</div></Card> : (
        <>
          <div className="pp-grid-2">
            <Card title="USDT / VNĐ">{chart('USDT', '#0ea5e9', 'USDT/VNĐ')}</Card>
            <Card title="Vàng SJC">{chart('GOLD', '#eab308', 'Vàng SJC')}</Card>
          </div>
          <Card title="Bảng tỷ giá (60 phiên gần nhất)" padded={false}>
            <DataTable
              rows={table}
              rowKey={r => r.date}
              footer={false}
              maxHeight={480}
              defaultSort={{ key: 'date', dir: 'desc' }}
              emptyText="Chưa có dữ liệu tỷ giá"
              columns={[
                { key: 'date', label: 'Ngày', render: r => formatISO(r.date) },
                ...RATES.map(rate => ({ key: rate.ticker, label: rate.label, align: 'right', render: r => (r[rate.ticker] ? fmtPrice(r[rate.ticker]) : '—') })),
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}
