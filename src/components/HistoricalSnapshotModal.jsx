import React, { useState } from 'react';
import { X, Calendar, Loader2 } from 'lucide-react';
import { apiBackfillSnapshots } from '../services/api';

export default function HistoricalSnapshotModal({ onClose, onSuccess }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overwrite, setOverwrite] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate) {
      setError('Vui lòng chọn ngày bắt đầu.');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const res = await apiBackfillSnapshots(startDate, endDate || startDate, overwrite);
      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi tạo snapshot lịch sử.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-fade-in" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Snapshot Lịch Sử</h2>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <p className="section-subtitle" style={{ marginBottom: '1.5rem' }}>
            Hệ thống sẽ tái hiện lại danh mục của bạn tại thời điểm trong quá khứ và lưu thành snapshot để vẽ biểu đồ.
          </p>

          {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="form-group">
            <label className="form-label">Ngày bắt đầu</label>
            <div className="input-with-icon">
              <Calendar size={16} className="input-icon" />
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ngày kết thúc (không bắt buộc)</label>
            <div className="input-with-icon">
              <Calendar size={16} className="input-icon" />
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                placeholder="Nếu để trống, chỉ quét 1 ngày bắt đầu"
              />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Nếu để trống, hệ thống chỉ chạy cho 1 ngày bắt đầu.
            </p>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem' }}>
            <input 
              type="checkbox" 
              id="overwrite" 
              checked={overwrite} 
              onChange={(e) => setOverwrite(e.target.checked)} 
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="overwrite" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
              Ghi đè nếu snapshot đã tồn tại
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <Calendar size={16} />}
              {loading ? 'Đang chạy...' : 'Chạy Snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
