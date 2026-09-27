import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../contexts/ReportingPeriodContext.jsx';
import { Card, Kpi, Tabs, DataTable, PageHeader, Badge, Empty } from '../components/ui';
import AssetChart from '../components/charts/AssetChart.jsx';
import AssetAllocationChart from '../components/AssetAllocationChart.jsx';
import StackedAreaChart from '../components/charts/StackedAreaChart.jsx';
import { ASSET_CLASS_ORDER, assetClassLabel, allocationByAssetClass, allocationBySecurity } from '../utils/assetClasses.js';
import { fmtVND, fmtPrice, fmtPct, fmtPctPlain, fmtSignedVND, toneOf, formatQty, formatUSD, vndToUSD, formatVND } from '../utils/formatters.js';
import { formatISO } from '../utils/dates.js';

const TABS = [
  { key: 'holdings', label: 'Danh mục nắm giữ' },
  { key: 'chart', label: 'Biểu đồ tài sản' },
  { key: 'allocation', label: 'Phân bổ' },
];

export default function StatementOfAssetsView({ sub }) {
  const active = TABS.some(t => t.key === sub) ? sub : 'holdings';
  return (
    <>
      <PageHeader title="Bảng kê tài sản" subtitle="Statement of Assets — toàn bộ vị thế đang nắm giữ, định giá theo giá thị trường mới nhất" />
      <Tabs tabs={TABS} active={active} base="/reports/assets" />
      {active === 'holdings' && <HoldingsTab />}
      {active === 'chart' && <ChartTab />}
      {active === 'allocation' && <AllocationTab />}
    </>
  );
}

