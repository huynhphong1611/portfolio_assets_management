import React, { useMemo } from 'react';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { Card, Tabs, PageHeader, DataTable, Badge, Empty } from '../../components/ui';
import AssetAllocationChart from '../../components/AssetAllocationChart.jsx';
import StackedAreaChart from '../../components/charts/StackedAreaChart.jsx';
import RebalanceSettings from '../../components/RebalanceSettings.jsx';
import { ASSET_CLASS_ORDER, assetClassLabel, assetClassColor, assetClassGroup, allocationByAssetClass } from '../../utils/assetClasses.js';
import { fmtVND, fmtPct, fmtPctPlain, fmtSignedVND, toneOf } from '../../utils/formatters.js';

const TABS = [
  { key: 'definition', label: 'Định nghĩa' },
  { key: 'pie', label: 'Biểu đồ tròn' },
  { key: 'history', label: 'Theo thời gian' },
  { key: 'rebalance', label: 'Tái cân bằng' },
];

/** PP → Taxonomies → Asset Classes */
export default function AssetClassesView({ sub }) {
  const active = TABS.some(t => t.key === sub) ? sub : 'definition';
  return (
    <>
      <PageHeader title="Phân loại: Loại tài sản" subtitle="Taxonomy · Asset Classes — cấu trúc danh mục, tỷ trọng mục tiêu và tái cân bằng" />
      <Tabs tabs={TABS} active={active} base="/taxonomies/asset-classes" />
      {active === 'definition' && <DefinitionTab />}
      {active === 'pie' && <PieTab />}
      {active === 'history' && <HistoryTab />}
      {active === 'rebalance' && <RebalanceTab />}
    </>
  );
}

function DefinitionTab() {
  const { portfolio, rebalanceTargets } = usePortfolioData();
  const total = portfolio.reduce((s, p) => s + p.actualValue, 0);
  const classTotals = useMemo(() => {
    const m = {};
    for (const p of portfolio) m[p.assetClass] = (m[p.assetClass] || 0) + p.actualValue;
    return m;
  }, [portfolio]);

  const rows = portfolio.filter(p => p.actualValue > 0).map(p => ({
    key: p.ticker,
    name: p.ticker === 'VNĐ' ? 'Tiền mặt VNĐ' : p.ticker,
    assetClass: p.assetClass,
    value: p.actualValue,
    weight: total > 0 ? p.actualValue / total : 0,
    weightInClass: classTotals[p.assetClass] > 0 ? p.actualValue / classTotals[p.assetClass] : 0,
  }));

  return (
    <Card padded={false}>
      <DataTable
        rows={rows}
        rowKey={r => r.key}
        defaultSort={{ key: 'value', dir: 'desc' }}
        groupBy={r => r.assetClass}
        groupOrder={ASSET_CLASS_ORDER}
        groupLabel={(cls, list) => {
          const v = list.reduce((s, r) => s + r.value, 0);
          const target = parseFloat(rebalanceTargets[cls]);
          return (
            <span className="pp-group-label">
              <span className="pp-dot" style={{ background: assetClassColor(cls) }} />
              {assetClassLabel(cls)}
              <span className="pp-meta">· {assetClassGroup(cls)} · {fmtPctPlain(total > 0 ? v / total : 0)}{Number.isFinite(target) ? ` (mục tiêu ${target}%)` : ''}</span>
            </span>
          );
        }}
        columns={[
          { key: 'name', label: 'Tài sản', render: r => <span className="pp-strong">{r.name}</span>, footer: () => <strong>Tổng</strong> },
          { key: 'value', label: 'Giá trị', align: 'right', render: r => fmtVND(r.value), footer: l => fmtVND(l.reduce((s, r) => s + r.value, 0)) },
          { key: 'weight', label: '% danh mục', align: 'right', render: r => fmtPctPlain(r.weight, 2), footer: l => fmtPctPlain(l.reduce((s, r) => s + r.weight, 0), 2) },
          { key: 'weightInClass', label: '% trong nhóm', align: 'right', render: r => fmtPctPlain(r.weightInClass) },
        ]}
      />
    </Card>
  );
}

