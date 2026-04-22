import React, { useState } from 'react';
import { X, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { apiAddTransaction, apiUpdateTransaction } from '../services/api';

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
  { value: 'Mua',      label: 'Mua',      color: 'blue',    icon: <TrendingUp size={16} /> },
  { value: 'Bán',      label: 'Bán',      color: 'rose',    icon: <TrendingDown size={16} /> },
  { value: 'Rút tiền', label: 'Rút tiền', color: 'orange',  icon: <TrendingDown size={16} /> },
];

const CURRENCIES = ['VNĐ', 'USDT', 'USDC'];

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
  // withdrawal-only
  withdrawalAmount: '',
};

export default function AddTransactionModal({ isOpen, onClose, onSuccess, transactionToEdit, portfolio = [] }) {
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
      // Lock fields for cash-only transaction types
      if (field === 'transactionType') {
        if (value === 'Nạp tiền' || value === 'Rút tiền') {
          next.assetClass = 'Tiền mặt VNĐ';
          next.ticker     = '';
          next.currency   = 'VNĐ';
          next.exchangeRate = '1';
        }
      }
      return next;
    });
  };

  const isCashTx  = form.transactionType === 'Nạp tiền' || form.transactionType === 'Rút tiền';
  const isWithdraw = form.transactionType === 'Rút tiền';

  const calculatedTotal = () => {
    if (isWithdraw) return parseFloat(form.withdrawalAmount) || 0;
    const qty  = parseFloat(form.quantity)  || 0;
    const price = parseFloat(form.unitPrice) || 0;
    const rate  = parseFloat(form.exchangeRate) || 1;
    return qty * price * rate;
  };

  /** Realized P&L preview when selling */
  const realizedPreview = (() => {
    if (form.transactionType !== 'Bán') return null;
    const ticker = (form.ticker || '').toUpperCase();
    const holding = portfolio.find(p => p.ticker === ticker);
    if (!holding || !holding.avgCost) return null;
    const qty   = parseFloat(form.quantity) || 0;
    const price  = parseFloat(form.unitPrice) || 0;
    const rate   = parseFloat(form.exchangeRate) || 1;
    const salePriceVND = price * rate;
    const pnl    = (salePriceVND - holding.avgCost) * qty;
    const pnlPct = holding.avgCost > 0 ? ((salePriceVND - holding.avgCost) / holding.avgCost) * 100 : 0;
    return { pnl, pnlPct, avgCost: holding.avgCost };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const qty = parseFloat(form.quantity) || 0;
      const price = parseFloat(form.unitPrice) || 0;
      const rate = parseFloat(form.exchangeRate) || 1;
      const total = qty * price * rate;

      // ── Validate Rut tien ──
      if (isWithdraw) {
        const withdrawal = parseFloat(form.withdrawalAmount) || 0;
        if (withdrawal <= 0) {
          alert('⚠️ Vui lòng nhập số tiền rút hợp lệ.');
          setSaving(false); return;
        }
        const cashHolding = portfolio.find(p => p.ticker === 'VNĐ');
        const availableCash = cashHolding?.qty || 0;
        if (withdrawal > availableCash) {
          alert(`⚠️ Không đủ tiền mặt!\nHiện có: ${new Intl.NumberFormat('vi-VN').format(availableCash)} VNĐ\nMuốn rút: ${new Intl.NumberFormat('vi-VN').format(withdrawal)} VNĐ`);
          setSaving(false); return;
        }
        const txData = {
          date: form.date || now(),
          transactionType: 'Rút tiền',
          assetClass: 'Tiền mặt VNĐ',
          ticker: '',
          quantity: withdrawal,
          unitPrice: 1,
          currency: 'VNĐ',
          exchangeRate: 1,
          costBasisValue: 0,
          totalVND: withdrawal,
          pnlVND: 0, pnlPercent: 0,
          storage: form.storage,
          notes: form.notes,
        };
        if (transactionToEdit) {
          await apiUpdateTransaction(transactionToEdit.id, txData);
        } else {
          await apiAddTransaction(txData);
        }
        setForm({ ...initialFormState, date: now() });
        if (onSuccess) onSuccess();
        onClose();
        return;
      }

      // ── Validate Bán ──
      if (form.transactionType === 'Bán') {
        const tickerStr = form.ticker.toUpperCase();
        const currentHolding = portfolio.find(p => p.ticker === tickerStr)?.qty || 0;
        const isSameTicker = transactionToEdit && (transactionToEdit.ticker || '').toUpperCase() === tickerStr;
        const oldQtyRefund = isSameTicker ? Math.abs(transactionToEdit.quantity || 0) : 0;
        const availableQty = currentHolding + oldQtyRefund;
        if (qty > availableQty) {
          alert(`⚠️ Số lượng bán vượt quá số lượng đang có!\nTối đa có thể bán: ${availableQty}.`);
          setSaving(false);
          return;
        }
      }

      // Compute Realized P&L for Sell transactions
      let pnlVND = 0, pnlPercent = 0;
      if (form.transactionType === 'Bán') {
        const tickerStr = (form.ticker || '').toUpperCase();
        const holding = portfolio.find(p => p.ticker === tickerStr);
        if (holding && holding.avgCost > 0) {
          const salePriceVND = price * rate;
          pnlVND     = (salePriceVND - holding.avgCost) * qty;
          pnlPercent = ((salePriceVND - holding.avgCost) / holding.avgCost) * 100;
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
        pnlVND: pnlVND,
        pnlPercent: pnlPercent,
        storage: form.storage,
        notes: form.notes,
      };

      if (transactionToEdit) {
        await apiUpdateTransaction(transactionToEdit.id, txData);
      } else {
        await apiAddTransaction(txData);
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

          {/* Date & Asset Type */}
          {!isWithdraw && (
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
          )}

          {/* Date — shown for Rut tien separately */}
          {isWithdraw && (
          <div className="form-group">
            <label className="form-label">Ngày rút tiền</label>
            <input type="text" className="form-input" value={form.date} onChange={e => handleChange('date', e.target.value)} placeholder="dd/mm/yyyy HH:mm:ss" required />
          </div>
          )}

          {/* Ticker & Storage — hidden for cash-only tx */}
          {!isCashTx && (
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
          )}

          {/* ── Withdrawal — simplified form ── */}
          {isWithdraw && (
            <div className="form-group">
              <label className="form-label">Số tiền rút (VNĐ)</label>
              <input
                type="number" step="any" className="form-input"
                value={form.withdrawalAmount}
                onChange={e => handleChange('withdrawalAmount', e.target.value)}
                placeholder="Nhập số tiền muốn rút ra..."
                required
              />
              {(() => {
                const cashHolding = portfolio.find(p => p.ticker === 'VNĐ');
                const avail = cashHolding?.qty || 0;
                const want  = parseFloat(form.withdrawalAmount) || 0;
                if (!avail) return null;
                const ok = want <= avail;
                return (
                  <p className="form-hint-cash">
                    💰 Số dư: <strong>{new Intl.NumberFormat('vi-VN').format(avail)} ₫</strong>
                    {want > 0 && (
                      <span style={{ marginLeft: 8, color: ok ? 'var(--color-emerald-500)' : 'var(--color-rose-500)' }}>
                        {ok ? '✅ Đủ số dư' : '⚠️ Vượt số dư!'}
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
          )}

          {/* ── Asset quantity / price — hidden for Rut tien ── */}
          {!isWithdraw && (
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
          )}

          {/* Calculated Total */}
          <div className="form-total-box">
            <span className="form-total-label">{isWithdraw ? 'Số tiền rút (VNĐ)' : 'Thành tiền (VNĐ)'}</span>
            <span className="form-total-value" style={isWithdraw ? { color: 'var(--color-rose-400)' } : {}}>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculatedTotal())}
            </span>
          </div>

          {/* Realized P&L preview when Selling */}
          {realizedPreview && (
            <div className="form-total-box" style={{
              background: realizedPreview.pnl >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
              borderColor: realizedPreview.pnl >= 0 ? 'var(--color-emerald-500)' : 'var(--color-rose-500)',
            }}>
              <span className="form-total-label">
                Lãi / Lỗ đã chốt (Realized P&L)
              </span>
              <span className="form-total-value" style={{ color: realizedPreview.pnl >= 0 ? 'var(--color-emerald-400)' : 'var(--color-rose-400)' }}>
                {realizedPreview.pnl >= 0 ? '+' : ''}
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(realizedPreview.pnl)}
                {' '}({realizedPreview.pnlPct >= 0 ? '+' : ''}{realizedPreview.pnlPct.toFixed(2)}%)
              </span>
            </div>
          )}

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
