import React, { useState, useMemo } from 'react';
import { Save, RefreshCw, Calendar, BarChart3, Loader2 } from 'lucide-react';
import { apiSaveDailyPrices, apiGetLatestDailyPrices, apiSaveMarketPrices } from '../services/api';
import { formatNum } from '../utils/formatters';

/**
 * Base tickers that always appear (exchange rates, gold).
 * Additional tickers are derived from the user's actual portfolio transactions.
 */
const BASE_ITEMS = [
  { key: 'USDT', label: 'USDT / VNĐ', unit: 'VNĐ', category: 'Tỷ giá', defaultPrice: 26500 },
  { key: 'USDC', label: 'USDC / VNĐ', unit: 'VNĐ', category: 'Tỷ giá', defaultPrice: 26500 },
  { key: 'GOLD', label: 'Vàng SJC / Lượng', unit: 'VNĐ', category: 'Vàng', defaultPrice: 17650000 },
];

/**
 * Map assetClass from transactions to price-board categories.
 */
const ASSET_CLASS_TO_CATEGORY = {
  'Trái phiếu': 'Trái phiếu',
  'Cổ phiếu': 'Cổ phiếu',
  'Tài sản mã hóa': 'Crypto',
  'Vàng': 'Vàng',
  'Tiền mặt USD': 'Tỷ giá',
  'Tiền mặt VNĐ': 'Tiền mặt',
};

const CRYPTO_UNIT = 'USDT';
const VND_UNIT = 'VNĐ/CCQ';

/**
 * Build the dynamic price item list from transactions.
 */
function buildPriceItems(transactions = []) {
  const tickerMap = {};

  // Extract unique tickers from transactions (skip cash deposits)
  transactions.forEach(tx => {
    const ticker = tx.ticker;
    if (!ticker || ticker === 'VNĐ' || ticker === 'USDT' || ticker === 'USDC') return;
    if (tickerMap[ticker]) return;

    const assetClass = tx.assetClass || '';
    const category = ASSET_CLASS_TO_CATEGORY[assetClass] || 'Khác';
    // Specific gold-backed tokens that trade on crypto exchanges (priced in USDT)
    const CRYPTO_GOLD_TICKERS = new Set(['PAXG', 'XAUT']);
    const isCrypto = assetClass === 'Tài sản mã hóa' || CRYPTO_GOLD_TICKERS.has(ticker);

    tickerMap[ticker] = {
      key: ticker,
      label: ticker,
      unit: isCrypto ? CRYPTO_UNIT : VND_UNIT,
      category,
      defaultPrice: 0,
    };
  });

  // Merge base items + portfolio items, avoid duplicates
  const all = [...BASE_ITEMS];
  Object.values(tickerMap).forEach(item => {
    if (!all.find(b => b.key === item.key)) {
      all.push(item);
    }
  });

  return all;
}

