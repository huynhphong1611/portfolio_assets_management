import React, { useState, useMemo } from 'react';
import { Save, RefreshCw, Calendar, BarChart3, Loader2 } from 'lucide-react';
import { saveDailyPrices, getLatestDailyPrices, batchUpdateMarketPrices } from '../services/firestoreService';
import { formatNum } from '../utils/formatters';

const PRICE_CATEGORIES = [
  { key: 'USDT', label: 'USDT / VNĐ', unit: 'VNĐ', category: 'Tỷ giá', defaultPrice: 26500 },
  { key: 'GOLD', label: 'Vàng SJC / Chỉ', unit: 'VNĐ', category: 'Vàng', defaultPrice: 17650000 },
  { key: 'PAXG', label: 'PAXG / USDT', unit: 'USDT', category: 'Vàng', defaultPrice: 3200 },
  { key: 'VFF', label: 'VFF (Quỹ TP VinaCapital)', unit: 'VNĐ/CCQ', category: 'Trái phiếu', defaultPrice: 25800 },
  { key: 'DCBF', label: 'DCBF (Dragon Capital Bond)', unit: 'VNĐ/CCQ', category: 'Trái phiếu', defaultPrice: 29300 },
  { key: 'DCIP', label: 'DCIP (Dragon Capital IP)', unit: 'VNĐ/CCQ', category: 'Trái phiếu', defaultPrice: 12000 },
  { key: 'FUEVN100', label: 'FUEVN100 (ETF VN100)', unit: 'VNĐ/CCQ', category: 'Cổ phiếu', defaultPrice: 25500 },
  { key: 'FUEVFVND', label: 'FUEVFVND (ETF VN Diamond)', unit: 'VNĐ/CCQ', category: 'Cổ phiếu', defaultPrice: 37300 },
  { key: 'VESAF', label: 'VESAF (VinaCapital Equity)', unit: 'VNĐ/CCQ', category: 'Cổ phiếu', defaultPrice: 36000 },
  { key: 'DCDS', label: 'DCDS (Dragon Capital DS)', unit: 'VNĐ/CCQ', category: 'Cổ phiếu', defaultPrice: 108000 },
  { key: 'CMCP', label: 'CMCP (Crypto Mix)', unit: 'USDT', category: 'Crypto', defaultPrice: 0.55 },
];

