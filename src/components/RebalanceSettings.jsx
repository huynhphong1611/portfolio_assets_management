import React, { useState } from 'react';
import { Save, RotateCcw, Settings2 } from 'lucide-react';
import { saveRebalanceTargets } from '../services/firestoreService';

const ASSET_CLASSES = [
  { key: 'Tiền mặt VNĐ', label: 'Tiền mặt VNĐ', icon: '💵' },
  { key: 'Tiền mặt USD', label: 'Tiền mặt USD', icon: '💲' },
  { key: 'Vàng', label: 'Vàng', icon: '🥇' },
  { key: 'Trái phiếu', label: 'Trái phiếu', icon: '📄' },
  { key: 'Cổ phiếu', label: 'Cổ phiếu', icon: '📈' },
  { key: 'Tài sản mã hóa', label: 'Crypto', icon: '₿' },
];

const DEFAULT_TARGETS = {
  "Tiền mặt VNĐ": 0,
  "Tiền mặt USD": 0,
  "Vàng": 10,
  "Trái phiếu": 60,
  "Cổ phiếu": 20,
  "Tài sản mã hóa": 10,
};

export default function RebalanceSettings({ currentTargets = DEFAULT_TARGETS, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [targets, setTargets] = useState({ ...currentTargets });
  const [saving, setSaving] = useState(false);

  const totalWeight = Object.values(targets).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01;

  const handleChange = (key, value) => {
    setTargets(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await saveRebalanceTargets(targets);
      setIsEditing(false);
      if (onSave) onSave(targets);
    } catch (error) {
      console.error('Error saving targets:', error);
      alert('Lỗi khi lưu. Thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTargets({ ...currentTargets });
  };

  if (!isEditing) {
    return (
      <button
        className="btn-glass btn-sm"
        onClick={() => setIsEditing(true)}
        title="Chỉnh sửa mục tiêu tỷ trọng"
      >
        <Settings2 size={16} />
        <span>Cài đặt tỷ trọng</span>
      </button>
    );
  }

  return (
    <div className="rebalance-settings glass-card">
      <div className="rebalance-settings-header">
        <h4 className="rebalance-settings-title">
          <Settings2 size={18} />
          Cài đặt Tỷ trọng Mục tiêu
        </h4>
        <span className={`rebalance-total-badge ${isValid ? 'badge-valid' : 'badge-invalid'}`}>
          Tổng: {totalWeight.toFixed(1)}%
        </span>
      </div>

      <div className="rebalance-inputs-grid">
        {ASSET_CLASSES.map(ac => (
          <div key={ac.key} className="rebalance-input-row">
            <span className="rebalance-input-label">
              {ac.icon} {ac.label}
            </span>
            <div className="rebalance-input-wrapper">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="rebalance-input"
                value={targets[ac.key] || 0}
                onChange={e => handleChange(ac.key, e.target.value)}
              />
              <span className="rebalance-input-suffix">%</span>
            </div>
          </div>
        ))}
      </div>

      {!isValid && (
        <div className="rebalance-warning">
          ⚠️ Tổng tỷ trọng phải bằng 100%. Hiện tại: {totalWeight.toFixed(1)}%
        </div>
      )}

      <div className="rebalance-actions">
        <button className="btn-ghost" onClick={() => { handleReset(); setIsEditing(false); }}>
          Hủy
        </button>
        <button className="btn-ghost" onClick={handleReset}>
          <RotateCcw size={14} />
          Reset
        </button>
        <button
          className="btn-primary btn-sm"
          onClick={handleSave}
          disabled={!isValid || saving}
        >
          <Save size={14} />
          {saving ? 'Đang lưu...' : 'Lưu tỷ trọng'}
        </button>
      </div>
    </div>
  );
}
