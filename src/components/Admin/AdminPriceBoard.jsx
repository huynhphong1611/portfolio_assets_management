import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Save, Calendar, Loader2, BarChart3, Plus, AlertCircle
} from 'lucide-react';
import {
  apiGetSystemPrices, apiGetSystemPricesHistory,
  apiSaveSystemPrices, apiFetchSystemPricesFromAPI
} from '../../services/adminApi';
import { formatNum, formatUSD, vndToUSD } from '../../utils/formatters';

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'BNB', 'SOL', 'PAXG', 'HYPE', 'ARB', 'OP', 'SUI', 'APT', 'DOGE', 'XRP', 'ADA']);
const STABLECOIN_TICKERS = new Set(['USDT', 'USDC']);

export default function AdminPriceBoard() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [prices, setPrices] = useState({});
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const usdtRate = useMemo(() => prices['USDT'] || prices['USDC'] || 0, [prices]);

  const loadForDate = async (date) => {
    try {
      const data = await apiGetSystemPrices(date);
      if (data?.prices) {
        setPrices(data.prices);
      } else {
        // Fallback to latest
        const latest = await apiGetSystemPrices();
        if (latest?.prices) setPrices(latest.prices);
        else setPrices({});
      }
    } catch {
      setPrices({});
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await apiGetSystemPricesHistory();
      setHistory(data || []);
    } catch { /* ignore */ } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadForDate(selectedDate);
    loadHistory();
  }, []);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    loadForDate(date);
  };

  const handleFetchAPI = async () => {
    setFetching(true);
    setStatusMsg(null);
    try {
      const result = await apiFetchSystemPricesFromAPI(selectedDate);
      if (result?.prices) {
        setPrices(result.prices);
        setStatusMsg({ type: 'success', text: `✅ Đã lấy ${result.fetched}/${result.total_tickers} giá từ API. Tỷ giá USDT: ${formatNum(result.usdt_vnd_rate)} VNĐ` });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi API: ${err.message}` });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      await apiSaveSystemPrices(prices, selectedDate);
      setStatusMsg({ type: 'success', text: `✅ Đã lưu bảng giá ngày ${selectedDate}` });
      loadHistory();
    } catch (err) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const tickerList = useMemo(() => Object.keys(prices).sort(), [prices]);

  const isCrypto = (ticker) =>
    CRYPTO_TICKERS.has(ticker) && !STABLECOIN_TICKERS.has(ticker);

  const historyColumns = useMemo(() => {
    if (history.length === 0) return [];
    const allKeys = new Set();
    history.slice(0, 3).forEach(h => Object.keys(h.prices || {}).forEach(k => allKeys.add(k)));
    return Array.from(allKeys).slice(0, 6);
  }, [history]);

  return (
    <div className="admin-section animate-fade-in">
      <div className="admin-section-header">
        <div>
          <h2 className="admin-section-title">🗂 Bảng giá Hệ thống</h2>
          <p className="admin-section-subtitle">
            Quản lý giá toàn bộ thị trường. Mọi tài sản tính theo VNĐ.
            Crypto hiện thêm hint USD = VNĐ ÷ USDT rate.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="admin-card">
        <div className="admin-toolbar">
          <div className="admin-toolbar-left">
            <Calendar size={16} />
            <input
              type="date"
              className="form-input form-input-sm"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
            />
            {usdtRate > 0 && (
              <span className="admin-rate-badge">
                💱 USDT = {formatNum(usdtRate)} VNĐ
              </span>
            )}
          </div>
          <div className="admin-toolbar-right">
            <button
              className="btn-glass btn-sm"
              onClick={handleFetchAPI}
              disabled={fetching}
            >
              {fetching ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
              Lấy giá từ API
            </button>
            <button
              className="btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={14} />
              {saving ? 'Đang lưu...' : 'Lưu bảng giá'}
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className={`admin-status-msg ${statusMsg.type === 'error' ? 'admin-status-error' : 'admin-status-success'}`}>
            {statusMsg.text}
          </div>
        )}
      </div>

      {/* Price Grid */}
      <div className="admin-card">
        <div className="admin-price-header">
          <h3 className="admin-card-title">Nhập giá thủ công</h3>
          <button
            className="btn-glass btn-xs"
            onClick={() => {
              const ticker = prompt('Nhập mã ticker (VD: FUEVND, VHM):');
              if (ticker?.trim()) {
                setPrices(p => ({ ...p, [ticker.trim().toUpperCase()]: 0 }));
              }
            }}
          >
            <Plus size={12} /> Thêm mã
          </button>
        </div>

        <div className="admin-price-grid">
          {tickerList.map(ticker => {
            const priceVND = prices[ticker] || 0;
            const cryptoHint = isCrypto(ticker) && usdtRate > 0
              ? formatUSD(vndToUSD(priceVND, usdtRate))
              : null;

            return (
              <div key={ticker} className="admin-price-item">
                <div className="admin-price-item-header">
                  <span className="admin-price-ticker">{ticker}</span>
                  {STABLECOIN_TICKERS.has(ticker) && (
                    <span className="admin-badge admin-badge--blue">Stablecoin</span>
                  )}
                  {isCrypto(ticker) && (
                    <span className="admin-badge admin-badge--orange">Crypto</span>
                  )}
                </div>
                <div className="admin-price-item-input-wrap">
                  <input
                    type="number"
                    step="any"
                    className="form-input admin-price-input"
                    value={priceVND || ''}
                    onChange={e => setPrices(p => ({
                      ...p,
                      [ticker]: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0"
                  />
                  <span className="admin-price-unit">VNĐ</span>
                </div>
                {priceVND > 0 && (
                  <span className="admin-price-vnd-hint">
                    {formatNum(priceVND)}&nbsp;VNĐ
                  </span>
                )}
                {cryptoHint && (
                  <span className="admin-price-usd-hint">≈ {cryptoHint}</span>
                )}
              </div>
            );
          })}
        </div>

        {tickerList.length === 0 && (
          <div className="admin-empty-state">
            <AlertCircle size={40} />
            <p>Chưa có dữ liệu giá. Nhấn "Lấy giá từ API" hoặc thêm mã thủ công.</p>
          </div>
        )}
      </div>

      {/* History Table */}
      {history.length > 0 && (
        <div className="admin-card">
          <h3 className="admin-card-title">📅 Lịch sử bảng giá</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  {historyColumns.map(col => (
                    <th key={col} className="text-right">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 15).map(entry => (
                  <tr
                    key={entry.date}
                    className="table-row-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleDateChange(entry.date)}
                  >
                    <td className="td-date">{entry.date}</td>
                    {historyColumns.map(col => (
                      <td key={col} className="text-right td-mono">
                        {entry.prices?.[col] ? formatNum(entry.prices[col]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
