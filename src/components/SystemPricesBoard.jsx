import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Plus, Search, Loader2 } from 'lucide-react';
import {
  apiGetSystemTickers,
  apiGetLatestDailyPrices,
  apiUserFetchLivePrices,
  apiAddSystemTicker
} from '../services/api';
import { formatNum, formatUSD, vndToUSD } from '../utils/formatters';

const CATEGORIES = [
  { key: 'stocks', label: 'Cổ phiếu & ETF' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'funds', label: 'Chứng chỉ quỹ mở' },
];

export default function SystemPricesBoard({ onRefreshData }) {
  const [tickersConfig, setTickersConfig] = useState({ stocks: [], crypto: [], funds: [] });
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [config, latestPrices] = await Promise.all([
        apiGetSystemTickers(),
        apiGetLatestDailyPrices()
      ]);
      setTickersConfig(config || { stocks: [], crypto: [], funds: [] });
      setPrices(latestPrices?.prices || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFetchLive = async () => {
    setFetching(true);
    setStatusMsg(null);
    try {
      const res = await apiUserFetchLivePrices();
      if (res && res.prices) {
        setPrices(res.prices);
        setStatusMsg({ type: 'success', text: `✅ Đã cập nhật ${res.fetched} mã. Portfolio đang quét lại...` });
        
        // Notify App.jsx to recalculate and perhaps snapshot.
        // The App.jsx auto-snapshots on changes to marketPrices if not snapshoted today.
        // Wait, onRefreshData calls fetchAllData() which will hit apiGetMarketPrices and dailyPrices!
        if (onRefreshData) {
          await onRefreshData(); 
        }
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: `❌ Lỗi: ${err.message}` });
    } finally {
      setFetching(false);
    }
  };

  const handleAddTicker = async () => {
    const raw = prompt('Nhập mã ticker muốn thêm (VD: VHM, BTC, VESAF):');
    if (!raw || !raw.trim()) return;
    
    const catChoice = prompt('Mã thuộc loại nào?\n1. Cổ phiếu/ETF\n2. Crypto\n3. Quỹ mở\n(Nhập 1, 2, hoặc 3)', '1');
    let category = 'stocks';
    if (catChoice === '2') category = 'crypto';
    if (catChoice === '3') category = 'funds';

    try {
      await apiAddSystemTicker(category, raw.trim().toUpperCase());
      alert(`✅ Đã thêm mã ${raw.trim().toUpperCase()} vào hệ thống!`);
      loadData();
    } catch (err) {
      alert(`❌ Lỗi thêm mã: ${err.message}`);
    }
  };

  const usdtRate = useMemo(() => prices['USDT'] || prices['USDC'] || 25500, [prices]);

  const allTickers = useMemo(() => {
    const list = [];
    ['stocks', 'crypto', 'funds'].forEach(cat => {
      if (tickersConfig[cat]) {
        tickersConfig[cat].forEach(t => {
          list.push({ ticker: t, category: cat });
        });
      }
    });
    // Add base stablecoins if not in crypto config
    ['USDT', 'USDC', 'GOLD'].forEach(t => {
      if (!list.find(x => x.ticker === t) && prices[t]) {
        list.unshift({ ticker: t, category: 'base' });
      }
    });
    return list;
  }, [tickersConfig, prices]);

  if (loading) return <div style={{position: 'relative', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}><Loader2 className="spin" size={30}/></div>;

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Mã Hỗ Trợ Hệ Thống</h2>
          <p className="section-subtitle">
            Hệ thống tự động cập nhật giá từ vnstock & CoinGecko.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-glass" onClick={handleAddTicker}>
            <Plus size={16} /> Thêm mã mới
          </button>
          <button className="btn-primary" onClick={handleFetchLive} disabled={fetching}>
            {fetching ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
            {fetching ? 'Đang tải...' : 'Làm mới & Tính lại DM'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`admin-status-msg ${statusMsg.type === 'error' ? 'admin-status-error' : 'admin-status-success'}`} style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: statusMsg.type === 'error' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: statusMsg.type === 'error' ? 'var(--color-rose-400)' : 'var(--color-emerald-400)', border: '1px solid currentColor' }}>
          {statusMsg.text}
        </div>
      )}

      <div className="glass-card section-card">
        <div className="portfolio-table-header">
          <h3 className="card-title">Giá thị trường tự động ({allTickers.length} mã)</h3>
          <div className="search-box search-box-sm">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Tìm mã..." 
              className="search-input" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã (Ticker)</th>
                <th>Phân loại</th>
                <th className="text-right">Giá (VNĐ)</th>
                <th className="text-right">Qui đổi (USD)</th>
              </tr>
            </thead>
            <tbody>
              {allTickers
                .filter(i => !searchTerm || i.ticker.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(item => {
                  const pVND = prices[item.ticker] || 0;
                  const isCrypto = item.category === 'crypto';
                  const isBase = item.category === 'base';
                  const usdHint = (isCrypto || isBase) && pVND > 0 
                                  ? formatUSD(vndToUSD(pVND, usdtRate)) 
                                  : '—';
                  
                  return (
                    <tr key={item.ticker} className="table-row-hover">
                      <td className="td-bold td-ticker">{item.ticker}</td>
                      <td className="td-meta" style={{ textTransform: 'capitalize' }}>{item.category === 'base' ? 'Tỷ giá / Hệ thống' : CATEGORIES.find(c => c.key === item.category)?.label}</td>
                      <td className="text-right td-mono" style={{ color: pVND > 0 ? 'var(--color-emerald-400)' : 'var(--text-secondary)' }}>
                        {pVND > 0 ? formatNum(pVND) : 'Không có giá'}
                      </td>
                      <td className="text-right td-mono td-muted">
                        {usdHint}
                      </td>
                    </tr>
                  )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
