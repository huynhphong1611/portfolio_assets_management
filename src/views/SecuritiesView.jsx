import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Search, Loader2, X, Upload, Trash2, Save, FlaskConical, AlertTriangle } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader, DataTable, Empty, TxTypeBadge, Badge, Tabs } from '../components/ui';
import LineChart from '../components/charts/LineChart.jsx';
import ImportCSVModal from '../components/ImportCSVModal.jsx';
import {
  apiUpdateQuotes, apiSaveSecurity, apiDeleteSecurity, apiSaveSecurityPrices,
  apiDeleteSecurityPrice, apiTestQuoteFeed,
} from '../services/api.js';
import { useDailyPriceHistory } from '../hooks/useDailyPriceHistory.js';
import { FEEDS, FEED_LABELS, FEED_HINTS, securityFeeds, mergePriceSeries } from '../utils/priceResolver.js';
import { ASSET_CLASS_ORDER, assetClassLabel } from '../utils/assetClasses.js';
import { fmtPrice, fmtVND, fmtPct, fmtSignedVND, toneOf, formatQty, formatUSD, vndToUSD, parseInputNumber } from '../utils/formatters.js';
import { formatISO, toISO, parseVNDate, todayISO } from '../utils/dates.js';

const FEED_TONES = { AUTO: 'blue', MANUAL: 'orange', 'GENERIC-JSON': 'violet' };
const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'held', label: 'Đang nắm giữ' },
  { key: 'missing', label: 'Thiếu giá' },
  { key: 'AUTO', label: 'Nguồn: Tự động' },
  { key: 'MANUAL', label: 'Nguồn: Nhập tay' },
  { key: 'GENERIC-JSON', label: 'Nguồn: JSON' },
];

export function FeedBadge({ feed }) {
  return <Badge tone={FEED_TONES[feed] || 'gray'}>{FEED_LABELS[feed] || feed}</Badge>;
}

