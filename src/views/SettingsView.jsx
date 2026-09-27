import React, { useMemo, useState } from 'react';
import { Camera, Calendar, RefreshCw, Upload, LogOut, Loader2, ExternalLink } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Card, Kpi, PageHeader } from '../components/ui';
import HistoricalSnapshotModal from '../components/HistoricalSnapshotModal.jsx';
import { apiUserFetchLivePrices } from '../services/api.js';
import { importCSVToFirestore, CSV_RAW_DATA } from '../scripts/importCSV.js';
import { addDays, formatISO, todayISO } from '../utils/dates.js';

/** Settings & data maintenance (snapshots, prices, import). */
export default function SettingsView() {
  const { transactions, snapshots, snapshotToday, recomputeAndSnapshot, refresh } = usePortfolioData();
  const { currentUser, logout } = useAuth();
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [showBackfill, setShowBackfill] = useState(false);

  const coverage = useMemo(() => {
    const dates = snapshots.map(s => s.date).filter(Boolean).sort();
    const set = new Set(dates);
    const today = todayISO();
    let missing30 = 0;
    for (let i = 0; i < 30; i++) if (!set.has(addDays(today, -i))) missing30++;
    return { count: dates.length, first: dates[0] || null, last: dates[dates.length - 1] || null, missing30 };
  }, [snapshots]);

  const run = async (key, fn, okText) => {
    setBusy(key);
    setStatus(null);
    try {
      const res = await fn();
      setStatus({ type: 'ok', text: typeof okText === 'function' ? okText(res) : okText });
    } catch (err) {
      setStatus({ type: 'error', text: `Lỗi: ${err.message}` });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = () => {
    if (transactions.length > 0 && !window.confirm('Đã có giao dịch. Vẫn import thêm dữ liệu CSV mẫu?')) return;
    run('import', async () => { const n = await importCSVToFirestore(CSV_RAW_DATA); await refresh(); return n; }, n => `Đã import ${n} giao dịch.`);
  };

  return (
    <>
      <PageHeader title="Cài đặt & Dữ liệu" subtitle="Snapshot, cập nhật giá, nhập dữ liệu và tài khoản" />
      {status && <div className={`pp-alert ${status.type === 'error' ? 'pp-alert--error' : 'pp-alert--ok'}`}>{status.text}</div>}

      <div className="pp-kpi-grid">
        <Kpi label="Giao dịch" value={String(transactions.length)} tone="neutral" />
        <Kpi label="Snapshot" value={String(coverage.count)} tone="neutral"
          sub={coverage.first ? `${formatISO(coverage.first)} → ${formatISO(coverage.last)}` : 'Chưa có snapshot'} />
        <Kpi label="Thiếu trong 30 ngày" value={`${coverage.missing30} ngày`} tone={coverage.missing30 > 5 ? 'down' : 'neutral'}
          sub="Snapshot càng đầy đủ, TTWROR/IRR càng chính xác" />
        <Kpi label="Người dùng" value={currentUser?.username || '—'} tone="neutral" sub={currentUser?.type === 'firebase' ? 'Firebase' : 'Khách (guest)'} />
      </div>

      <div className="pp-grid-2">
        <Card title="Snapshot giá trị danh mục" subtitle="Mọi báo cáo hiệu suất được tính từ chuỗi snapshot hằng ngày. Hệ thống tự chụp mỗi ngày lúc 9:00 và khi bạn mở ứng dụng.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn" disabled={!!busy} onClick={() => run('snap', snapshotToday, d => `Đã lưu snapshot ngày ${formatISO(d)}.`)}>
              {busy === 'snap' ? <Loader2 size={15} className="spin" /> : <Camera size={15} />} Chụp snapshot hôm nay
            </button>
            <button type="button" className="pp-btn" disabled={!!busy} onClick={() => setShowBackfill(true)}>
              <Calendar size={15} /> Dựng snapshot lịch sử…
            </button>
          </div>
        </Card>

        <Card title="Giá thị trường" subtitle="Lấy giá mới nhất cho mọi mã được theo dõi (vnstock, CoinGecko, SJC), rồi định giá lại danh mục và lưu snapshot hôm nay.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn pp-btn--primary" disabled={!!busy}
              onClick={() => run('prices', async () => { const r = await apiUserFetchLivePrices(); await recomputeAndSnapshot(); return r; }, r => `Đã cập nhật ${r?.fetched ?? 0} mã.`)}>
              {busy === 'prices' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Cập nhật giá & tính lại
            </button>
          </div>
        </Card>
      </div>

      <div className="pp-grid-2">
        <Card title="Nhập dữ liệu" subtitle="Import bộ giao dịch mẫu (CSV) vào tài khoản hiện tại.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn" disabled={!!busy} onClick={handleImport}>
              {busy === 'import' ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Import CSV mẫu
            </button>
          </div>
        </Card>
        <Card title="Tài khoản">
          <div className="pp-action-list">
            <button type="button" className="pp-btn pp-btn--danger" onClick={logout}><LogOut size={15} /> Đăng xuất</button>
          </div>
        </Card>
      </div>

      <Card title="Về giao diện">
        <p className="pp-prose">
          Cấu trúc ứng dụng được tổ chức theo mô hình của{' '}
          <a href="https://www.portfolio-performance.info/en/" target="_blank" rel="noreferrer" className="pp-link">Portfolio Performance <ExternalLink size={12} /></a>{' '}
          (phần mềm mã nguồn mở): <strong>Dữ liệu chung</strong> (chứng khoán, tỷ giá), <strong>Tài khoản</strong> (chứng khoán, tiền mặt, giao dịch),
          <strong> Báo cáo</strong> (bảng kê tài sản, hiệu suất: TTWROR, IRR, drawdown, biến động, cổ tức, lệnh lãi/lỗ) và <strong>Phân loại</strong> (loại tài sản, tái cân bằng).
          Kỳ báo cáo chọn trên thanh công cụ áp dụng cho mọi báo cáo, và mỗi màn hình có đường dẫn riêng để đánh dấu hoặc chia sẻ.
        </p>
      </Card>

      {showBackfill && (
        <HistoricalSnapshotModal
          onClose={() => setShowBackfill(false)}
          onSuccess={res => { setStatus({ type: 'ok', text: `Đã tạo ${res?.total ?? 0} snapshot lịch sử.` }); refresh(); }}
        />
      )}
    </>
  );
}
