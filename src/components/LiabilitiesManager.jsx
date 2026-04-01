import React, { useState } from 'react';
import { PlusCircle, Trash2, Pencil, X, AlertTriangle, CreditCard } from 'lucide-react';
import { addLiability, updateLiability, deleteLiability } from '../services/firestoreService';
import { formatVND } from '../utils/formatters';

const LIABILITY_TYPES = [
  { value: 'Vay ngân hàng', label: '🏦 Vay ngân hàng' },
  { value: 'Vay cá nhân', label: '🤝 Vay cá nhân' },
  { value: 'Thẻ tín dụng', label: '💳 Thẻ tín dụng' },
  { value: 'Trả góp', label: '📱 Trả góp' },
  { value: 'Khác', label: '📋 Khác' },
];

export default function LiabilitiesManager({ liabilities = [] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', amount: '', type: 'Vay cá nhân', interestRate: '', dueDate: '', notes: '' });

  const totalDebt = liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const handleAdd = async () => {
    if (!form.name || !form.amount) return;
    try {
      await addLiability({
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        type: form.type,
        interestRate: parseFloat(form.interestRate) || 0,
        dueDate: form.dueDate,
        notes: form.notes,
      });
      setForm({ name: '', amount: '', type: 'Vay cá nhân', interestRate: '', dueDate: '', notes: '' });
      setIsAdding(false);
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (id) => {
    if (!form.name || !form.amount) return;
    try {
      await updateLiability(id, {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
        type: form.type,
        interestRate: parseFloat(form.interestRate) || 0,
        dueDate: form.dueDate,
        notes: form.notes,
      });
      setEditingId(null);
      setForm({ name: '', amount: '', type: 'Vay cá nhân', interestRate: '', dueDate: '', notes: '' });
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa khoản nợ này?')) return;
    await deleteLiability(id);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name, amount: String(item.amount), type: item.type || 'Khác', interestRate: String(item.interestRate || ''), dueDate: item.dueDate || '', notes: item.notes || '' });
    setIsAdding(false);
  };

  const renderForm = (isEdit, itemId) => (
    <div className="liability-form">
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Tên khoản nợ</label>
          <input className="form-input form-input-sm" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Vay mua nhà..." />
        </div>
        <div className="form-group">
          <label className="form-label">Số tiền (VNĐ)</label>
          <input type="number" className="form-input form-input-sm" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
        </div>
      </div>
      <div className="form-row-2">
        <div className="form-group">
          <label className="form-label">Loại nợ</label>
          <select className="form-select form-select-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
            {LIABILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Lãi suất (%/năm)</label>
          <input type="number" step="0.1" className="form-input form-input-sm" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))} placeholder="0" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Ghi chú</label>
        <input className="form-input form-input-sm" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Ghi chú thêm..." />
      </div>
      <div className="liability-form-actions">
        <button className="btn-primary btn-sm" onClick={() => isEdit ? handleUpdate(itemId) : handleAdd()}>
          {isEdit ? 'Lưu' : 'Thêm nợ'}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => { setIsAdding(false); setEditingId(null); }}>Hủy</button>
      </div>
    </div>
  );

  return (
    <div className="liabilities-manager">
      <div className="liabilities-header">
        <div>
          <h4 className="liabilities-title"><AlertTriangle size={18} /> Các khoản Nợ</h4>
          <p className="liabilities-subtitle">Quản lý các khoản nợ, vay để tính tài sản ròng chính xác.</p>
        </div>
        <div className="liabilities-total">
          <span className="liabilities-total-label">Tổng nợ</span>
          <span className="liabilities-total-value color-down">{formatVND(totalDebt)}</span>
        </div>
      </div>

      <div className="liabilities-list">
        {liabilities.map(item => (
          <div key={item.id} className="liability-item">
            {editingId === item.id ? renderForm(true, item.id) : (
              <>
                <div className="liability-item-info">
                  <span className="liability-type-badge">{item.type || 'Khác'}</span>
                  <span className="liability-item-name">{item.name}</span>
                  {item.interestRate > 0 && <span className="liability-rate">{item.interestRate}%/năm</span>}
                </div>
                <div className="liability-item-actions">
                  <span className="liability-item-value color-down">{formatVND(item.amount)}</span>
                  <button className="btn-icon" onClick={() => startEdit(item)}><Pencil size={14} /></button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {isAdding ? renderForm(false) : (
        <button className="btn-glass add-external-btn" onClick={() => { setIsAdding(true); setEditingId(null); }}>
          <PlusCircle size={16} /> Thêm khoản nợ
        </button>
      )}
    </div>
  );
}