export default function PriceManager({ dailyPrices = [], transactions = [], apiEnabled = false, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [prices, setPrices] = useState({});
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Build dynamic price items from transactions
  const priceItems = useMemo(() => buildPriceItems(transactions), [transactions]);

  // Load prices for selected date or latest
  const loadPrices = async () => {
    const sanitizePrices = (p) => {
      const sanitized = { ...p };
      ['USDT', 'USDC'].forEach(coin => {
        if (sanitized[coin] && sanitized[coin] < 10000) sanitized[coin] = 25500;
      });
      return sanitized;
    };

    const existing = dailyPrices.find(dp => dp.date === selectedDate);
    if (existing && existing.prices) {
      setPrices(sanitizePrices(existing.prices));
      setLoaded(true);
      return;
    }

    const latest = await apiGetLatestDailyPrices();
    if (latest?.prices) {
      setPrices(sanitizePrices(latest.prices));
    } else {
      const defaults = {};
      priceItems.forEach(p => { if (p.defaultPrice) defaults[p.key] = p.defaultPrice; });
      setPrices(sanitizePrices(defaults));
    }
    setLoaded(true);
  };

  // Auto-load on mount / date change
  useMemo(() => { loadPrices(); }, [selectedDate, dailyPrices.length, priceItems.length]);

  const handleSave = async (pricesToSave = prices, isAutoSave = false) => {
    setSaving(true);
    try {
      await apiSaveDailyPrices(selectedDate, pricesToSave);

      // Sync to marketPrices
      const marketPricesMap = {};
      const stablecoinKeys = new Set(['USDT', 'USDC']);
      priceItems.forEach(item => {
        if (pricesToSave[item.key]) {
          if (stablecoinKeys.has(item.key)) {
            marketPricesMap[item.key] = { price: 1, exchangeRate: pricesToSave[item.key] };
          } else {
            marketPricesMap[item.key] = { price: pricesToSave[item.key] };
          }
        }
      });
      await apiSaveMarketPrices(marketPricesMap);

      if (onUpdate) onUpdate();
      if (!isAutoSave) {
        alert('✅ Đã lưu bảng giá ngày ' + selectedDate + ' và cập nhật giá thị trường.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu giá.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchAPI = async () => {
    if (!apiEnabled) {
      alert('API chưa được bật.');
      return;
    }
    setFetching(true);
    try {
      const newPrices = { ...prices };
      let hasRateLimit = false;

      // 1. Fetch USDT & USDC VND rates from CoinGecko via backend
      for (const stablecoin of ['USDT', 'USDC']) {
        try {
          const rateResp = await fetch(`/api/prices/stablecoin-rate?symbol=${stablecoin}`);
          if (rateResp.ok) {
            const rateData = await rateResp.json();
            if (rateData.success && rateData.data?.price) {
              newPrices[stablecoin] = rateData.data.price;
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch ${stablecoin} rate:`, e);
        }
      }

      // 2. Fetch GOLD SJC price from vang.today via backend
      try {
        const goldResp = await fetch('/api/prices/gold-sjc');
        if (goldResp.ok) {
          const goldData = await goldResp.json();
          if (goldData.success && goldData.data?.price) {
            newPrices['GOLD'] = goldData.data.price;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch GOLD SJC price:', e);
      }

      // 3. Fetch all other tickers (stocks, funds, crypto) via batch API
      const symbols = priceItems
        .filter(p => p.key !== 'USDT' && p.key !== 'USDC' && p.key !== 'GOLD')
        .map(p => p.key);

      if (symbols.length > 0) {
        const response = await fetch(`/api/prices/stocks?symbols=${symbols.join(',')}&target_date=${selectedDate}`);
        if (!response.ok) throw new Error('API không phản hồi');
        const data = await response.json();

        data.forEach(item => {
          if (item.error && item.error.includes('RATE_LIMIT_ERROR')) {
            hasRateLimit = true;
          }
          if (item.price) newPrices[item.symbol] = item.price;
        });
      }

      setPrices(newPrices);
      await handleSave(newPrices, true);

      if (hasRateLimit) {
        alert('⚠️ API đạt giới hạn tải dữ liệu (Rate Limit). Một số mã bị thiếu.\n✅ Đối với các mã lấy được, hệ thống ĐÃ TỰ ĐỘNG LƯU.');
      } else {
        alert('✅ Đã lấy giá tự động từ API và TỰ ĐỘNG LƯU bảng giá thành công!');
      }
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
    priceItems.forEach(p => {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    });
    return groups;
  }, [priceItems]);

  // Dynamic history columns (top 6 tickers)
  const historyColumns = useMemo(() => {
    const cols = priceItems.slice(0, 6).map(p => p.key);
    return cols;
  }, [priceItems]);

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Bảng giá hàng ngày</h2>
          <p className="section-subtitle">
            Tự động lấy danh sách mã từ danh mục đầu tư. Nhập giá hoặc lấy từ API.
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
            title="Lấy giá tự động từ vnstock & CoinGecko"
          >
            {fetching ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            Lấy giá từ API
          </button>
          <button className="btn-primary btn-sm" onClick={() => handleSave()} disabled={saving}>
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
                    placeholder={item.defaultPrice ? String(item.defaultPrice) : '0'}
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
                  {historyColumns.map(col => (
                    <th key={col} className="text-right">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dailyPrices.slice(0, 10).map(dp => (
                  <tr key={dp.id} className="table-row-hover" onClick={() => { setSelectedDate(dp.date); setLoaded(false); }} style={{ cursor: 'pointer' }}>
                    <td className="td-date">{dp.date}</td>
                    {historyColumns.map(col => (
                      <td key={col} className="text-right td-mono">
                        {dp.prices?.[col] ? formatNum(dp.prices[col]) : '—'}
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
