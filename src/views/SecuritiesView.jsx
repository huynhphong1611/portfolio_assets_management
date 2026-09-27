import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Search, Loader2, X } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Empty, TxTypeBadge, Badge } from '../components/ui';
import LineChart from '../components/charts/LineChart.jsx';
import { apiGetSystemTickers, apiUserFetchLivePrices, apiAddSystemTicker } from '../services/api.js';
import { useDailyPriceHistory, lastChange } from '../hooks/useDailyPriceHistory.js';
import { assetClassLabel } from '../utils/assetClasses.js';
import { fmtPrice, fmtVND, fmtPct, fmtSignedVND, toneOf, formatQty, formatUSD, vndToUSD } from '../utils/formatters.js';
import { formatISO, toISO, parseVNDate } from '../utils/dates.js';

const CATEGORIES = {
  stocks: 'Cổ phiếu & ETF',
  crypto: 'Crypto',
  funds: 'Chứng chỉ quỹ',
  base: 'Tỷ giá / Vàng',
  other: 'Khác',
};
const CLASS_TO_CATEGORY = {
  'Cổ phiếu': 'stocks', 'Trái phiếu': 'funds', 'Tài sản mã hóa': 'crypto', 'Tiền mặt USD': 'base', 'Vàng': 'base',
};
const BASE_TICKERS = ['USDT', 'USDC', 'GOLD'];

