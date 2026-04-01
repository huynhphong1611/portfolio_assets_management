import React, { useState } from 'react';
import { X, ArrowRightLeft, TrendingUp, TrendingDown, Coins, Banknote, BarChart3 } from 'lucide-react';
import { addTransaction } from '../services/firestoreService';

const ASSET_TYPES = [
  { value: 'Tiền mặt VNĐ', label: 'Tiền mặt VNĐ', icon: '💵' },
  { value: 'Tiền mặt USD', label: 'Tiền mặt USD (USDT)', icon: '💲' },
  { value: 'Trái phiếu', label: 'Trái phiếu / CCQ TP', icon: '📄' },
  { value: 'Cổ phiếu', label: 'Cổ phiếu / CCQ CP', icon: '📈' },
  { value: 'Tài sản mã hóa', label: 'Crypto / Tài sản mã hóa', icon: '₿' },
  { value: 'Vàng', label: 'Vàng', icon: '🥇' },
];

const TX_TYPES = [
  { value: 'Nạp tiền', label: 'Nạp tiền', color: 'emerald', icon: <TrendingUp size={16} /> },
  { value: 'Mua', label: 'Mua', color: 'blue', icon: <TrendingUp size={16} /> },
  { value: 'Bán', label: 'Bán', color: 'rose', icon: <TrendingDown size={16} /> },
];

const CURRENCIES = ['VNĐ', 'USDT'];

const initialFormState = {
  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', ''),
  transactionType: 'Mua',
  assetClass: 'Cổ phiếu',
  ticker: '',
  quantity: '',
  unitPrice: '',
  currency: 'VNĐ',
  exchangeRate: '1',
  storage: '',
  notes: '',
};

export default function AddTransactionModal({ isOpen, onClose }) {
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const calculatedTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unitPrice) || 0;
    const rate = parseFloat(form.exchangeRate) || 1;
    return qty * price * rate;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unitPrice) || 0;
      const rate = parseFloat(form.exchangeRate) || 1;
      const total = qty * price * rate;

      const txData = {
        date: form.date || new Date().toLocaleDateString('en-GB').replace(/\//g, '/') + ' ' + new Date().toTimeString().slice(0, 8),
        transactionType: form.transactionType,
        assetClass: form.assetClass,
        ticker: form.ticker.toUpperCase(),
        quantity: form.transactionType === 'Bán' ? -Math.abs(qty) : Math.abs(qty),
        unitPrice: price,
        currency: form.currency,
        exchangeRate: rate,
        costBasisValue: 0,
        totalVND: total,
        pnlVND: 0,
        pnlPercent: 0,
        storage: form.storage,
        notes: form.notes,
      };

      await addTransaction(txData);
      setForm(initialFormState);
      onClose();
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Lỗi khi thêm giao dịch. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-icon">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h2 className="modal-title">Ghi nhận Giao dịch mới</h2>
              <p className="modal-subtitle">Thêm giao dịch vào nhật ký đầu tư</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Transaction Type Selector */}
          <div className="form-section">
            <label className="form-label">Loại giao dịch</label>
            <div className="tx-type-grid">
              {TX_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={`tx-type-btn ${form.transactionType === type.value ? `tx-type-btn--active tx-type-btn--${type.color}` : ''}`}
                  onClick={() => handleChange('transactionType', type.value)}
                >
                  {type.icon}
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Asset Type Row */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Ngày giờ giao dịch</label>
              <input
                type="text"
                className="form-input"
                value={form.date}
                onChange={e => handleChange('date', e.target.value)}
                placeholder="dd/mm/yyyy HH:mm:ss"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Loại tài sản</label>
              <select
                className="form-select"
                value={form.assetClass}
                onChange={e => handleChange('assetClass', e.target.value)}
              >
                {ASSET_TYPES.map(at => (
                  <option key={at.value} value={at.value}>{at.icon} {at.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Ticker & Storage */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Mã tài sản (Ticker)</label>
              <input
                type="text"
                className="form-input"
                value={form.ticker}
                onChange={e => handleChange('ticker', e.target.value)}
                placeholder="VD: VFF, USDT, CMCP..."
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nơi lưu trữ</label>
              <input
                type="text"
                className="form-input"
                value={form.storage}
                onChange={e => handleChange('storage', e.target.value)}
                placeholder="VD: Fmarket, SSI, Binance..."
              />
            </div>
          </div>

          {/* Quantity, Unit Price, Currency, Exchange Rate */}
          <div className="form-row-4">
            <div className="form-group">
              <label className="form-label">Số lượng</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.quantity}
                onChange={e => handleChange('quantity', e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Đơn giá</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.unitPrice}
                onChange={e => handleChange('unitPrice', e.target.value)}
                placeholder="0"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Loại tiền</label>
              <select
                className="form-select"
                value={form.currency}
                onChange={e => handleChange('currency', e.target.value)}
              >
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tỷ giá → VNĐ</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={form.exchangeRate}
                onChange={e => handleChange('exchangeRate', e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          {/* Calculated Total */}
          <div className="form-total-box">
            <span className="form-total-label">Thành tiền (VNĐ)</span>
            <span className="form-total-value">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculatedTotal())}
            </span>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">
              Ghi chú
              <span className="form-label-hint">(Trigger / Target / Invalidation Point)</span>
            </label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder="VD: DCA hàng tháng theo kế hoạch..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner"></span>
                  Đang lưu...
                </>
              ) : (
                <>Thêm Giao dịch</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
