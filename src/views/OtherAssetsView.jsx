import React from 'react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { Card, Kpi, PageHeader } from '../components/ui';
import NetWorthExternalManager from '../components/NetWorthExternalManager.jsx';
import LiabilitiesManager from '../components/LiabilitiesManager.jsx';
import AssetChart from '../components/charts/AssetChart.jsx';
import { fmtPctPlain, formatVND } from '../utils/formatters.js';

const NET_WORTH_LINES = [
  { key: 'netWorth', label: 'Tài sản ròng', color: '#10b981', fill: true, on: true },
  { key: 'totalAssets', label: 'Tổng tài sản', color: '#2563eb', fill: false, on: true },
  { key: 'totalLiabilities', label: 'Tổng nợ', color: '#f43f5e', fill: false, on: true },
];

/** Net worth beyond the investment portfolio: external assets and liabilities. */
export default function OtherAssetsView() {
  const { netWorth, externalAssets, liabilities, refresh } = usePortfolioData();
  const total = netWorth.totalAssets + netWorth.totalLiabilities;
  const assetPct = total > 0 ? netWorth.totalAssets / total : 1;
  const debtRatio = netWorth.totalAssets > 0 ? netWorth.totalLiabilities / netWorth.totalAssets : 0;

  return (
    <>
      <PageHeader title="Tài sản khác & Nợ" subtitle="Tài sản ngoài danh mục (tiết kiệm, bất động sản…) và các khoản nợ — dùng để tính tài sản ròng" />
      <div className="pp-kpi-grid">
        <Kpi label="Tổng tài sản" value={formatVND(netWorth.totalAssets)} tone="neutral"
          sub={`Thanh khoản ${formatVND(netWorth.totalLiquid)} · Đầu tư ${formatVND(netWorth.totalInvest)}`} />
        <Kpi label="Tổng nợ" value={formatVND(netWorth.totalLiabilities)} tone={netWorth.totalLiabilities > 0 ? 'down' : 'neutral'} />
        <Kpi label="Tài sản ròng" value={formatVND(netWorth.totalNetWorth)} tone="neutral" />
        <Kpi label="Tỷ lệ nợ / tài sản" value={fmtPctPlain(debtRatio)} tone={debtRatio > 0.5 ? 'down' : 'neutral'} />
      </div>

      <Card title="Tài sản vs Nợ">
        <div className="assets-debt-bar">
          <div className="assets-debt-bar-asset" style={{ width: `${assetPct * 100}%` }}>
            <span>Tài sản {(assetPct * 100).toFixed(1)}%</span>
          </div>
          {netWorth.totalLiabilities > 0 && (
            <div className="assets-debt-bar-debt" style={{ width: `${(1 - assetPct) * 100}%` }}>
              <span>Nợ {((1 - assetPct) * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </Card>

      <div className="pp-grid-2">
        <Card><NetWorthExternalManager externalAssets={externalAssets} onUpdate={refresh} /></Card>
        <Card><LiabilitiesManager liabilities={liabilities} onUpdate={refresh} /></Card>
      </div>

      <Card title="Tài sản ròng theo thời gian">
        <AssetChart height={300} lines={NET_WORTH_LINES} />
      </Card>
    </>
  );
}
