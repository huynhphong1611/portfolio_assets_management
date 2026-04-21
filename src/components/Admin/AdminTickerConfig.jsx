import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { apiGetAdminTickers, apiSaveAdminTickers } from '../../services/adminApi';

const CATEGORIES = [
  { key: 'stocks', label: '📈 Cổ phiếu & ETF', placeholder: 'VD: VCB, VHM, FUEVND' },
  { key: 'crypto', label: '💰 Crypto', placeholder: 'VD: BTC, ETH, SOL, PAXG' },
  { key: 'funds', label: '🏦 Chứng chỉ quỹ mở', placeholder: 'VD: VESAF, VEOF, DCBF' },
];

export default function AdminTickerConfig() {
  const [tickers, setTickers] = useState({ stocks: [], crypto: [], funds: [] });
  const [inputs, setInputs] = useState({ stocks: '', crypto: '', funds: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    apiGetAdminTickers()
      .then(data => setTickers({
        stocks: data.stocks || [],
        crypto: data.crypto || [],
        funds: data.funds || [],
      }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addTicker = (category) => {
    const raw = inputs[category].trim().toUpperCase();
    if (!raw) return;
    const newTickers = raw.split(/[\s,;]+/).filter(Boolean);
    setTickers(prev => ({
      ...prev,
      [category]: [...new Set([...prev[category], ...newTickers])],
    }));
    setInputs(prev => ({ ...prev, [category]: '' }));
  };

  const removeTicker = (category, ticker) => {
    setTickers(prev => ({
      ...prev,
      [category]: prev[category].filter(t => t !== ticker),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await apiSaveAdminTickers(tickers);
      setStatus({ type: 'success', text: '✅ Đã lưu cấu hình tickers' });
    } catch (err) {
      setStatus({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div className="admin-section animate-fade-in">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">⚙️ Cấu hình Ticker</h2>
          <p className="admin-section-subtitle">
            Quản lý danh sách mã được hệ thống hỗ trợ. Scheduler sẽ lấy giá cho các mã này.
          </p>
        </div>
        <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
          Lưu thay đổi
        </button>
      </div>

      {status && (
        <div className={`admin-status-msg ${status.type === 'error' ? 'admin-status-error' : 'admin-status-success'}`}>
          {status.text}
        </div>
      )}

      <div className="admin-ticker-grid">
        {CATEGORIES.map(({ key, label, placeholder }) => (
          <div key={key} className="admin-card">
            <h3 className="admin-card-title">{label}</h3>
            <p className="admin-card-subtitle">{tickers[key].length} mã đã cấu hình</p>

            {/* Add input */}
            <div className="admin-ticker-add">
              <input
                type="text"
                className="form-input"
                placeholder={placeholder}
                value={inputs[key]}
                onChange={e => setInputs(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addTicker(key)}
              />
              <button className="btn-primary btn-sm" onClick={() => addTicker(key)}>
                <Plus size={14} />
              </button>
            </div>

            {/* Ticker tags */}
            <div className="admin-ticker-tags">
              {tickers[key].map(ticker => (
                <div key={ticker} className="admin-ticker-tag">
                  <span>{ticker}</span>
                  <button
                    className="admin-ticker-remove"
                    onClick={() => removeTicker(key, ticker)}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {tickers[key].length === 0 && (
                <span className="admin-ticker-empty">Chưa có mã nào</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
