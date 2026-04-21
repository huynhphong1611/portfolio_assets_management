import React, { useState, useEffect } from 'react';
import { Save, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiGetAdminSettings, apiSaveAdminSettings, apiMigrateDailyPrices, apiGetAdminTickerStats } from '../../services/adminApi';
import { formatNum } from '../../utils/formatters';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    usdt_vnd_default: 26500,
    auto_fetch_enabled: true,
  });
  const [tickerStats, setTickerStats] = useState(null);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    Promise.all([
      apiGetAdminSettings().catch(console.error),
      apiGetAdminTickerStats().catch(console.error)
    ]).then(([settingsData, statsData]) => {
      if (settingsData) setSettings(s => ({ ...s, ...settingsData }));
      if (statsData) setTickerStats(statsData);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiSaveAdminSettings(settings);
      setStatus({ type: 'success', text: '✅ Đã lưu settings' });
    } catch (err) {
      setStatus({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('Migrate toàn bộ user daily prices sang system collection?\n\nThao tác này chỉ nên chạy 1 lần.')) return;
    setMigrating(true);
    setStatus(null);
    try {
      const result = await apiMigrateDailyPrices();
      setStatus({
        type: 'success',
        text: `✅ Migration xong: ${result.dates_written} ngày, ${result.users_scanned} users, ${result.source_entries} entries nguồn.`,
      });
    } catch (err) {
      setStatus({ type: 'error', text: `❌ Migration lỗi: ${err.message}` });
    } finally {
      setMigrating(false);
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div className="admin-section animate-fade-in">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">⚙️ Cài đặt Hệ thống</h2>
          <p className="admin-section-subtitle">Global settings áp dụng cho toàn bộ hệ thống.</p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          Lưu Settings
        </button>
      </div>

      {status && (
        <div className={`admin-status-msg ${status.type === 'error' ? 'admin-status-error' : 'admin-status-success'}`}>
          {status.text}
        </div>
      )}

      <div className="admin-settings-grid">
        {/* USDT VND Default */}
        <div className="admin-card">
          <h3 className="admin-card-title">💱 Tỷ giá USDT/VNĐ mặc định</h3>
          <p className="admin-card-subtitle">
            Dùng khi không fetch được từ API. Hiện tại: <strong>{formatNum(settings.usdt_vnd_default)} VNĐ</strong>
          </p>
          <input
            type="number"
            className="form-input"
            value={settings.usdt_vnd_default || ''}
            onChange={e => setSettings(s => ({ ...s, usdt_vnd_default: parseFloat(e.target.value) || 0 }))}
            placeholder="26500"
          />
        </div>

        {/* Auto Fetch */}
        <div className="admin-card">
          <h3 className="admin-card-title">🤖 Tự động lấy giá (Scheduler)</h3>
          <p className="admin-card-subtitle">
            Bật/tắt scheduler tự động lấy giá lúc 9:00 SA hàng ngày.
          </p>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={settings.auto_fetch_enabled}
              onChange={e => setSettings(s => ({ ...s, auto_fetch_enabled: e.target.checked }))}
            />
            <span className="admin-toggle-slider" />
            <span style={{ marginLeft: '0.5rem' }}>
              {settings.auto_fetch_enabled ? '✅ Đang bật' : '⛔ Đã tắt'}
            </span>
          </label>
        </div>
      </div>

      {/* Ticker Stats: User Usage */}
      {tickerStats && (
        <div className="admin-card">
          <h3 className="admin-card-title">📊 Thống kê mã tài sản User đang nắm giữ ({tickerStats.traded_total})</h3>
          <p className="admin-card-subtitle">
            Danh sách các mã mà người dùng đã nhập vào giao dịch. 
            Mã <strong>chưa thêm</strong> sẽ bị bỏ qua khi crawler chạy lấy giá tự động.
          </p>
          
          <div className="admin-ticker-tags" style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem', background: 'var(--color-slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
            {tickerStats.traded_list?.map((t, idx) => (
              <span
                key={idx}
                className="admin-ticker-tag"
                style={{
                  borderLeft: `3px solid ${t.in_system ? 'var(--color-emerald-500)' : 'var(--color-rose-500)'}`
                }}
                title={`Loại: ${t.assetClass} | Số người dùng: ${t.user_count}`}
              >
                {t.ticker}
                <span className={`admin-badge ${t.in_system ? 'admin-badge--blue' : 'admin-badge--orange'}`}>
                  {t.in_system ? 'Đã thêm' : 'Chưa thêm'}
                </span>
                <span style={{ fontSize: '0.7em', color: 'var(--text-muted)' }}>({t.user_count} users)</span>
              </span>
            ))}
            {tickerStats.traded_total === 0 && (
              <span className="admin-ticker-empty">Chưa có dữ liệu giao dịch từ user.</span>
            )}
          </div>
        </div>
      )}

      {/* Danger Zone — Migration */}
      <div className="admin-card admin-danger-card">
        <div className="admin-danger-header">
          <AlertTriangle size={20} style={{ color: 'var(--color-rose-400)' }} />
          <h3 className="admin-card-title" style={{ color: 'var(--color-rose-400)' }}>Vùng nguy hiểm</h3>
        </div>
        <p className="admin-card-subtitle">
          <strong>Migrate Daily Prices</strong> — Chuyển toàn bộ dữ liệu giá cũ từ từng user sang system collection.
          Chỉ chạy một lần. Không xóa dữ liệu gốc.
        </p>
        <button
          className="btn-glass btn-sm"
          style={{ borderColor: 'rgba(244,63,94,0.4)', color: 'var(--color-rose-400)' }}
          onClick={handleMigrate}
          disabled={migrating}
        >
          {migrating ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          Chạy Migration
        </button>
      </div>
    </div>
  );
}