/** PP → General Data → All Securities: the user's own securities, quote feeds and prices. */
export default function SecuritiesView() {
  const { portfolio, marketPrices, usdtVndRate, transactions, securities, userPrices, refresh, recomputeAndSnapshot } = usePortfolioData();
  const { seriesByTicker, loading: histLoading, reload: reloadHistory } = useDailyPriceHistory(365);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [adding, setAdding] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const feeds = useMemo(() => securityFeeds(securities), [securities]);
  const secByTicker = useMemo(
    () => Object.fromEntries((securities || []).map(s => [String(s.ticker || s.id).toUpperCase(), s])),
    [securities]
  );

  const rows = useMemo(() => {
    const tickers = new Set(Object.keys(secByTicker));
    const classFromTx = {};
    for (const t of transactions) {
      const x = (t.ticker || '').toUpperCase();
      if (x && x !== 'VNĐ') { tickers.add(x); classFromTx[x] = t.assetClass; }
    }
    Object.keys(userPrices || {}).forEach(t => tickers.add(t));
    const holding = Object.fromEntries(portfolio.map(p => [p.ticker, p]));

    return Array.from(tickers).map(ticker => {
      const sec = secByTicker[ticker] || null;
      const feed = feeds[ticker] || FEEDS.AUTO;
      const quote = marketPrices[ticker] || {};
      const series = mergePriceSeries(seriesByTicker[ticker] || [], userPrices?.[ticker], feed);
      const last = series[series.length - 1];
      const prev = series[series.length - 2];
      const h = holding[ticker] || null;
      const price = quote.price || last?.value || null;
      const assetClass = sec?.assetClass || h?.assetClass || classFromTx[ticker] || null;
      return {
        ticker, feed, security: sec, name: sec?.name || '', assetClass,
        price, date: quote.date || last?.date || null,
        source: quote.source === 'user' ? 'giá của bạn' : quote.source || '',
        change: last && prev && prev.value > 0 ? last.value / prev.value - 1 : null,
        usd: assetClass === 'Tài sản mã hóa' && price && usdtVndRate > 0 ? vndToUSD(price, usdtVndRate) : null,
        qty: h?.qty || 0, value: h?.actualValue || 0, holding: h,
        missingPrice: (h?.qty || 0) > 0 && !quote.price,
        series,
      };
    });
  }, [secByTicker, feeds, transactions, userPrices, portfolio, marketPrices, seriesByTicker, usdtVndRate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === 'held' && r.qty <= 0) return false;
      if (filter === 'missing' && !r.missingPrice) return false;
      if (['AUTO', 'MANUAL', 'GENERIC-JSON'].includes(filter) && r.feed !== filter) return false;
      return !q || r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    });
  }, [rows, query, filter]);

  const missingCount = rows.filter(r => r.missingPrice).length;

  useEffect(() => {
    if (selected && rows.some(r => r.ticker === selected)) return;
    if (!rows.length) return;
    const pick = rows.find(r => r.missingPrice) || rows.reduce((best, r) => (r.value > best.value ? r : best), rows[0]);
    setSelected(pick.ticker);
  }, [rows, selected]);

  const updateQuotes = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await apiUpdateQuotes();
      const feedsRes = res?.jsonFeeds || { updated: [], errors: [] };
      const parts = [`Đã cập nhật ${res?.fetched ?? 0} giá tự động`];
      if (feedsRes.updated.length) parts.push(`${feedsRes.updated.length} nguồn JSON`);
      const errors = feedsRes.errors.map(e => `${e.ticker}: ${e.error}`);
      setStatus({ type: errors.length ? 'warn' : 'ok', text: parts.join(', ') + '.', details: errors });
      await recomputeAndSnapshot();
      reloadHistory();
    } catch (err) {
      setStatus({ type: 'error', text: `Lỗi cập nhật giá: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  const addSecurity = async (e) => {
    e.preventDefault();
    const ticker = (adding?.ticker || '').trim().toUpperCase();
    if (!ticker) return;
    try {
      await apiSaveSecurity(ticker, { name: adding.name, assetClass: adding.assetClass || null, feed: adding.feed });
      setAdding(null);
      setSelected(ticker);
      await refresh();
      setStatus({ type: 'ok', text: `Đã thêm ${ticker}.` });
    } catch (err) {
      setStatus({ type: 'error', text: `Không thêm được ${ticker}: ${err.message}` });
    }
  };

  const detail = rows.find(r => r.ticker === selected) || null;

  return (
    <>
      <PageHeader
        title="Tất cả chứng khoán"
        subtitle="All Securities · mã của riêng bạn: nguồn giá, lịch sử giá và giao dịch"
        actions={(
          <>
            <button type="button" className="pp-btn" onClick={() => setImportOpen(true)}><Upload size={15} /> Nhập giá CSV</button>
            <button type="button" className="pp-btn" onClick={() => setAdding(a => (a ? null : { ticker: '', name: '', assetClass: '', feed: FEEDS.MANUAL }))}>
              <Plus size={15} /> Thêm chứng khoán
            </button>
            <button type="button" className="pp-btn pp-btn--primary" onClick={updateQuotes} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} {busy ? 'Đang lấy giá…' : 'Cập nhật giá'}
            </button>
          </>
        )}
      />

      {status && (
        <div className={`pp-alert ${status.type === 'error' ? 'pp-alert--error' : status.type === 'ok' ? 'pp-alert--ok' : ''}`}>
          <div>
            {status.text}
            {status.details?.length > 0 && <ul className="pp-alert-list">{status.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
          </div>
        </div>
      )}

      {missingCount > 0 && !status && (
        <div className="pp-alert">
          <AlertTriangle size={16} />
          <span>{missingCount} mã đang nắm giữ chưa có giá thị trường nên đang được định giá bằng giá vốn. Chọn mã, chuyển nguồn giá sang “Nhập tay” hoặc “JSON” rồi nhập giá.</span>
        </div>
      )}

      {adding && (
        <form className="pp-inline-form" onSubmit={addSecurity}>
          <input className="pp-input" autoFocus placeholder="Mã (VD: NHAN9999)" value={adding.ticker}
            onChange={e => setAdding(a => ({ ...a, ticker: e.target.value }))} aria-label="Mã" />
          <input className="pp-input" placeholder="Tên (VD: Vàng nhẫn 9999)" value={adding.name}
            onChange={e => setAdding(a => ({ ...a, name: e.target.value }))} aria-label="Tên" />
          <select className="pp-select" value={adding.assetClass} onChange={e => setAdding(a => ({ ...a, assetClass: e.target.value }))} aria-label="Loại tài sản">
            <option value="">Loại tài sản…</option>
            {ASSET_CLASS_ORDER.map(c => <option key={c} value={c}>{assetClassLabel(c)}</option>)}
          </select>
          <select className="pp-select" value={adding.feed} onChange={e => setAdding(a => ({ ...a, feed: e.target.value }))} aria-label="Nguồn giá">
            {Object.values(FEEDS).map(f => <option key={f} value={f}>Nguồn: {FEED_LABELS[f]}</option>)}
          </select>
          <button type="submit" className="pp-btn pp-btn--primary">Thêm</button>
          <button type="button" className="pp-icon-btn" onClick={() => setAdding(null)} aria-label="Hủy"><X size={16} /></button>
        </form>
      )}

      <div className="pp-split pp-split--wide">
        <Card padded={false} className="pp-split-list" title={`${filtered.length} mã`}
          actions={(
            <div className="pp-row-actions">
              <select className="pp-select pp-select--sm" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Lọc">
                {FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <div className="pp-search"><Search size={14} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã, tên…" aria-label="Tìm" /></div>
            </div>
          )}>
          <DataTable
            rows={filtered}
            rowKey={r => r.ticker}
            selectedKey={selected}
            onRowClick={r => setSelected(r.ticker)}
            footer={false}
            maxHeight={640}
            defaultSort={{ key: 'value', dir: 'desc' }}
            emptyText="Chưa có chứng khoán. Thêm mã mới hoặc ghi nhận giao dịch mua."
            columns={[
              { key: 'ticker', label: 'Mã', render: r => (
                <>
                  <div className="pp-strong">{r.ticker} {r.missingPrice && <Badge tone="red" title="Chưa có giá, đang dùng giá vốn">thiếu giá</Badge>}</div>
                  <div className="pp-meta">{r.name || (r.assetClass ? assetClassLabel(r.assetClass) : '—')}</div>
                </>
              ) },
              { key: 'feed', label: 'Nguồn', render: r => <FeedBadge feed={r.feed} /> },
              { key: 'price', label: 'Giá (VNĐ)', align: 'right', render: r => (r.price
                ? <>{fmtPrice(r.price)}<div className="pp-meta">{[r.date ? formatISO(r.date) : null, r.usd !== null ? `≈ ${formatUSD(r.usd)}` : null].filter(Boolean).join(' · ')}</div></>
                : <span className="pp-muted">—</span>) },
              { key: 'change', label: '± phiên', align: 'right', sortValue: r => (r.change === null ? -Infinity : r.change),
                render: r => <span className={toneOf(r.change || 0)}>{fmtPct(r.change)}</span> },
              { key: 'value', label: 'Đang giữ', align: 'right', render: r => (r.value > 0 ? fmtVND(r.value) : '') },
            ]}
          />
        </Card>

        <div className="pp-split-detail">
          {detail ? (
            <SecurityDetail
              key={detail.ticker}
              row={detail}
              histLoading={histLoading}
              transactions={transactions}
              userPrices={userPrices?.[detail.ticker] || {}}
              onChanged={async (message) => { await refresh(); if (message) setStatus({ type: 'ok', text: message }); }}
              onDeleted={async (message) => { setSelected(null); await refresh(); setStatus({ type: 'ok', text: message }); }}
              onError={(message) => setStatus({ type: 'error', text: message })}
            />
          ) : <Card><Empty title="Chọn một mã" hint="Bấm vào một dòng để xem giá, nguồn giá và giao dịch." /></Card>}
        </div>
      </div>

      <ImportCSVModal
        mode="prices"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        tickers={rows.map(r => r.ticker)}
        defaultTicker={selected || ''}
        onDone={async (res) => { await refresh(); setStatus({ type: 'ok', text: `Đã nhập ${res?.imported ?? 0} giá.` }); }}
      />
    </>
  );
}

function SecurityDetail({ row, histLoading, transactions, userPrices, onChanged, onDeleted, onError }) {
  const [tab, setTab] = useState(row.missingPrice ? 'feed' : 'prices');
  const h = row.holding;
  const txs = useMemo(() => transactions
    .filter(t => (t.ticker || '').toUpperCase() === row.ticker)
    .sort((a, b) => parseVNDate(b.date) - parseVNDate(a.date)), [transactions, row.ticker]);

  return (
    <>
      <div className="pp-kpi-grid pp-kpi-grid--3">
        <Kpi label={`${row.ticker} · giá hiện tại`} value={row.price ? fmtPrice(row.price) : '—'} tone="neutral"
          sub={row.date ? `${formatISO(row.date)}${row.source ? ` · ${row.source}` : ''}` : 'Chưa có giá'} />
        <Kpi label="Đang nắm giữ" value={h ? formatQty(h.qty, h.assetClass) : '0'} tone="neutral"
          sub={h ? `Giá vốn BQ ${fmtPrice(h.avgCost)}` : 'Không nắm giữ'} />
        <Kpi label="Lãi/lỗ chưa thực hiện" value={h && !row.missingPrice ? fmtSignedVND(h.pnl) : '—'} raw={h && !row.missingPrice ? h.pnl : null}
          sub={row.missingPrice ? 'Cần giá thị trường để tính' : h && h.totalCost > 0 ? `${fmtPct(h.pnl / h.totalCost)} · giá trị ${fmtVND(h.actualValue)}` : null} />
      </div>
      <Tabs
        tabs={[{ key: 'prices', label: 'Lịch sử giá' }, { key: 'feed', label: 'Nguồn giá' }, { key: 'transactions', label: `Giao dịch (${txs.length})` }]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'prices' && <PricesTab row={row} histLoading={histLoading} userPrices={userPrices} onChanged={onChanged} onError={onError} />}
      {tab === 'feed' && <FeedTab row={row} onChanged={onChanged} onDeleted={onDeleted} onError={onError} />}
      {tab === 'transactions' && (
        <Card padded={false}>
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
              { key: 'storage', label: 'Nơi lưu ký', render: r => r.storage || '—' },
            ]}
          />
        </Card>
      )}
    </>
  );
}

function PricesTab({ row, histLoading, userPrices, onChanged, onError }) {
  const [date, setDate] = useState(todayISO());
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const ownRows = useMemo(
    () => Object.entries(userPrices).map(([d, v]) => ({ date: d, price: v })).sort((a, b) => b.date.localeCompare(a.date)),
    [userPrices]
  );
  const datasets = row.series.length > 1
    ? [{ label: `${row.ticker} (VNĐ)`, color: '#2563eb', fill: true, data: row.series.map(p => ({ x: p.date, y: p.value })) }]
    : [];

  const addPrice = async (e) => {
    e.preventDefault();
    const value = parseInputNumber(price);
    if (!date || !(value > 0)) { onError('Giá không hợp lệ'); return; }
    setSaving(true);
    try {
      await apiSaveSecurityPrices(row.ticker, [{ date, close: value }]);
      setPrice('');
      await onChanged(`Đã lưu giá ${row.ticker} ngày ${formatISO(date)}.`);
    } catch (err) {
      onError(`Không lưu được giá: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const removePrice = async (d) => {
    try {
      await apiDeleteSecurityPrice(row.ticker, d);
      await onChanged();
    } catch (err) {
      onError(`Không xóa được giá: ${err.message}`);
    }
  };

  const switchToManual = async () => {
    try {
      await apiSaveSecurity(row.ticker, {
        name: row.security?.name || '', assetClass: row.security?.assetClass || row.assetClass || null,
        feed: FEEDS.MANUAL, note: row.security?.note || '',
      });
      await onChanged(`${row.ticker} chuyển sang nguồn giá Nhập tay.`);
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <>
      <Card title="Biểu đồ giá" subtitle="Giá hệ thống kết hợp giá của bạn theo quy tắc của nguồn giá">
        {histLoading && !datasets.length
          ? <div className="pp-loading-inline"><Loader2 size={16} className="spin" /> Đang tải…</div>
          : datasets.length ? <LineChart datasets={datasets} height={240} /> : <Empty title="Chưa đủ dữ liệu giá để vẽ biểu đồ" />}
      </Card>

      <Card title="Giá của bạn" subtitle={`${ownRows.length} giá đã nhập hoặc import`} padded={false}>
        <form className="pp-inline-form pp-inline-form--flush" onSubmit={addPrice}>
          <input type="date" className="pp-input" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} aria-label="Ngày" required />
          <input className="pp-input" inputMode="decimal" placeholder="Giá (VNĐ)" value={price} onChange={e => setPrice(e.target.value)} aria-label="Giá" required />
          <button type="submit" className="pp-btn pp-btn--primary" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Lưu giá</button>
        </form>
        {row.feed === FEEDS.AUTO && (
          <div className="pp-table-note">
            Mã đang dùng nguồn <strong>Tự động</strong>: giá bạn nhập chỉ được dùng cho ngày hệ thống không có giá.{' '}
            <button type="button" className="pp-link" onClick={switchToManual}>Chuyển sang Nhập tay</button>
          </div>
        )}
        <DataTable
          rows={ownRows}
          rowKey={r => r.date}
          footer={false}
          maxHeight={320}
          emptyText="Chưa có giá nào. Nhập giá ở trên hoặc dùng “Nhập giá CSV”."
          columns={[
            { key: 'date', label: 'Ngày', render: r => formatISO(r.date) },
            { key: 'price', label: 'Giá', align: 'right', render: r => fmtPrice(r.price) },
            { key: 'actions', label: '', sortable: false, align: 'right', render: r => (
              <button type="button" className="btn-icon btn-icon-danger" title="Xóa giá" onClick={() => removePrice(r.date)}><Trash2 size={14} /></button>
            ) },
          ]}
        />
      </Card>
    </>
  );
}

function FeedTab({ row, onChanged, onDeleted, onError }) {
  const sec = row.security || {};
  const props = sec.feedProperties || {};
  const [form, setForm] = useState({
    name: sec.name || '',
    assetClass: sec.assetClass || row.assetClass || '',
    feed: row.feed,
    feedURL: sec.feedURL || '',
    closePath: props.closePath || '',
    datePath: props.datePath || '',
    factor: props.factor ?? 1,
    numberFormat: props.numberFormat || 'auto',
    note: sec.note || '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState(null);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const feedProperties = () => ({
    closePath: form.closePath.trim(), datePath: form.datePath.trim() || null,
    factor: Number(form.factor) > 0 ? Number(form.factor) : 1, numberFormat: form.numberFormat,
  });

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest({ ok: true, ...(await apiTestQuoteFeed(form.feedURL.trim(), feedProperties())) });
    } catch (err) {
      setTest({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiSaveSecurity(row.ticker, {
        name: form.name.trim(), assetClass: form.assetClass || null, feed: form.feed,
        feedURL: form.feed === FEEDS.JSON ? form.feedURL.trim() : '',
        feedProperties: form.feed === FEEDS.JSON ? feedProperties() : null,
        note: form.note,
      });
      await onChanged(`Đã lưu cấu hình ${row.ticker}.`);
    } catch (err) {
      onError(`Không lưu được: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Xóa ${row.ticker} khỏi danh sách và xóa toàn bộ giá bạn đã nhập cho mã này? Giao dịch không bị ảnh hưởng.`)) return;
    try {
      await apiDeleteSecurity(row.ticker);
      await onDeleted(`Đã xóa ${row.ticker} và lịch sử giá riêng.`);
    } catch (err) {
      onError(err.message);
    }
  };

  return (
    <Card title="Cấu hình nguồn giá" subtitle="Quote feed — mỗi mã chọn một cách lấy giá">
      <form onSubmit={save} className="pp-form">
        <div className="pp-feed-options" role="radiogroup" aria-label="Nguồn giá">
          {Object.values(FEEDS).map(f => (
            <label key={f} className={`pp-feed-option ${form.feed === f ? 'is-active' : ''}`}>
              <input type="radio" name="feed" value={f} checked={form.feed === f} onChange={set('feed')} />
              <span className="pp-feed-option-title">{FEED_LABELS[f]}</span>
              <span className="pp-feed-option-hint">{FEED_HINTS[f]}</span>
            </label>
          ))}
        </div>

        <div className="form-row-2">
          <div className="form-group">
            <label className="form-label">Tên</label>
            <input className="form-input" value={form.name} onChange={set('name')} placeholder="VD: Vàng nhẫn 9999" />
          </div>
          <div className="form-group">
            <label className="form-label">Loại tài sản</label>
            <select className="form-select" value={form.assetClass} onChange={set('assetClass')}>
              <option value="">—</option>
              {ASSET_CLASS_ORDER.map(c => <option key={c} value={c}>{assetClassLabel(c)}</option>)}
            </select>
          </div>
        </div>

        {form.feed === FEEDS.JSON && (
          <div className="pp-json-feed">
            <div className="form-group">
              <label className="form-label">URL trả về JSON</label>
              <input className="form-input pp-mono" value={form.feedURL} onChange={set('feedURL')} placeholder="https://www.vang.today/api/prices?type=SJL1L10" required />
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">JSONPath của giá</label>
                <input className="form-input pp-mono" value={form.closePath} onChange={set('closePath')} placeholder="$.sell" required />
              </div>
              <div className="form-group">
                <label className="form-label">JSONPath của ngày <span className="form-label-hint">(không bắt buộc)</span></label>
                <input className="form-input pp-mono" value={form.datePath} onChange={set('datePath')} placeholder="$.date" />
              </div>
            </div>
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Hệ số nhân</label>
                <input className="form-input" type="number" step="any" min="0" value={form.factor} onChange={set('factor')} />
                <p className="pp-field-hint">VD: 0,1 để đổi giá mỗi lượng thành giá mỗi chỉ; 1000 nếu nguồn tính theo nghìn đồng.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Định dạng số trong JSON</label>
                <select className="form-select" value={form.numberFormat} onChange={set('numberFormat')}>
                  <option value="auto">Tự nhận dạng</option>
                  <option value="vi">1.234.567,89</option>
                  <option value="en">1,234,567.89</option>
                </select>
              </div>
            </div>
            <p className="pp-field-hint">
              Hỗ trợ JSONPath: <code>$.a.b</code>, <code>$.list[0]</code>, <code>$.list[*].price</code>, <code>$..price</code>,
              bộ lọc <code>$.data[?(@.type=='SJC')].sell</code>. Chỉ URL công khai http/https, không theo chuyển hướng, tối đa 1 MB.
            </p>
            <button type="button" className="pp-btn" onClick={runTest} disabled={testing || !form.feedURL.trim() || !form.closePath.trim()}>
              {testing ? <Loader2 size={15} className="spin" /> : <FlaskConical size={15} />} Thử nguồn
            </button>
            {test && (test.ok ? (
              <div className="pp-feed-test pp-feed-test--ok">
                <div><strong>Đọc được {test.count} giá.</strong> Mới nhất: {test.latest ? `${fmtPrice(test.latest.price)} ngày ${formatISO(test.latest.date)}` : '—'}</div>
                {test.excerpt && <pre className="pp-code">{test.excerpt}</pre>}
              </div>
            ) : (
              <div className="pp-feed-test pp-feed-test--error">{test.error}</div>
            ))}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Ghi chú</label>
          <input className="form-input" value={form.note} onChange={set('note')} placeholder="VD: giá bán ra PNJ, cập nhật mỗi tuần" />
        </div>

        <div className="pp-form-actions">
          {row.security && (
            <button type="button" className="pp-btn pp-btn--danger" onClick={remove}><Trash2 size={15} /> Xóa mã & lịch sử giá</button>
          )}
          <button type="submit" className="pp-btn pp-btn--primary" disabled={saving}>{saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Lưu</button>
        </div>
      </form>
    </Card>
  );
}