export default function PriceManager({ dailyPrices = [], apiEnabled = false }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load prices for selected date or latest
  const loadPrices = async () => {
    // Check if we have prices for this date
    const existing = dailyPrices.find(dp => dp.date === selectedDate);
    if (existing && existing.prices) {
      setPrices(existing.prices);
      setLoaded(true);
      return;
    }

    // Otherwise load latest
    const latest = await getLatestDailyPrices();
    if (latest?.prices) {
      setPrices(latest.prices);
    } else {
      // Use defaults
      const defaults = {};
      PRICE_CATEGORIES.forEach(p => { defaults[p.key] = p.defaultPrice; });
      setPrices(defaults);
    }
    setLoaded(true);
  };

  // Auto-load on mount
  useMemo(() => { loadPrices(); }, [selectedDate, dailyPrices.length]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save to dailyPrices collection
      await saveDailyPrices(selectedDate, prices);

      // 2. Sync to marketPrices collection so portfolio P&L recalculates
      const marketPricesMap = {};
      PRICE_CATEGORIES.forEach(item => {
        if (prices[item.key]) {
          if (item.key === 'USDT') {
            marketPricesMap[item.key] = { price: 1, exchangeRate: prices[item.key] };
          } else if (item.key === 'GOLD' || item.key === 'PAXG') {
            marketPricesMap[item.key] = { price: prices[item.key] };
          } else {
            marketPricesMap[item.key] = { price: prices[item.key] };
          }
        }
      });
      await batchUpdateMarketPrices(marketPricesMap);

      alert('✅ Đã lưu bảng giá ngày ' + selectedDate + ' và cập nhật giá thị trường.');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu giá.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchAPI = async () => {
    if (!apiEnabled) {
      alert('API proxy chưa được bật. Kiểm tra docker-compose và service api.');
      return;
    }
    setFetching(true);
    try {
      // Fetch VN stock prices from our Python API proxy
      const symbols = ['FUEVN100', 'FUEVFVND', 'VESAF', 'DCDS', 'DCBF', 'DCIP', 'VFF'];
      const response = await fetch(`/api/prices/stocks?symbols=${symbols.join(',')}`);
      if (!response.ok) throw new Error('API không phản hồi');
      const data = await response.json();

      const newPrices = { ...prices };
      data.forEach(item => {
        if (item.price) newPrices[item.symbol] = item.price;
      });
      setPrices(newPrices);
      alert('✅ Đã lấy giá từ vnstock API');
    } catch (err) {
      console.error(err);
      alert('❌ Lỗi khi gọi API: ' + err.message);
    } finally {
      setFetching(false);
    }
  };

  // Group by category
  const categories = useMemo(() => {
    const groups = {};
    PRICE_CATEGORIES.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, []);

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Bảng giá hàng ngày</h2>
          <p className="section-subtitle">
            Nhập giá tài sản theo ngày. Nếu không nhập, hệ thống dùng giá gần nhất.
          </p>
        </div>
      </div>

      {/* Date selector + actions */}
      <div className="price-toolbar glass-card">
        <div className="price-date-picker">
          <Calendar size={16} />
          <input
            type="date"
            className="form-input form-input-sm"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setLoaded(false); }}
          />
        </div>
        <div className="price-actions">
          <button
            className="btn-glass btn-sm"
            onClick={handleFetchAPI}
            disabled={fetching}
            title={apiEnabled ? 'Lấy giá CK Việt Nam từ vnstock' : 'API proxy chưa bật'}
          >
            {fetching ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            Lấy giá từ API
          </button>
          <button className="btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Đang lưu...' : 'Lưu bảng giá'}
          </button>
        </div>
      </div>

      {/* Price Entry Grid */}
      <div className="price-categories">
        {Object.entries(categories).map(([category, items]) => (
          <div key={category} className="price-category glass-card">
            <h3 className="price-category-title">{category}</h3>
            <div className="price-items">
              {items.map(item => (
                <div key={item.key} className="price-item">
                  <div className="price-item-label">
                    <span className="price-item-name">{item.label}</span>
                    <span className="price-item-unit">{item.unit}</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    className="form-input price-item-input"
                    value={prices[item.key] || ''}
                    onChange={e => setPrices(p => ({ ...p, [item.key]: parseFloat(e.target.value) || 0 }))}
                    placeholder={String(item.defaultPrice)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent prices history */}
      {dailyPrices.length > 0 && (
        <div className="glass-card section-card">
          <h3 className="card-title">Lịch sử nhập giá gần đây</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th className="text-right">USDT</th>
                  <th className="text-right">Vàng SJC</th>
                  <th className="text-right">VFF</th>
                  <th className="text-right">FUEVN100</th>
                  <th className="text-right">CMCP</th>
                </tr>
              </thead>
              <tbody>
                {dailyPrices.slice(0, 10).map(dp => (
                  <tr key={dp.id} className="table-row-hover" onClick={() => { setSelectedDate(dp.date); setLoaded(false); }} style={{ cursor: 'pointer' }}>
                    <td className="td-date">{dp.date}</td>
                    <td className="text-right td-mono">{dp.prices?.USDT ? formatNum(dp.prices.USDT) : '—'}</td>
                    <td className="text-right td-mono">{dp.prices?.GOLD ? formatNum(dp.prices.GOLD) : '—'}</td>
                    <td className="text-right td-mono">{dp.prices?.VFF ? formatNum(dp.prices.VFF) : '—'}</td>
                    <td className="text-right td-mono">{dp.prices?.FUEVN100 ? formatNum(dp.prices.FUEVN100) : '—'}</td>
                    <td className="text-right td-mono">{dp.prices?.CMCP ? formatNum(dp.prices.CMCP) : '—'}</td>
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
