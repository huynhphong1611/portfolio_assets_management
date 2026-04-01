import React, { useState } from 'react';
import { PlusCircle, Trash2, X, Pencil, Building2, Coins } from 'lucide-react';
import { addExternalAsset, deleteExternalAsset, updateExternalAsset } from '../services/firestoreService';
import { formatVND } from '../utils/formatters';

const GROUPS = [
  { value: 'Thanh khoản', label: 'Thanh khoản cao', icon: '💰' },
  { value: 'Đầu tư', label: 'Đầu tư dài hạn', icon: '📊' },
];

export default function NetWorthExternalManager({ externalAssets = [] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', value: '', group: 'Thanh khoản' });

  const handleAdd = async () => {
    if (!form.name || !form.value) return;
    try {
      await addExternalAsset({
        name: form.name,
        value: parseFloat(form.value) || 0,
        group: form.group,
      });
      setForm({ name: '', value: '', group: 'Thanh khoản' });
      setIsAdding(false);
    } catch (err) {
      console.error('Error adding external asset:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa tài sản này?')) return;
    try {
      await deleteExternalAsset(id);
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleUpdate = async (id) => {
    if (!form.name || !form.value) return;
    try {
      await updateExternalAsset(id, {
        name: form.name,
        value: parseFloat(form.value) || 0,
        group: form.group,
      });
      setEditingId(null);
      setForm({ name: '', value: '', group: 'Thanh khoản' });
    } catch (err) {
      console.error('Error updating:', err);
    }
  };

  const startEdit = (asset) => {
    setEditingId(asset.id);
    setForm({ name: asset.name, value: asset.value.toString(), group: asset.group });
    setIsAdding(false);
  };

  const totalExternal = externalAssets.reduce((sum, a) => sum + (a.value || 0), 0);

  return (
    <div className="external-assets-manager">
      <div className="external-header">
        <div>
          <h4 className="external-title">
            <Building2 size={18} />
            Tài sản bên ngoài danh mục
          </h4>
          <p className="external-subtitle">
            Quản lý tài sản không nằm trong danh mục đầu tư (tiền gửi ngân hàng, vàng cưới, bất động sản...)
          </p>
        </div>
        <div className="external-total">
          <span className="external-total-label">Tổng</span>
          <span className="external-total-value">{formatVND(totalExternal)}</span>
        </div>
      </div>

      {/* Asset List */}
      <div className="external-list">
        {externalAssets.map(asset => (
          <div key={asset.id} className="external-item">
            {editingId === asset.id ? (
              <div className="external-edit-form">
                <input
                  className="form-input form-input-sm"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Tên tài sản"
                />
                <input
                  type="number"
                  className="form-input form-input-sm"
                  value={form.value}
                  onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="Giá trị (VNĐ)"
                />
                <select
                  className="form-select form-select-sm"
                  value={form.group}
                  onChange={e => setForm(p => ({ ...p, group: e.target.value }))}
                >
                  {GROUPS.map(g => (
                    <option key={g.value} value={g.value}>{g.icon} {g.label}</option>
                  ))}
                </select>
                <button className="btn-primary btn-xs" onClick={() => handleUpdate(asset.id)}>Lưu</button>
                <button className="btn-ghost btn-xs" onClick={() => setEditingId(null)}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="external-item-info">
                  <span className="external-item-group-badge">
                    {asset.group === 'Thanh khoản' ? '💰' : '📊'} {asset.group}
                  </span>
                  <span className="external-item-name">{asset.name}</span>
                </div>
                <div className="external-item-actions">
                  <span className="external-item-value">{formatVND(asset.value)}</span>
                  <button className="btn-icon" onClick={() => startEdit(asset)} title="Sửa">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(asset.id)} title="Xóa">
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add Form */}
      {isAdding ? (
        <div className="external-add-form">
          <input
            className="form-input form-input-sm"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="VD: TOPI không kì hạn, Tiền mặt VP Bank, Vàng cưới..."
          />
          <input
            type="number"
            className="form-input form-input-sm"
            value={form.value}
            onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
            placeholder="Giá trị (VNĐ)"
          />
          <select
            className="form-select form-select-sm"
            value={form.group}
            onChange={e => setForm(p => ({ ...p, group: e.target.value }))}
          >
            {GROUPS.map(g => (
              <option key={g.value} value={g.value}>{g.icon} {g.label}</option>
            ))}
          </select>
          <button className="btn-primary btn-sm" onClick={handleAdd}>Thêm</button>
          <button className="btn-ghost btn-sm" onClick={() => setIsAdding(false)}>Hủy</button>
        </div>
      ) : (
        <button className="btn-glass add-external-btn" onClick={() => { setIsAdding(true); setEditingId(null); }}>
          <PlusCircle size={16} />
          Thêm tài sản bên ngoài
        </button>
      )}
    </div>
  );
}
