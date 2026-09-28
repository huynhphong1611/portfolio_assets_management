import React, { useEffect, useState } from 'react';
import { X, Upload, FileText, Loader2, Download, ArrowLeft } from 'lucide-react';
import { apiImportTransactionsCSV, apiImportPricesCSV } from '../services/api.js';
import { DataTable, TxTypeBadge, Badge } from './ui';
import { TRANSACTION_TEMPLATE, PRICE_TEMPLATE, downloadText } from '../utils/csvTemplates.js';
import { fmtVND, fmtPrice, formatQty } from '../utils/formatters.js';
import { formatISO, toISO } from '../utils/dates.js';
import useOverlayClose from './ui/useOverlayClose.js';

const NUMBER_FORMATS = [
  { value: 'auto', label: 'Tự nhận dạng' },
  { value: 'vi', label: '1.234.567,89 (Việt Nam)' },
  { value: 'en', label: '1,234,567.89 (quốc tế)' },
];

const COPY = {
  transactions: {
    title: 'Nhập giao dịch từ CSV',
    hint: 'Cần các cột: Ngày giờ, Loại giao dịch (Nạp tiền / Rút tiền / Mua / Bán / Cổ tức), Loại tài sản, Mã, Số lượng, Đơn giá hoặc Thành tiền. Tên cột có dấu hay không dấu, tiếng Việt hay tiếng Anh đều được; file xuất từ trang Giao dịch nhập lại được ngay. Giao dịch trùng sẽ được bỏ qua. Lưu file ở dạng CSV UTF-8 để giữ đúng dấu tiếng Việt.',
    template: () => downloadText(TRANSACTION_TEMPLATE, 'mau-giao-dich.csv'),
  },
  prices: {
    title: 'Nhập lịch sử giá từ CSV',
    hint: 'Ba dạng được hỗ trợ: (1) Ngày, Giá cho một mã (chọn mã bên dưới); (2) Ngày, Mã, Giá cho nhiều mã; (3) Ngày và mỗi cột là một mã. Giá cùng ngày sẽ được ghi đè. Lưu file ở dạng CSV UTF-8.',
    template: () => downloadText(PRICE_TEMPLATE, 'mau-lich-su-gia.csv'),
  },
};

/**
 * CSV import with a server-side preview (dry run) before anything is written.
 * mode: 'transactions' | 'prices'
 */
