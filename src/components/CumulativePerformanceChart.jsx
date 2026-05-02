import React, { useState, useEffect, useMemo } from 'react';
import { apiGetBenchmarkHistory } from '../services/api';
import LineChart from './charts/LineChart';

export default function CumulativePerformanceChart({ snapshots = [] }) {
  const [range, setRange] = useState(30); // 7, 30, 90, 365
  const [benchmarks, setBenchmarks] = useState({ VNINDEX: [], BTC: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchBenchmarks() {
      setLoading(true);
      try {
        const res = await apiGetBenchmarkHistory(3650);
        if (res) setBenchmarks(res);
      } catch (err) {
        console.error('Lỗi tải benchmark:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBenchmarks();
  }, []);

  const chartDatasets = useMemo(() => {
    // Determine start date based on range
    const now = new Date();
    // "Tất cả" → start from the user's first snapshot (= first transaction date)
    const firstSnapshotDate = snapshots.length > 0
      ? [...snapshots].sort((a, b) => a.date.localeCompare(b.date))[0].date
      : now.toISOString().slice(0, 10);
    const startDateStr = range === 'all'
      ? firstSnapshotDate
      : new Date(now.getTime() - range * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Filter data >= startDateStr
    const validSnapshots = snapshots
      .filter(s => s.date >= startDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    const validVnindex = (benchmarks.VNINDEX || [])
      .filter(s => s.date >= startDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    const validBtc = (benchmarks.BTC || [])
      .filter(s => s.date >= startDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get union of all dates
    const allDates = new Set([
      ...validSnapshots.map(s => s.date),
      ...validVnindex.map(s => s.date),
      ...validBtc.map(s => s.date)
    ]);
    const sortedDates = Array.from(allDates).sort();

    if (sortedDates.length === 0) return [];

    // ── Portfolio: dùng % lời/lỗ = (Value - Cost) / Cost * 100 ──
    // Điều này loại bỏ ảnh hưởng khi nạp/rút tiền (deposits don't inflate the chart).
    // "Hiệu suất" = tỷ suất lợi nhuận thực sự trên vốn đã đầu tư.
    //
    // Để so sánh công bằng với VN-Index và BTC (vốn cũng là % từ điểm đầu kỳ),
    // ta lấy PnL% của ngày đầu kỳ làm baseline và trừ đi, quy về 0%.
    const baseSnapshot = validSnapshots.length > 0 ? validSnapshots[0] : null;
    const basePnlPct = baseSnapshot
      ? (baseSnapshot.portfolioCost > 0
          ? ((baseSnapshot.portfolioValue - baseSnapshot.portfolioCost) / baseSnapshot.portfolioCost) * 100
          : 0)
      : 0;

    // VN-Index và BTC: cumulative % từ điểm đầu kỳ
    const baseVn  = validVnindex.length > 0 ? (validVnindex[0].close || 1) : 1;
    const baseBtc = validBtc.length > 0 ? (validBtc[0].close || 1) : 1;

    // Create maps for quick lookup
    const mapPtf = Object.fromEntries(
      validSnapshots.map(s => [
        s.date,
        s.portfolioCost > 0
          ? ((s.portfolioValue - s.portfolioCost) / s.portfolioCost) * 100
          : 0
      ])
    );
    const mapVn  = Object.fromEntries(validVnindex.map(s => [s.date, s.close || 0]));
    const mapBtc = Object.fromEntries(validBtc.map(s => [s.date, s.close || 0]));

    // Fill forward missing dates
    let lastPtfPct = basePnlPct;
    let lastVn  = baseVn;
    let lastBtc = baseBtc;

    const dataPtf = [];
    const dataVn  = [];
    const dataBtc = [];

    sortedDates.forEach(date => {
      lastPtfPct = mapPtf[date] ?? lastPtfPct;
      lastVn     = mapVn[date]  ?? lastVn;
      lastBtc    = mapBtc[date] ?? lastBtc;

      // Danh mục: % lời/lỗ trên vốn, trừ baseline đầu kỳ → so sánh tương đối
      dataPtf.push({
        x: date,
        y: parseFloat((lastPtfPct - basePnlPct).toFixed(2)),
        rawStr: (lastPtfPct >= 0 ? '+' : '') + lastPtfPct.toFixed(2) + '% so với vốn'
      });

      // VN-Index: % thay đổi từ điểm đầu kỳ
      dataVn.push({
        x: date,
        y: parseFloat((((lastVn / baseVn) - 1) * 100).toFixed(2)),
        rawStr: lastVn.toFixed(2) + ' pts'
      });

      // BTC: % thay đổi từ điểm đầu kỳ (USD)
      dataBtc.push({
        x: date,
        y: parseFloat((((lastBtc / baseBtc) - 1) * 100).toFixed(2)),
        rawStr: lastBtc.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      });
    });

    return [
      { label: 'Danh mục', data: dataPtf, color: '#6366f1', fill: false },
      { label: 'VN-Index', data: dataVn,  color: '#f59e0b', fill: false },
      { label: 'Bitcoin (USD)', data: dataBtc, color: '#10b981', fill: false }
    ];
  }, [snapshots, benchmarks, range]);


  return (
    <div className="glass-card section-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="card-title" style={{ margin: 0 }}>Hiệu suất Tích lũy (%)</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
             { label: '1 Tuần', val: 7 },
             { label: '1 Tháng', val: 30 },
             { label: '3 Tháng', val: 90 },
             { label: '1 Năm', val: 365 },
             { label: 'Tất cả', val: 'all' }
           ].map(r => (
            <button 
              key={r.val} 
              className={`btn-icon ${range === r.val ? 'tx-type-btn--active' : ''}`}
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: range === r.val ? 'var(--color-blue-100)' : 'transparent', color: range === r.val ? 'var(--color-blue-700)' : 'var(--text-color)' }}
              onClick={() => setRange(r.val)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      
      {loading ? (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Đang tải dữ liệu Market...</div>
      ) : chartDatasets.length > 0 && chartDatasets[0].data.length > 0 ? (
        <LineChart datasets={chartDatasets} height={300} yLabel="percent" />
      ) : (
        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Không đủ dữ liệu</div>
      )}
    </div>
  );
}
