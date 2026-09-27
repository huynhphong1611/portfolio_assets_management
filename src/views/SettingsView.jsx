import React, { useMemo, useState } from 'react';
import { Camera, Calendar, RefreshCw, Upload, LogOut, Loader2, ExternalLink, Download, ArchiveRestore, FileText } from 'lucide-react';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Card, Kpi, PageHeader } from '../components/ui';
import HistoricalSnapshotModal from '../components/HistoricalSnapshotModal.jsx';
import ImportCSVModal from '../components/ImportCSVModal.jsx';
import { apiUpdateQuotes, apiExportWorkspace, apiImportWorkspace } from '../services/api.js';
import { TRANSACTION_TEMPLATE, PRICE_TEMPLATE, downloadText } from '../utils/csvTemplates.js';
import { addDays, formatISO, todayISO } from '../utils/dates.js';

/** Settings & data maintenance (snapshots, prices, import). */
export default function SettingsView() {
  const { transactions, snapshots, snapshotToday, recomputeAndSnapshot, refresh } = usePortfolioData();
  const { currentUser, logout } = useAuth();
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [showBackfill, setShowBackfill] = useState(false);
  const [importMode, setImportMode] = useState(null);

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

  const exportBackup = () => run('backup', async () => {
    const data = await apiExportWorkspace();
    const name = `portfolio-backup-${(currentUser?.username || 'user').replace(/[^\w-]+/g, '_')}-${todayISO()}.json`;
    downloadText(JSON.stringify(data, null, 2), name, 'application/json');
    return data;
  }, d => `Đã tải bản sao lưu: ${d?.transactions?.length ?? 0} giao dịch, ${Object.keys(d?.securityPrices || {}).length} mã có giá riêng, ${d?.snapshots?.length ?? 0} snapshot.`);

  const restoreBackup = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => run('restore', async () => {
      let data;
      try { data = JSON.parse(String(reader.result || '')); } catch { throw new Error('File không phải JSON hợp lệ'); }
      const check = await apiImportWorkspace(data, true);
      const c = check.counts;
      const summary = `${c.transactions} giao dịch, ${c.securities} chứng khoán, ${c.securityPrices} giá, ${c.externalAssets} tài sản ngoài, ${c.liabilities} khoản nợ, ${c.snapshots} snapshot`;
      const warn = check.errors?.length ? `\n\n${check.errors.length} mục không hợp lệ sẽ bị bỏ qua.` : '';
      if (!window.confirm(`Khôi phục ${summary}?\nDữ liệu cùng mã định danh sẽ được ghi đè, dữ liệu khác được giữ nguyên.${warn}`)) {
        return null;
      }
      await apiImportWorkspace(data, false);
      await refresh();
      return summary;
    }, s => (s ? `Đã khôi phục ${s}.` : 'Đã hủy khôi phục.'));
    reader.readAsText(file, 'utf-8');
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

        <Card title="Giá thị trường" subtitle="Lấy giá mới nhất cho các mã nguồn Tự động của bạn (vnstock, CoinGecko, SJC) và các nguồn JSON, rồi định giá lại danh mục và lưu snapshot hôm nay. Mã không có API: đặt nguồn Nhập tay trong Tất cả chứng khoán.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn pp-btn--primary" disabled={!!busy}
              onClick={() => run('prices', async () => { const r = await apiUpdateQuotes(); await recomputeAndSnapshot(); return r; }, r => `Đã cập nhật ${r?.fetched ?? 0} giá tự động và ${r?.jsonFeeds?.updated?.length ?? 0} nguồn JSON.`)}>
              {busy === 'prices' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Cập nhật giá & tính lại
            </button>
          </div>
        </Card>
      </div>

      <div className="pp-grid-2">
        <Card title="Nhập dữ liệu từ CSV" subtitle="File CSV của bạn: xem trước, báo lỗi từng dòng, bỏ qua giao dịch trùng rồi mới ghi.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn" onClick={() => setImportMode('transactions')}><Upload size={15} /> Nhập giao dịch</button>
            <button type="button" className="pp-btn" onClick={() => setImportMode('prices')}><Upload size={15} /> Nhập lịch sử giá</button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => downloadText(TRANSACTION_TEMPLATE, 'mau-giao-dich.csv')}><FileText size={15} /> Mẫu giao dịch</button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={() => downloadText(PRICE_TEMPLATE, 'mau-lich-su-gia.csv')}><FileText size={15} /> Mẫu lịch sử giá</button>
          </div>
        </Card>
        <Card title="Sao lưu & khôi phục" subtitle="Toàn bộ dữ liệu của bạn trong một file JSON: giao dịch, chứng khoán, giá riêng, tài sản ngoài, nợ, snapshot, tỷ trọng mục tiêu.">
          <div className="pp-action-list">
            <button type="button" className="pp-btn" disabled={!!busy} onClick={exportBackup}>
              {busy === 'backup' ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Tải bản sao lưu
            </button>
            <label className={`pp-btn ${busy ? 'is-disabled' : ''}`}>
              {busy === 'restore' ? <Loader2 size={15} className="spin" /> : <ArchiveRestore size={15} />} Khôi phục từ file…
              <input type="file" accept=".json,application/json" hidden disabled={!!busy}
                onChange={e => { restoreBackup(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        </Card>
      </div>

      <div className="pp-grid-2">
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

      <ImportCSVModal
        mode={importMode || 'transactions'}
        open={!!importMode}
        onClose={() => setImportMode(null)}
        onDone={async (res) => { await refresh(); setStatus({ type: 'ok', text: `Đã nhập ${res?.imported ?? 0} ${importMode === 'prices' ? 'giá' : 'giao dịch'}.` }); }}
      />

      {showBackfill && (
        <HistoricalSnapshotModal
          onClose={() => setShowBackfill(false)}
          onSuccess={res => { setStatus({ type: 'ok', text: `Đã tạo ${res?.total ?? 0} snapshot lịch sử.` }); refresh(); }}
        />
      )}
    </>
  );
}