export default function ImportCSVModal({ mode = 'transactions', open, onClose, onDone, tickers = [], defaultTicker = '' }) {
  const [content, setContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [numberFormat, setNumberFormat] = useState('auto');
  const [ticker, setTicker] = useState(defaultTicker);
  const [replace, setReplace] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const overlayProps = useOverlayClose(onClose);
  const copy = COPY[mode];

  useEffect(() => {
    if (open) {
      setContent(''); setFileName(''); setPreview(null); setError(null);
      setNumberFormat('auto'); setReplace(false); setTicker(defaultTicker || '');
    }
  }, [open, defaultTicker]);

  if (!open) return null;

  const readFile = (file) => {
    if (!file) return;
    if (file.size > 5_000_000) { setError('File lớn hơn 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setContent(String(reader.result || '')); setFileName(file.name); setPreview(null); setError(null); };
    reader.onerror = () => setError('Không đọc được file');
    reader.readAsText(file, 'utf-8');
  };

  const call = (dryRun) => (mode === 'transactions'
    ? apiImportTransactionsCSV(content, { numberFormat, dryRun })
    : apiImportPricesCSV(content, { ticker: ticker.trim().toUpperCase() || null, numberFormat, replace, dryRun }));

  const runPreview = async () => {
    setBusy(true); setError(null);
    try { setPreview(await call(true)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await call(false);
      if (onDone) onDone(res);
      onClose();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const importable = mode === 'transactions'
    ? (preview?.validCount || 0)
    : Object.values(preview?.tickers || {}).reduce((s, t) => s + t.count, 0);

  return (
    <div className="modal-overlay" {...overlayProps}>
      <div className="modal-container pp-import-modal">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-icon"><Upload size={20} /></div>
            <div>
              <h2 className="modal-title">{copy.title}</h2>
              <p className="modal-subtitle">{preview ? 'Kiểm tra trước khi ghi vào dữ liệu của bạn' : 'Dữ liệu chỉ được ghi sau khi bạn xác nhận'}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>

        <div className="modal-body">
          {error && <div className="pp-alert pp-alert--error">{error}</div>}

          {!preview && (
            <>
              <p className="pp-prose">{copy.hint}</p>
              <button type="button" className="pp-link" onClick={copy.template}><Download size={13} /> Tải file mẫu</button>

              <label className="pp-dropzone">
                <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={e => readFile(e.target.files?.[0])} />
                <FileText size={20} />
                <span>{fileName ? <><strong>{fileName}</strong> · {content.split(/\r?\n/).filter(Boolean).length} dòng</> : 'Chọn file CSV hoặc kéo thả vào đây'}</span>
              </label>
              <details className="pp-details">
                <summary>Hoặc dán nội dung CSV</summary>
                <textarea className="form-textarea pp-mono" rows={6} value={content} onChange={e => { setContent(e.target.value); setFileName(''); }} placeholder="Ngày,Giá&#10;01/09/2026,8450000" />
              </details>

              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Định dạng số</label>
                  <select className="form-select" value={numberFormat} onChange={e => setNumberFormat(e.target.value)}>
                    {NUMBER_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                {mode === 'prices' && (
                  <div className="form-group">
                    <label className="form-label">Mã chứng khoán <span className="form-label-hint">(khi file chỉ có cột Ngày, Giá)</span></label>
                    <input className="form-input" list="pp-import-tickers" value={ticker} onChange={e => setTicker(e.target.value)} placeholder="VD: NHAN9999" />
                    <datalist id="pp-import-tickers">{tickers.map(t => <option key={t} value={t} />)}</datalist>
                  </div>
                )}
              </div>
              {mode === 'prices' && (
                <label className="pp-check"><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Thay thế toàn bộ lịch sử giá cũ của mã</label>
              )}
            </>
          )}

          {preview && (
            <>
              <div className="pp-import-summary">
                <Badge tone="blue">Định dạng số: {preview.numberFormat === 'vi' ? '1.234,5' : '1,234.5'}</Badge>
                {mode === 'transactions' && <Badge tone="green">{preview.validCount} giao dịch hợp lệ</Badge>}
                {mode === 'transactions' && preview.duplicates?.length > 0 && <Badge tone="gray">{preview.duplicates.length} trùng, sẽ bỏ qua</Badge>}
                {mode === 'prices' && <Badge tone="green">{importable} giá · {Object.keys(preview.tickers || {}).length} mã</Badge>}
                {preview.errorCount > 0 && <Badge tone="red">{preview.errorCount} dòng lỗi</Badge>}
              </div>

              {mode === 'transactions' ? (
                <DataTable
                  rows={preview.preview || []}
                  rowKey={r => r.line}
                  footer={false}
                  maxHeight={280}
                  emptyText="Không có giao dịch hợp lệ"
                  columns={[
                    { key: 'line', label: 'Dòng', align: 'right' },
                    { key: 'date', label: 'Ngày', render: r => formatISO(toISO(r.date)) },
                    { key: 'transactionType', label: 'Loại', render: r => <TxTypeBadge type={r.transactionType} /> },
                    { key: 'ticker', label: 'Mã', render: r => r.ticker || '—' },
                    { key: 'quantity', label: 'Số lượng', align: 'right', render: r => formatQty(Math.abs(r.quantity), r.assetClass) },
                    { key: 'totalVND', label: 'Thành tiền', align: 'right', render: r => fmtVND(r.totalVND) },
                  ]}
                />
              ) : (
                <DataTable
                  rows={Object.entries(preview.tickers || {}).map(([t, v]) => ({ ticker: t, ...v }))}
                  rowKey={r => r.ticker}
                  footer={false}
                  emptyText="Không có giá hợp lệ"
                  columns={[
                    { key: 'ticker', label: 'Mã', render: r => <span className="pp-strong">{r.ticker}</span> },
                    { key: 'count', label: 'Số giá', align: 'right' },
                    { key: 'first', label: 'Từ ngày', render: r => formatISO(r.first) },
                    { key: 'last', label: 'Đến ngày', render: r => formatISO(r.last) },
                    { key: 'lastPrice', label: 'Giá cuối', align: 'right', render: r => fmtPrice(r.lastPrice) },
                  ]}
                />
              )}
              {mode === 'transactions' && preview.validCount > (preview.preview || []).length && (
                <div className="pp-table-note">Hiển thị {(preview.preview || []).length} / {preview.validCount} giao dịch đầu tiên.</div>
              )}

              {preview.errors?.length > 0 && (
                <div className="pp-import-errors">
                  <div className="pp-strong">Các dòng sẽ không được nhập</div>
                  <ul>
                    {preview.errors.map((e, i) => <li key={i}><span className="pp-mono">Dòng {e.line}</span>: {e.message}</li>)}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-actions pp-import-actions">
          {preview ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setPreview(null)} disabled={busy}><ArrowLeft size={14} /> Quay lại</button>
              <button type="button" className="btn-primary" onClick={commit} disabled={busy || importable === 0}>
                {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Nhập {importable} {mode === 'transactions' ? 'giao dịch' : 'giá'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>Hủy</button>
              <button type="button" className="btn-primary" onClick={runPreview} disabled={busy || !content.trim()}>
                {busy ? <Loader2 size={16} className="spin" /> : <FileText size={16} />} Xem trước
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
