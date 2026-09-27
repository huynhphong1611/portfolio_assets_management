import React, { useMemo } from 'react';
import { usePortfolioData } from '../../contexts/PortfolioDataContext.jsx';
import { Card, PageHeader, DataTable, Empty } from '../../components/ui';
import AssetAllocationChart from '../../components/AssetAllocationChart.jsx';
import { Link } from '../../router/useHashRoute.jsx';
import { calculateHoldingsByStorage } from '../../utils/accounts.js';
import { PALETTE } from '../../utils/assetClasses.js';
import { fmtVND, fmtPctPlain, fmtSignedVND, toneOf } from '../../utils/formatters.js';

/** Taxonomy by custodian — concentration risk per broker / exchange / platform. */
export default function StorageView() {
  const { transactions, portfolio } = usePortfolioData();
  const accounts = useMemo(
    () => calculateHoldingsByStorage(transactions, portfolio).filter(a => a.value > 0),
    [transactions, portfolio]
  );
  const total = accounts.reduce((s, a) => s + a.value, 0);
  const donut = accounts.map((a, i) => ({ label: a.name, value: a.value, color: PALETTE[i % PALETTE.length] }));

  return (
    <>
      <PageHeader title="Phân loại: Nơi lưu ký" subtitle="Mức độ tập trung tài sản theo công ty chứng khoán, sàn giao dịch, nền tảng quỹ" />
      {!accounts.length ? (
        <Card><Empty title="Chưa có dữ liệu" hint="Điền “Nơi lưu trữ” khi ghi nhận giao dịch mua để phân loại." /></Card>
      ) : (
        <div className="pp-grid-2">
          <Card title="Tỷ trọng theo nơi lưu ký"><AssetAllocationChart data={donut} size={240} /></Card>
          <Card title="Chi tiết" padded={false} actions={<Link to="/accounts/securities" className="pp-link">Tài khoản →</Link>}>
            <DataTable
              rows={accounts}
              rowKey={r => r.name}
              defaultSort={{ key: 'value', dir: 'desc' }}
              columns={[
                { key: 'name', label: 'Nơi lưu ký', render: r => <><div className="pp-strong">{r.name}</div><div className="pp-meta">{r.positions.length} vị thế</div></>, footer: () => <strong>Tổng</strong> },
                { key: 'value', label: 'Giá trị', align: 'right', render: r => fmtVND(r.value), footer: l => fmtVND(l.reduce((s, r) => s + r.value, 0)) },
                { key: 'weight', label: 'Tỷ trọng', align: 'right', sortValue: r => r.value, render: r => fmtPctPlain(total > 0 ? r.value / total : 0) },
                { key: 'pnl', label: 'Lãi/lỗ', align: 'right', render: r => <span className={toneOf(r.pnl)}>{fmtSignedVND(r.pnl)}</span> },
              ]}
            />
          </Card>
        </div>
      )}
    </>
  );
}
