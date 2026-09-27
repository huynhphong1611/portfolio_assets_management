import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { usePeriodReport } from '../../hooks/usePeriodReport.js';
import { useReportingPeriod } from '../../contexts/ReportingPeriodContext.jsx';
import { Card, Empty, PageHeader } from '../../components/ui';
import { Link } from '../../router/useHashRoute.jsx';
import { fmtPct, fmtPctPlain, fmtSignedVND, fmtVND, fmtDuration, toneOf } from '../../utils/formatters.js';
import { formatISO } from '../../utils/dates.js';

function groupByTicker(items, valueOf) {
  const map = new Map();
  for (const it of items) map.set(it.ticker, (map.get(it.ticker) || 0) + valueOf(it));
  return Array.from(map.entries()).map(([ticker, value]) => ({ label: ticker === 'VNĐ' ? 'Lãi tiền gửi / khác' : ticker, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** PP → Reports → Performance → Calculation */
export default function CalculationView() {
  const report = usePeriodReport('portfolioValue');
  const { label } = useReportingPeriod();
  const [open, setOpen] = useState({ realized: false, earnings: false, transfers: true });

  const realizedByTicker = useMemo(() => {
    if (!report.hasData) return [];
    const s = report.points[0].date, e = report.points[report.points.length - 1].date;
    return groupByTicker(report.replay.trades.filter(t => t.end > s && t.end <= e), t => t.pnl);
  }, [report]);

  const earningsByTicker = useMemo(() => {
    if (!report.hasData) return [];
    const s = report.points[0].date, e = report.points[report.points.length - 1].date;
    return groupByTicker(report.replay.earnings.filter(x => x.date > s && x.date <= e), x => x.amount);
  }, [report]);

  if (!report.hasData) {
    return (
      <>
        <PageHeader title="Tính toán hiệu suất" subtitle={`Kỳ báo cáo: ${label}`} />
        <Card>
          <Empty title="Chưa đủ dữ liệu trong kỳ báo cáo"
            hint="Cần ít nhất 2 snapshot giá trị danh mục trong kỳ. Hãy chọn kỳ dài hơn hoặc tạo snapshot lịch sử."
            action={<Link to="/settings" className="pp-btn">Tạo snapshot lịch sử</Link>} />
        </Card>
      </>
    );
  }

  const startDate = report.points[0].date;
  const endDate = report.points[report.points.length - 1].date;

  const rows = [
    { id: 'initial', label: `Giá trị đầu kỳ (${formatISO(startDate)})`, value: report.initialValue, total: true },
    { id: 'capital', sign: '+', label: 'Lãi/lỗ vốn chưa thực hiện', value: report.capitalGains, hint: 'Thay đổi giá của các tài sản đang nắm giữ' },
    { id: 'realized', sign: '+', label: 'Lãi/lỗ đã thực hiện', value: report.realizedGains, children: realizedByTicker, hint: 'Giá bán − giá vốn bình quân của các lệnh bán trong kỳ' },
    { id: 'earnings', sign: '+', label: 'Thu nhập (cổ tức, lãi)', value: report.earnings, children: earningsByTicker },
    { id: 'fees', sign: '−', label: 'Phí giao dịch', value: null, note: 'chưa theo dõi riêng (đã gộp trong giá)' },
    { id: 'taxes', sign: '−', label: 'Thuế', value: null, note: 'chưa theo dõi riêng' },
    { id: 'transfers', sign: '+', label: 'Chuyển tiền trung tính', value: report.transferals, hint: 'Nạp − rút: không phải lãi/lỗ',
      children: [{ label: 'Nạp tiền', value: report.deposits }, { label: 'Rút tiền', value: -report.withdrawals }] },
    { id: 'final', label: `Giá trị cuối kỳ (${formatISO(endDate)})`, value: report.finalValue, total: true },
  ];

  const figures = [
    { label: 'TTWROR (tích lũy)', value: fmtPct(report.ttwror), raw: report.ttwror, hint: 'True Time-Weighted Rate of Return' },
    { label: 'TTWROR năm hóa (p.a.)', value: fmtPct(report.ttwrorAnnualized), raw: report.ttwrorAnnualized },
    { label: 'IRR (năm hóa)', value: fmtPct(report.irr), raw: report.irr, hint: 'Internal Rate of Return — money-weighted' },
    { label: 'Thay đổi tuyệt đối', value: fmtSignedVND(report.absoluteChange), raw: report.absoluteChange },
    { label: 'Delta', value: fmtSignedVND(report.delta), raw: report.delta, hint: 'Thay đổi tuyệt đối − chuyển tiền trung tính' },
    { label: 'Max Drawdown', value: fmtPct(-report.maxDrawdown), raw: -report.maxDrawdown,
      sub: report.drawdown.peakDate ? `${formatISO(report.drawdown.peakDate)} → ${formatISO(report.drawdown.troughDate)}` : null },
    { label: 'Thời gian drawdown dài nhất', value: fmtDuration(report.drawdown.maxDurationDays),
      sub: report.drawdown.durationStart ? `${formatISO(report.drawdown.durationStart)} → ${formatISO(report.drawdown.durationEnd)}` : null },
    { label: 'Biến động (năm hóa)', value: fmtPctPlain(report.volatility), hint: 'Độ lệch chuẩn lợi suất từng kỳ × √252' },
    { label: 'Semi-volatility', value: fmtPctPlain(report.semiVolatility), hint: 'Chỉ tính các biến động giảm' },
    { label: 'Số ngày trong kỳ', value: `${report.days} ngày`, sub: `${report.points.length} snapshot` },
  ];

  return (
    <>
      <PageHeader title="Tính toán hiệu suất" subtitle={`Performance Calculation · ${formatISO(startDate)} – ${formatISO(endDate)}`} />
      <div className="pp-grid-2 pp-grid-2--wide-left">
        <Card title="Bảng tính" padded={false}>
          <table className="pp-calc">
            <tbody>
              {rows.map(r => {
                const isOpen = !!open[r.id];
                const hasChildren = r.children && r.children.length > 0;
                return (
                  <React.Fragment key={r.id}>
                    <tr className={`pp-calc-row ${r.total ? 'pp-calc-row--total' : ''} ${hasChildren ? 'is-expandable' : ''}`}
                      onClick={hasChildren ? () => setOpen(o => ({ ...o, [r.id]: !o[r.id] })) : undefined}>
                      <td className="pp-calc-sign">{r.sign || (r.total ? '=' : '')}</td>
                      <td className="pp-calc-label" title={r.hint || ''}>
                        {hasChildren && (isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                        {r.label}
                        {r.note && <span className="pp-meta"> — {r.note}</span>}
                      </td>
                      <td className={`pp-calc-value ${r.total ? '' : toneOf(r.value || 0)}`}>
                        {r.value === null ? '—' : (r.total ? fmtVND(r.value) : fmtSignedVND(r.value))}
                      </td>
                    </tr>
                    {hasChildren && isOpen && r.children.map((c, i) => (
                      <tr key={`${r.id}-${i}`} className="pp-calc-row pp-calc-row--child">
                        <td></td>
                        <td className="pp-calc-label">{c.label}</td>
                        <td className={`pp-calc-value ${toneOf(c.value)}`}>{fmtSignedVND(c.value)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Chỉ số" padded={false}>
          <table className="pp-figures">
            <tbody>
              {figures.map(f => (
                <tr key={f.label} title={f.hint || ''}>
                  <td className="pp-figures-label">{f.label}{f.sub && <div className="pp-meta">{f.sub}</div>}</td>
                  <td className={`pp-figures-value ${f.raw !== undefined && f.raw !== null ? toneOf(f.raw) : ''}`}>{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Cách hiểu các chỉ số">
        <dl className="pp-glossary">
          <dt>TTWROR</dt>
          <dd>Lợi suất theo thời gian thực: nối chuỗi lợi suất giữa các snapshot và loại bỏ tác động của nạp/rút tiền. Dùng để so sánh với chỉ số tham chiếu.</dd>
          <dt>IRR</dt>
          <dd>Lợi suất nội bộ theo dòng tiền: phản ánh cả thời điểm và quy mô các lần nạp/rút, tức hiệu quả thực tế trên đồng vốn của bạn.</dd>
          <dt>Delta</dt>
          <dd>Phần giá trị tăng thêm do đầu tư mang lại = thay đổi tuyệt đối − (nạp − rút).</dd>
          <dt>Max Drawdown</dt>
          <dd>Mức sụt giảm lớn nhất từ một đỉnh xuống đáy liền sau của chuỗi TTWROR trong kỳ.</dd>
          <dt>Biến động</dt>
          <dd>Độ lệch chuẩn của lợi suất giữa các snapshot, năm hóa. Semi-volatility chỉ xét các biến động giảm.</dd>
        </dl>
      </Card>
    </>
  );
}