/** PP → General Data → All Securities (master data + latest quotes + price history). */
export default function SecuritiesView() {
  const { portfolio, marketPrices, usdtVndRate, transactions, recomputeAndSnapshot } = usePortfolioData();
  const { seriesByTicker, loading: histLoading, reload: reloadHistory } = useDailyPriceHistory(365);
  const [config, setConfig] = useState({ stocks: [], crypto: [], funds: [] });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState(null);
  const [adding, setAdding] = useState(null); // { ticker, category }

  const loadConfig = useCallback(() => apiGetSystemTickers().then(c => setConfig(c || { stocks: [], crypto: [], funds: [] })).catch(() => {}), []);
  useEffect(() => { loadConfig(); }, [loadConfig]);

  const rows = useMemo(() => {
    const map = new Map();
    const add = (ticker, cat) => { if (ticker && ticker !== 'VNĐ' && !map.has(ticker)) map.set(ticker, cat); };
    ['stocks', 'crypto', 'funds'].forEach(cat => (config[cat] || []).forEach(t => add(t, cat)));
    portfolio.forEach(p => add(p.ticker, CLASS_TO_CATEGORY[p.assetClass] || 'other'));
    BASE_TICKERS.forEach(t => { if (marketPrices[t] || seriesByTicker[t]) add(t, 'base'); });
    if (map.has('USDT') || map.has('USDC') || map.has('GOLD')) BASE_TICKERS.forEach(t => { if (map.has(t)) map.set(t, 'base'); });

    const holding = Object.fromEntries(portfolio.map(p => [p.ticker, p]));
    return Array.from(map.entries()).map(([ticker, cat]) => {
      const quote = marketPrices[ticker] || {};
      const hist = lastChange(seriesByTicker[ticker]);
      const price = quote.price || hist.last || null;
      const h = holding[ticker];
      return {
        ticker, category: cat,
        price, date: quote.date || hist.date || null, source: quote.source || '',
        change: hist.change,
        usd: (cat === 'crypto' || cat === 'base') && price && usdtVndRate > 0 && ticker !== 'USDT' && ticker !== 'USDC' ? vndToUSD(price, usdtVndRate) : null,
        qty: h ? h.qty : 0, value: h ? h.actualValue : 0, assetClass: h ? h.assetClass : null, holding: h || null,
      };
    });
  }, [config, portfolio, marketPrices, seriesByTicker, usdtVndRate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => (category === 'all' || (category === 'held' ? r.qty > 0 : r.category === category))
      && (!q || r.ticker.toLowerCase().includes(q)));
  }, [rows, query, category]);

  useEffect(() => {
    if (selected && rows.some(r => r.ticker === selected)) return;
    if (!rows.length) return;
    const largest = rows.reduce((best, r) => (r.value > best.value ? r : best), rows[0]);
    setSelected(largest.ticker);
  }, [rows, selected]);

  const handleFetch = async () => {
    setFetching(true);
    setStatus(null);
    try {
      const res = await apiUserFetchLivePrices();
      setStatus({ type: 'ok', text: `Đã cập nhật giá ${res?.fetched ?? 0}/${res?.total_tickers ?? 0} mã (${res?.date || ''}). Danh mục đã được tính lại.` });
      await recomputeAndSnapshot();
      reloadHistory();
    } catch (err) {
      setStatus({ type: 'error', text: `Lỗi cập nhật giá: ${err.message}` });
    } finally {
      setFetching(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const ticker = (adding?.ticker || '').trim().toUpperCase();
    if (!ticker) return;
    try {
      await apiAddSystemTicker(adding.category, ticker);
      setStatus({ type: 'ok', text: `Đã thêm ${ticker} vào danh sách theo dõi giá.` });
      setAdding(null);
      loadConfig();
    } catch (err) {
      setStatus({ type: 'error', text: `Không thêm được ${ticker}: ${err.message}` });
    }
  };

  const detail = rows.find(r => r.ticker === selected) || null;

  return (
    <>
      <PageHeader
        title="Tất cả chứng khoán"
        subtitle="All Securities · danh sách mã được theo dõi giá (vnstock, CoinGecko, SJC) và mã đang nắm giữ"
        actions={(
          <>
            <button type="button" className="pp-btn" onClick={() => setAdding(a => (a ? null : { ticker: '', category: 'stocks' }))}><Plus size={15} /> Thêm mã</button>
            <button type="button" className="pp-btn pp-btn--primary" onClick={handleFetch} disabled={fetching}>
              {fetching ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} {fetching ? 'Đang lấy giá…' : 'Cập nhật giá'}
            </button>
          </>
        )}
      />

      {status && <div className={`pp-alert ${status.type === 'error' ? 'pp-alert--error' : 'pp-alert--ok'}`}>{status.text}</div>}

      {adding && (
        <form className="pp-inline-form" onSubmit={handleAdd}>
          <input className="pp-input" autoFocus placeholder="Mã (VD: VNM, BTC, VESAF)" value={adding.ticker}
            onChange={e => setAdding(a => ({ ...a, ticker: e.target.value }))} aria-label="Mã mới" />
          <select className="pp-select" value={adding.category} onChange={e => setAdding(a => ({ ...a, category: e.target.value }))} aria-label="Nhóm">
            <option value="stocks">Cổ phiếu & ETF</option>
            <option value="crypto">Crypto</option>
            <option value="funds">Chứng chỉ quỹ mở</option>
          </select>
          <button type="submit" className="pp-btn pp-btn--primary">Thêm</button>
          <button type="button" className="pp-icon-btn" onClick={() => setAdding(null)} aria-label="Hủy"><X size={16} /></button>
        </form>
      )}

      <div className="pp-split pp-split--wide">
        <Card padded={false} className="pp-split-list"
          title={`${filtered.length} mã`}
          actions={(
            <div className="pp-row-actions">
              <select className="pp-select pp-select--sm" value={category} onChange={e => setCategory(e.target.value)} aria-label="Lọc nhóm">
                <option value="all">Tất cả</option>
                <option value="held">Đang nắm giữ</option>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="pp-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã…" aria-label="Tìm mã" /></div>
            </div>
          )}>
          <DataTable
            rows={filtered}
            rowKey={r => r.ticker}
            selectedKey={selected}
            onRowClick={r => setSelected(r.ticker)}
            footer={false}
            maxHeight={620}
            defaultSort={{ key: 'value', dir: 'desc' }}
            emptyText="Không có mã phù hợp"
            columns={[
              { key: 'ticker', label: 'Mã', render: r => <><div className="pp-strong">{r.ticker}</div><div className="pp-meta">{CATEGORIES[r.category]}</div></> },
              { key: 'price', label: 'Giá (VNĐ)', align: 'right', render: r => (r.price ? <>{fmtPrice(r.price)}{r.usd !== null && <div className="pp-meta">≈ {formatUSD(r.usd)}</div>}</> : <span className="pp-muted">chưa có giá</span>) },
              { key: 'change', label: '± phiên', align: 'right', sortValue: r => (r.change === null ? -Infinity : r.change), render: r => <span className={toneOf(r.change || 0)}>{fmtPct(r.change)}</span> },
              { key: 'date', label: 'Ngày giá', render: r => (r.date ? formatISO(r.date) : '—') },
              { key: 'value', label: 'Đang giữ', align: 'right', render: r => (r.value > 0 ? fmtVND(r.value) : '') },
            ]}
          />
        </Card>

        <div className="pp-split-detail">
          {detail
            ? <SecurityDetail row={detail} series={seriesByTicker[detail.ticker] || []} histLoading={histLoading} transactions={transactions} />
            : <Card><Empty title="Chọn một mã" hint="Bấm vào một dòng để xem lịch sử giá, vị thế và các giao dịch của mã đó." /></Card>}
        </div>
      </div>
    </>
  );
}

function SecurityDetail({ row, series, histLoading, transactions }) {
  const txs = useMemo(() => transactions
    .filter(t => (t.ticker || '').toUpperCase() === row.ticker)
    .sort((a, b) => parseVNDate(b.date) - parseVNDate(a.date)), [transactions, row.ticker]);
  const h = row.holding;

  const datasets = series.length > 1
    ? [{ label: row.ticker, color: '#2563eb', fill: true, data: series.map(p => ({ x: p.date, y: p.value })) }]
    : [];

  return (
    <>
      <div className="pp-kpi-grid pp-kpi-grid--3">
        <Kpi label={`${row.ticker} · giá mới nhất`} value={row.price ? fmtPrice(row.price) : '—'} tone="neutral"
          sub={row.date ? `${formatISO(row.date)}${row.source ? ` · ${row.source}` : ''}` : null} />
        <Kpi label="Đang nắm giữ" value={h ? formatQty(h.qty, h.assetClass) : '0'} tone="neutral"
          sub={h ? `Giá vốn BQ ${fmtPrice(h.avgCost)} · ${assetClassLabel(h.assetClass)}` : 'Không nắm giữ'} />
        <Kpi label="Lãi/lỗ chưa thực hiện" value={h ? fmtSignedVND(h.pnl) : '—'} raw={h ? h.pnl : null}
          sub={h && h.totalCost > 0 ? `${fmtPct(h.pnl / h.totalCost)} · giá trị ${fmtVND(h.actualValue)}` : null} />
      </div>
      <Card title="Lịch sử giá" subtitle="Giá đóng cửa hằng ngày do hệ thống lưu (tối đa 365 phiên)">
        {histLoading ? <div className="pp-loading-inline"><Loader2 size={16} className="spin" /> Đang tải…</div>
          : datasets.length ? <LineChart datasets={datasets} height={260} /> : <Empty title="Chưa có lịch sử giá cho mã này" />}
      </Card>
      <Card title={`Giao dịch ${row.ticker}`} padded={false}>
        <DataTable
          rows={txs}
          rowKey={(r, i) => r.id || i}
          footer={false}
          emptyText="Chưa có giao dịch"
          columns={[
            { key: 'date', label: 'Ngày', sortValue: r => parseVNDate(r.date).getTime(), render: r => formatISO(toISO(r.date)) },
            { key: 'transactionType', label: 'Loại', render: r => <TxTypeBadge type={r.transactionType} /> },
            { key: 'quantity', label: 'Số lượng', align: 'right', sortValue: r => Math.abs(r.quantity || 0), render: r => formatQty(Math.abs(r.quantity || 0), r.assetClass) },
            { key: 'unitPrice', label: 'Đơn giá', align: 'right', render: r => (r.unitPrice ? `${fmtPrice(r.unitPrice)}${r.currency && r.currency !== 'VNĐ' ? ` ${r.currency}` : ''}` : '—') },
            { key: 'totalVND', label: 'Thành tiền', align: 'right', sortValue: r => Math.abs(r.totalVND || 0), render: r => fmtVND(Math.abs(r.totalVND || 0)) },
            { key: 'storage', label: 'Nơi lưu ký', render: r => (r.storage ? <Badge tone="gray">{r.storage}</Badge> : '—') },
          ]}
        />
      </Card>
    </>
  );
}
