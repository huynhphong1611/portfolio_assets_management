import React, { useMemo } from 'react';
import { PlusCircle, Upload } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useReportingPeriod } from '../contexts/ReportingPeriodContext.jsx';
import { usePeriodReport } from '../hooks/usePeriodReport.js';
import { Card, Kpi, Empty, DataTable, PageHeader, TxTypeBadge } from '../components/ui';
import PerformanceChart from '../components/charts/PerformanceChart.jsx';
import HeatmapWidget from '../components/widgets/HeatmapWidget.jsx';
import AssetAllocationChart from '../components/AssetAllocationChart.jsx';
import { Link } from '../router/useHashRoute.jsx';
import { allocationByAssetClass } from '../utils/assetClasses.js';
import { fmtPct, fmtPctPlain, fmtSignedVND, fmtVND, fmtDuration, toneOf, formatVND } from '../utils/formatters.js';
import { formatISO, toISO, parseVNDate } from '../utils/dates.js';

export default function DashboardView() {
  const { portfolio, netWorth, pnlSummary, transactions, openTransactionModal } = usePortfolioData();
  const { label } = useReportingPeriod();
  const report = usePeriodReport('portfolioValue');

  const allocation = useMemo(() => allocationByAssetClass(portfolio), [portfolio]);
  const cash = useMemo(() => portfolio.find(p => p.ticker === 'VNĐ')?.actualValue || 0, [portfolio]);

  const topHoldings = useMemo(() => {
    const total = portfolio.reduce((s, p) => s + p.actualValue, 0);
    return portfolio
      .filter(p => p.ticker !== 'VNĐ' && p.actualValue > 0)
      .sort((a, b) => b.actualValue - a.actualValue)
      .slice(0, 8)
      .map(p => ({ ...p, weight: total > 0 ? p.actualValue / total : 0 }));
  }, [portfolio]);

  const recent = useMemo(() => (
    [...transactions].sort((a, b) => parseVNDate(b.date) - parseVNDate(a.date)).slice(0, 8)
  ), [transactions]);

  const recentYears = useMemo(() => {
    const years = Array.from(report.yearlyReturns.keys()).sort().reverse();
    return years.slice(0, 3);
  }, [report.yearlyReturns]);

  if (!transactions.length) {
    return (
      <>
        <PageHeader title="Tổng quan" subtitle="Bảng điều khiển danh mục đầu tư" />
        <Card>
          <Empty
            title="Chưa có giao dịch nào"
            hint="Bắt đầu bằng việc ghi nhận khoản nạp tiền đầu tiên, sau đó ghi các lệnh mua/bán. Mọi báo cáo hiệu suất (TTWROR, IRR, drawdown…) sẽ được tính tự động."
            action={(
              <div className="pp-row-actions">
                <button type="button" className="pp-btn pp-btn--primary" onClick={() => openTransactionModal()}><PlusCircle size={15} /> Ghi nhận giao dịch</button>
                <Link to="/settings" className="pp-btn"><Upload size={15} /> Nhập dữ liệu</Link>
              </div>
            )}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tổng quan" subtitle={`Chỉ số chính · kỳ báo cáo: ${label}`} />

      <div className="pp-kpi-grid">
        <Kpi label="Tài sản ròng" value={formatVND(netWorth.totalNetWorth)} tone="neutral"
          sub={`Tài sản ${formatVND(netWorth.totalAssets)} · Nợ ${formatVND(netWorth.totalLiabilities)}`} />
        <Kpi label="Giá trị danh mục" value={formatVND(pnlSummary.totalValue)} tone="neutral"
          sub={`Vốn ròng đã nạp ${formatVND(pnlSummary.totalCost)}`} />
        <Kpi label="Lãi/lỗ tích lũy" value={fmtSignedVND(pnlSummary.totalPnL)} raw={pnlSummary.totalPnL}
          sub={`${fmtPct(pnlSummary.totalPnLPercent / 100)} trên vốn ròng`} />
        <Kpi label="Tiền mặt khả dụng" value={formatVND(cash)} tone="neutral"
          sub={pnlSummary.totalValue > 0 ? `${fmtPctPlain(cash / pnlSummary.totalValue)} danh mục` : null} />
      </div>

      <div className="pp-section-label">Hiệu suất trong kỳ · {report.hasData ? `${formatISO(report.points[0].date)} – ${formatISO(report.points[report.points.length - 1].date)}` : label}</div>
      <div className="pp-kpi-grid">
        <Kpi label="TTWROR" value={fmtPct(report.ttwror)} raw={report.ttwror}
          sub={report.ttwrorAnnualized !== null ? `${fmtPct(report.ttwrorAnnualized)} / năm` : 'Lợi suất theo thời gian'}
          hint="True Time-Weighted Rate of Return — loại bỏ ảnh hưởng của nạp/rút tiền" />
        <Kpi label="IRR" value={fmtPct(report.irr)} raw={report.irr}
          sub="Lợi suất theo dòng tiền / năm" hint="Internal Rate of Return — có tính thời điểm nạp/rút tiền" />
        <Kpi label="Delta" value={fmtSignedVND(report.delta)} raw={report.delta}
          sub={`Thay đổi tuyệt đối ${fmtSignedVND(report.absoluteChange)}`}
          hint="Delta = thay đổi giá trị − (nạp − rút) trong kỳ" />
        <Kpi label="Max Drawdown" value={report.hasData ? fmtPct(-report.maxDrawdown) : '—'} raw={report.hasData ? -report.maxDrawdown : null}
          sub={report.volatility !== null ? `Biến động ${fmtPctPlain(report.volatility)} · ${fmtDuration(report.drawdown.maxDurationDays)}` : 'Mức sụt giảm lớn nhất từ đỉnh'} />
      </div>

      <Card
        title="Hiệu suất so với chỉ số tham chiếu"
        subtitle="TTWROR tích lũy của danh mục, VN-Index và Bitcoin quy về 0% tại đầu kỳ"
        actions={<Link to="/reports/performance/chart" className="pp-link">Chi tiết →</Link>}
      >
        {report.hasData
          ? <PerformanceChart ttwrorPoints={report.ttwrorPoints} height={300} />
          : <Empty title="Chưa đủ snapshot trong kỳ" hint="Cần ít nhất 2 snapshot. Vào Cài đặt → Snapshot lịch sử để dựng lại dữ liệu quá khứ." action={<Link to="/settings" className="pp-btn">Mở Cài đặt</Link>} />}
      </Card>

      <div className="pp-grid-2">
        <Card title="Lợi nhuận theo tháng" subtitle="TTWROR từng tháng và cả năm" actions={<Link to="/reports/performance/chart" className="pp-link">Xem tất cả →</Link>}>
          <HeatmapWidget months={report.monthlyReturns} years={report.yearlyReturns} onlyYears={recentYears} />
        </Card>
        <Card title="Phân bổ theo loại tài sản" actions={<Link to="/taxonomies/asset-classes" className="pp-link">Phân loại →</Link>}>
          {allocation.length ? <AssetAllocationChart data={allocation} size={200} /> : <Empty title="Chưa có tài sản" />}
        </Card>
      </div>

      <div className="pp-grid-2">
        <Card title="Vị thế lớn nhất" padded={false} actions={<Link to="/reports/assets" className="pp-link">Bảng kê →</Link>}>
          <DataTable
            rows={topHoldings}
            rowKey={r => r.ticker}
            footer={false}
            columns={[
              { key: 'ticker', label: 'Mã', render: r => <><div className="pp-strong">{r.ticker}</div><div className="pp-meta">{r.storage || r.assetClass}</div></> },
              { key: 'actualValue', label: 'Giá trị', align: 'right', render: r => fmtVND(r.actualValue) },
              { key: 'weight', label: 'Tỷ trọng', align: 'right', render: r => fmtPctPlain(r.weight) },
              { key: 'pnlPercent', label: 'Lãi/lỗ', align: 'right', render: r => <span className={toneOf(r.pnl)}>{fmtPct(r.pnlPercent / 100)}</span> },
            ]}
          />
        </Card>
        <Card title="Giao dịch gần đây" padded={false} actions={<Link to="/transactions" className="pp-link">Tất cả →</Link>}>
          <DataTable
            rows={recent}
            rowKey={(r, i) => r.id || i}
            footer={false}
            columns={[
              { key: 'date', label: 'Ngày', sortValue: r => parseVNDate(r.date).getTime(), render: r => formatISO(toISO(r.date)) },
              { key: 'transactionType', label: 'Loại', render: r => <TxTypeBadge type={r.transactionType} /> },
              { key: 'ticker', label: 'Mã', render: r => r.ticker || '—' },
              { key: 'totalVND', label: 'Số tiền', align: 'right', render: r => fmtVND(Math.abs(r.totalVND || 0)) },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