function PieTab() {
  const { portfolio, netWorth } = usePortfolioData();
  const byClass = useMemo(() => allocationByAssetClass(portfolio), [portfolio]);
  const byGroup = [
    { label: 'Thanh khoản', value: netWorth.totalLiquid, color: '#0ea5e9' },
    { label: 'Đầu tư', value: netWorth.totalInvest, color: '#8b5cf6' },
  ].filter(x => x.value > 0);
  return (
    <div className="pp-grid-2">
      <Card title="Danh mục theo loại tài sản">{byClass.length ? <AssetAllocationChart data={byClass} size={240} /> : <Empty />}</Card>
      <Card title="Thanh khoản vs Đầu tư" subtitle="Toàn bộ tài sản, gồm cả tài sản ngoài danh mục">{byGroup.length ? <AssetAllocationChart data={byGroup} size={240} /> : <Empty />}</Card>
    </div>
  );
}

function HistoryTab() {
  const { snapshots } = usePortfolioData();
  const { range } = useReportingPeriod();
  const periodSnapshots = useMemo(() => snapshots.filter(s => s.date >= range.start && s.date <= range.end), [snapshots, range]);
  return (
    <Card title="Tỷ trọng theo thời gian (%)" subtitle="Biểu đồ vùng xếp chồng 100% trong kỳ báo cáo">
      <StackedAreaChart snapshots={periodSnapshots} height={340} />
    </Card>
  );
}

function RebalanceTab() {
  const { rebalanceData, rebalanceTargets, setRebalanceTargets, refresh } = usePortfolioData();
  const total = rebalanceData.reduce((s, r) => s + r.actualValue, 0);
  const targetSum = Object.values(rebalanceTargets || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const rows = rebalanceData.map(r => {
    const targetValue = total * (r.targetWeight / 100);
    return { ...r, targetValue, amount: targetValue - r.actualValue };
  });

  return (
    <>
      <Card
        title="Tái cân bằng"
        subtitle={targetSum > 0 ? `Tổng tỷ trọng mục tiêu: ${targetSum.toFixed(1)}% · ngưỡng giữ nguyên ±2%` : 'Chưa đặt tỷ trọng mục tiêu'}
        actions={<RebalanceSettings currentTargets={rebalanceTargets} onSave={setRebalanceTargets} onUpdate={refresh} />}
        padded={false}
      >
        <DataTable
          rows={rows}
          rowKey={r => r.assetClass}
          defaultSort={{ key: 'actualValue', dir: 'desc' }}
          columns={[
            { key: 'label', label: 'Loại tài sản', render: r => (
              <span className="pp-group-label"><span className="pp-dot" style={{ background: assetClassColor(r.assetClass) }} />{assetClassLabel(r.assetClass)}</span>
            ), footer: () => <strong>Tổng</strong> },
            { key: 'targetWeight', label: 'Mục tiêu', align: 'right', render: r => `${r.targetWeight.toFixed(1)}%`, footer: l => `${l.reduce((s, r) => s + r.targetWeight, 0).toFixed(1)}%` },
            { key: 'actualWeight', label: 'Thực tế', align: 'right', render: r => `${r.actualWeight.toFixed(1)}%` },
            { key: 'bar', label: '', sortable: false, width: 160, render: r => (
              <div className="pp-rebal-bar" title={`Thực tế ${r.actualWeight.toFixed(1)}% · mục tiêu ${r.targetWeight.toFixed(1)}%`}>
                <div className={`pp-rebal-fill pp-rebal-fill--${r.action.type}`} style={{ width: `${Math.min(r.actualWeight, 100)}%` }} />
                <div className="pp-rebal-target" style={{ left: `${Math.min(r.targetWeight, 100)}%` }} />
              </div>
            ) },
            { key: 'variance', label: 'Chênh lệch', align: 'right', render: r => <span className={Math.abs(r.variance) > 2 ? 'pp-down' : 'pp-flat'}>{fmtPct(r.variance / 100)}</span> },
            { key: 'targetValue', label: 'Giá trị mục tiêu', align: 'right', render: r => fmtVND(r.targetValue) },
            { key: 'actualValue', label: 'Giá trị thực tế', align: 'right', render: r => fmtVND(r.actualValue), footer: l => fmtVND(l.reduce((s, r) => s + r.actualValue, 0)) },
            { key: 'amount', label: 'Cần mua (+) / bán (−)', align: 'right', render: r => <span className={toneOf(r.amount)}>{fmtSignedVND(r.amount)}</span> },
            { key: 'action', label: 'Khuyến nghị', sortValue: r => r.action.type, render: r => (
              <Badge tone={r.action.type === 'buy' ? 'green' : r.action.type === 'sell' ? 'red' : 'gray'}>{r.action.text}</Badge>
            ) },
          ]}
        />
      </Card>
    </>
  );
}