function HoldingsTab() {
  const { portfolio, pnlSummary, marketPrices, usdtVndRate } = usePortfolioData();
  const [query, setQuery] = useState('');

  const total = useMemo(() => portfolio.reduce((s, p) => s + p.actualValue, 0), [portfolio]);

  const rows = useMemo(() => portfolio.map(p => {
    const isCash = p.ticker === 'VNĐ';
    const quote = marketPrices[p.ticker];
    const hasQuote = isCash || !!(quote && quote.price);
    return {
      key: p.ticker,
      ticker: p.ticker,
      name: isCash ? 'Tiền mặt VNĐ' : p.ticker,
      assetClass: p.assetClass,
      storage: p.storage,
      qty: isCash ? null : p.qty,
      price: isCash ? null : p.marketPrice,
      priceDate: quote?.date || null,
      hasQuote,
      value: p.actualValue,
      weight: total > 0 ? p.actualValue / total : 0,
      cost: isCash ? p.actualValue : p.totalCost,
      pnl: isCash ? null : p.pnl,
      pnlPct: isCash ? null : (p.totalCost > 0 ? p.pnl / p.totalCost : 0),
      usd: p.assetClass === 'Tài sản mã hóa' && usdtVndRate > 0 ? vndToUSD(p.actualValue, usdtVndRate) : null,
    };
  }), [portfolio, total, marketPrices, usdtVndRate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q) || (r.storage || '').toLowerCase().includes(q) || assetClassLabel(r.assetClass).toLowerCase().includes(q));
  }, [rows, query]);

  const cash = rows.find(r => r.ticker === 'VNĐ')?.value || 0;
  const unrealized = rows.reduce((s, r) => s + (r.pnl || 0), 0);
  const sum = (key) => (list) => list.reduce((s, r) => s + (r[key] || 0), 0);

  const columns = [
    { key: 'name', label: 'Tài sản', render: r => (
      <>
        <div className="pp-strong">{r.name} {!r.hasQuote && <Badge tone="orange" title="Chưa có giá thị trường — đang định giá theo giá vốn">giá vốn</Badge>}</div>
        <div className="pp-meta">{r.storage || '—'}</div>
      </>
    ), footer: () => <strong>Tổng cộng</strong> },
    { key: 'qty', label: 'Số lượng', align: 'right', render: r => (r.qty === null ? '' : formatQty(r.qty, r.assetClass)) },
    { key: 'price', label: 'Giá', align: 'right', render: r => (r.price === null ? '' : fmtPrice(r.price)), cellTitle: r => (r.priceDate ? `Ngày giá: ${formatISO(r.priceDate)}` : '') },
    { key: 'value', label: 'Giá trị thị trường', align: 'right', render: r => (
      <>{fmtVND(r.value)}{r.usd !== null && <div className="pp-meta">≈ {formatUSD(r.usd)}</div>}</>
    ), footer: list => <strong>{fmtVND(sum('value')(list))}</strong> },
    { key: 'weight', label: 'Tỷ trọng', align: 'right', render: r => fmtPctPlain(r.weight), footer: list => fmtPctPlain(sum('weight')(list)) },
    { key: 'cost', label: 'Giá trị mua', align: 'right', render: r => fmtVND(r.cost), footer: list => fmtVND(sum('cost')(list)) },
    { key: 'pnl', label: 'Lãi/lỗ', align: 'right', render: r => (r.pnl === null ? '' : <span className={toneOf(r.pnl)}>{fmtSignedVND(r.pnl)}</span>),
      footer: list => { if (list.every(r => r.pnl === null)) return ''; const v = sum('pnl')(list); return <span className={toneOf(v)}>{fmtSignedVND(v)}</span>; } },
    { key: 'pnlPct', label: '%', align: 'right', render: r => (r.pnlPct === null ? '' : <span className={toneOf(r.pnlPct)}>{fmtPct(r.pnlPct)}</span>),
      footer: list => {
        const sec = list.filter(r => r.pnl !== null);
        const cost = sec.reduce((s, r) => s + r.cost, 0);
        if (!sec.length || cost <= 0) return '';
        const v = sec.reduce((s, r) => s + r.pnl, 0) / cost;
        return <span className={toneOf(v)}>{fmtPct(v)}</span>;
      } },
  ];

  return (
    <>
      <div className="pp-kpi-grid">
        <Kpi label="Tổng giá trị danh mục" value={formatVND(total)} tone="neutral" />
        <Kpi label="Chứng khoán & tài sản" value={formatVND(total - cash)} tone="neutral" sub={total > 0 ? `${fmtPctPlain((total - cash) / total)} danh mục` : null} />
        <Kpi label="Lãi/lỗ chưa thực hiện" value={fmtSignedVND(unrealized)} raw={unrealized} />
        <Kpi label="Tổng lãi/lỗ (so với vốn ròng)" value={fmtSignedVND(pnlSummary.totalPnL)} raw={pnlSummary.totalPnL} sub={`Vốn ròng ${formatVND(pnlSummary.totalCost)}`} />
      </div>
      <Card padded={false} title={`Vị thế (${rows.filter(r => r.ticker !== 'VNĐ').length} mã)`}
        actions={(
          <div className="pp-search">
            <Search size={14} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mã, nơi lưu ký…" aria-label="Tìm" />
          </div>
        )}>
        <DataTable
          rows={filtered}
          rowKey={r => r.key}
          columns={columns}
          defaultSort={{ key: 'value', dir: 'desc' }}
          groupBy={r => r.assetClass}
          groupOrder={ASSET_CLASS_ORDER}
          groupLabel={cls => assetClassLabel(cls)}
          emptyText="Không có vị thế nào"
        />
      </Card>
    </>
  );
}

function ChartTab() {
  return (
    <Card title="Giá trị tài sản theo thời gian" subtitle="Từ snapshot hằng ngày trong kỳ báo cáo. Bật/tắt từng đường để so sánh.">
      <AssetChart height={340} />
    </Card>
  );
}

function AllocationTab() {
  const { portfolio, snapshots } = usePortfolioData();
  const { range } = useReportingPeriod();
  const byClass = useMemo(() => allocationByAssetClass(portfolio), [portfolio]);
  const bySecurity = useMemo(() => allocationBySecurity(portfolio, 9), [portfolio]);
  const periodSnapshots = useMemo(() => snapshots.filter(s => s.date >= range.start && s.date <= range.end), [snapshots, range]);

  return (
    <>
      <div className="pp-grid-2">
        <Card title="Theo loại tài sản">
          {byClass.length ? <AssetAllocationChart data={byClass} size={220} /> : <Empty />}
        </Card>
        <Card title="Theo từng mã (10 lớn nhất)">
          {bySecurity.length ? <AssetAllocationChart data={bySecurity} size={220} /> : <Empty />}
        </Card>
      </div>
      <Card title="Phân bổ theo thời gian (%)" subtitle="Tỷ trọng từng loại tài sản trong kỳ báo cáo">
        <StackedAreaChart snapshots={periodSnapshots} height={300} />
      </Card>
    </>
  );
}
