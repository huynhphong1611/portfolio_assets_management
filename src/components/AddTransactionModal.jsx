import React, { useState } from 'react';
import { X, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { apiAddTransaction, apiUpdateTransaction, apiUpdateFund } from '../services/api';

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

const now = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};

const initialFormState = {
  date: now(),
  transactionType: 'Mua',
  assetClass: 'Cổ phiếu',
  ticker: '',
  quantity: '',
  unitPrice: '',
  currency: 'VNĐ',
  exchangeRate: '1',
  storage: '',
  notes: '',
  fundId: '',
};

export default function AddTransactionModal({ isOpen, onClose, funds = [], onSuccess, transactionToEdit, portfolio = [] }) {
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        setForm({
          ...initialFormState,
          ...transactionToEdit,
          quantity: Math.abs(transactionToEdit.quantity), // remove negative sign for Bán
        });
      } else {
        setForm({ ...initialFormState, date: now() });
      }
    }
  }, [isOpen, transactionToEdit]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Auto-select fund based on asset class
      if (field === 'assetClass') {
        const matchedFund = funds.find(f => f.assetClass === value);
        if (matchedFund) next.fundId = matchedFund.id;
      }
      return next;
    });
  };

  const calculatedTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.unitPrice) || 0;
    const rate = parseFloat(form.exchangeRate) || 1;
    return qty * price * rate;
  };

  const selectedFund = funds.find(f => f.id === form.fundId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unitPrice) || 0;
      const rate = parseFloat(form.exchangeRate) || 1;
      const total = qty * price * rate;
      const oldTotal = transactionToEdit ? (Math.abs(transactionToEdit.totalVND) || 0) : 0;

      // Validate fund cash for "Mua"
      if (form.transactionType === 'Mua' && selectedFund) {
        const fundCash = parseFloat(selectedFund.cashBalance) || 0;
        if (!transactionToEdit) {
          if (total > fundCash) {
            alert(`⚠️ Quỹ "${selectedFund.name}" chỉ còn ${new Intl.NumberFormat('vi-VN').format(fundCash)} VNĐ tiền mặt.\nKhông đủ để mua ${new Intl.NumberFormat('vi-VN').format(total)} VNĐ.\n\nHãy nạp thêm tiền vào quỹ trước.`);
            setSaving(false);
            return;
          }
        } else {
          // If editing an existing transaction
          if (total > oldTotal) {
            const extraNeeded = total - oldTotal;
            if (extraNeeded > fundCash) {
              alert(`⚠️ Không đủ tiền! Quỹ chỉ còn ${new Intl.NumberFormat('vi-VN').format(fundCash)} VNĐ.\nBạn cần thêm ${new Intl.NumberFormat('vi-VN').format(extraNeeded)} VNĐ tiền mặt để tăng giá trị mua.`);
              setSaving(false);
              return;
            }
          }
        }
      }

      // Validate quantities for "Bán"
      if (form.transactionType === 'Bán') {
        const tickerStr = form.ticker.toUpperCase();
        const currentHolding = portfolio.find(p => p.ticker === tickerStr)?.qty || 0;
        
        const isSameTicker = transactionToEdit && (transactionToEdit.ticker || '').toUpperCase() === tickerStr;
        const oldQtyRefund = isSameTicker ? Math.abs(transactionToEdit.quantity || 0) : 0;
        
        const availableQty = currentHolding + oldQtyRefund;
        
        if (qty > availableQty) {
          alert(`⚠️ Số lượng bán vượt quá số lượng cổ phiếu đang có!\nHiện có thể bán tối đa: ${availableQty} (đã bao gồm giao dịch đang sửa).\nLượng nhập vào: ${qty}.`);
          setSaving(false);
          return;
        }
      }

      const txData = {
        date: form.date || now(),
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
        fundId: form.fundId || null,
        fundName: selectedFund?.name || null,
      };

      if (transactionToEdit) {
        await apiUpdateTransaction(transactionToEdit.id, txData);
        // Cash correction when keeping the same fund
        if (selectedFund && form.fundId === transactionToEdit.fundId) {
          const fundCash = parseFloat(selectedFund.cashBalance) || 0;
          let newCash = fundCash;
          const diff = oldTotal - total; // Positive if new total is smaller

          if (form.transactionType === 'Mua') {
             // If total < oldTotal (diff > 0), newCash = fundCash + diff (Refunds money)
             // If total > oldTotal (diff < 0), newCash = fundCash + diff (Deducts money)
             newCash = fundCash + diff;
          } else if (form.transactionType === 'Bán' || form.transactionType === 'Nạp tiền') {
             // In Bán/Nạp, oldTotal was ADDED to the fund originally.
             newCash = fundCash - diff; 

          }
          if (newCash !== fundCash && newCash >= 0) {
             await apiUpdateFund(selectedFund.id, { cashBalance: newCash });
          }
        }
      } else {
        await apiAddTransaction(txData);

        // Deduct/Add fund cash balance for NEW transactions
        if (selectedFund) {
          const fundCash = parseFloat(selectedFund.cashBalance) || 0;
          let newCash = fundCash;
          if (form.transactionType === 'Mua') {
            newCash = fundCash - total;
          } else if (form.transactionType === 'Bán' || form.transactionType === 'Nạp tiền') {
            newCash = fundCash + total;
          }
          await apiUpdateFund(selectedFund.id, { cashBalance: Math.max(0, newCash) });
        }
      }

      setForm({ ...initialFormState, date: now() });
      if (onSuccess) onSuccess();
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
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-icon"><ArrowRightLeft size={20} /></div>
            <div>
              <h2 className="modal-title">{transactionToEdit ? 'Sửa Giao dịch' : 'Ghi nhận Giao dịch mới'}</h2>
              <p className="modal-subtitle">{transactionToEdit ? 'Cập nhật lại thông tin giao dịch' : 'Thêm giao dịch vào nhật ký đầu tư'}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Transaction Type */}
          <div className="form-section">
            <label className="form-label">Loại giao dịch</label>
            <div className="tx-type-grid">
              {TX_TYPES.map(type => (
                <button key={type.value} type="button"
                  className={`tx-type-btn ${form.transactionType === type.value ? `tx-type-btn--active tx-type-btn--${type.color}` : ''}`}
                  onClick={() => handleChange('transactionType', type.value)}>
                  {type.icon} <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fund Selector */}
          <div className="form-group">
            <label className="form-label">Quỹ đầu tư <span className="form-label-hint">(Giao dịch thuộc quỹ nào?)</span></label>
            <select className="form-select" value={form.fundId} onChange={e => handleChange('fundId', e.target.value)} required>
              <option value="">— Chọn quỹ —</option>
              {funds.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} (Cash: {new Intl.NumberFormat('vi-VN').format(f.cashBalance || 0)} ₫)
                </option>
              ))}
            </select>
            {selectedFund && (
              <p className="form-hint-cash">
                💰 Tiền mặt trong quỹ: <strong>{new Intl.NumberFormat('vi-VN').format(selectedFund.cashBalance || 0)} ₫</strong>
                {form.transactionType === 'Mua' && !transactionToEdit && (
                  <>
                    {' — '}
                    <span style={{ color: calculatedTotal() > (selectedFund.cashBalance || 0) ? 'var(--color-rose-500)' : 'var(--color-emerald-500)' }}>
                      {calculatedTotal() > (selectedFund.cashBalance || 0) ? '⚠️ Không đủ tiền!' : '✅ Đủ tiền'}
                    </span>
                  </>
                )}
                {form.transactionType === 'Mua' && transactionToEdit && form.fundId === (transactionToEdit.fundId || transactionToEdit.fund_id) && (
                  <>
                    {' — '}
                    {(() => {
                      const fundCash = parseFloat(selectedFund.cashBalance) || 0;
                      const extraNeeded = calculatedTotal() - (Math.abs(transactionToEdit.totalVND) || 0);
                      if (extraNeeded > fundCash) {
                         return <span style={{ color: 'var(--color-rose-500)' }}>⚠️ Không đủ tiền bù thêm!</span>;
                      } else {
                         return <span style={{ color: 'var(--color-emerald-500)' }}>✅ Đủ tiền bù/sửa</span>;
                      }
                    })()}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Date & Asset Type */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Ngày giờ giao dịch</label>
              <input type="text" className="form-input" value={form.date} onChange={e => handleChange('date', e.target.value)} placeholder="dd/mm/yyyy HH:mm:ss" required />
            </div>
            <div className="form-group">
              <label className="form-label">Loại tài sản</label>
              <select className="form-select" value={form.assetClass} onChange={e => handleChange('assetClass', e.target.value)}>
                {ASSET_TYPES.map(at => <option key={at.value} value={at.value}>{at.icon} {at.label}</option>)}
              </select>
            </div>
          </div>

          {/* Ticker & Storage */}
          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Mã tài sản (Ticker)</label>
              <input type="text" className="form-input" value={form.ticker} onChange={e => handleChange('ticker', e.target.value)} placeholder="VD: VFF, USDT, CMCP..." required />
            </div>
            <div className="form-group">
              <label className="form-label">Nơi lưu trữ</label>
              <input type="text" className="form-input" value={form.storage} onChange={e => handleChange('storage', e.target.value)} placeholder="VD: Fmarket, SSI, Binance..." />
            </div>
          </div>

          {/* Quantity, Price, Currency, Rate */}
          <div className="form-row-4">
            <div className="form-group">
              <label className="form-label">Số lượng</label>
              <input type="number" step="any" className="form-input" value={form.quantity} onChange={e => handleChange('quantity', e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label className="form-label">Đơn giá</label>
              <input type="number" step="any" className="form-input" value={form.unitPrice} onChange={e => handleChange('unitPrice', e.target.value)} placeholder="0" required />
            </div>
            <div className="form-group">
              <label className="form-label">Loại tiền</label>
              <select className="form-select" value={form.currency} onChange={e => handleChange('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tỷ giá → VNĐ</label>
              <input type="number" step="any" className="form-input" value={form.exchangeRate} onChange={e => handleChange('exchangeRate', e.target.value)} placeholder="1" />
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
            <label className="form-label">Ghi chú <span className="form-label-hint">(Trigger / Target / Invalidation)</span></label>
            <textarea className="form-textarea" value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="VD: DCA hàng tháng..." rows={3} />
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><span className="spinner"></span> Đang lưu...</> : (transactionToEdit ? 'Cập nhật' : 'Thêm Giao dịch')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
