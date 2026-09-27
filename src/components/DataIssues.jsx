import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Data-consistency issues (utils/dataChecks.js) with a shortcut to the rows
 * concerned. Collapsed by default: one line saying how many issues there are.
 */
export default function DataIssues({ issues = [], onEdit, title = 'Kiểm tra dữ liệu', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!issues.length) return null;

  const warnings = issues.filter(i => i.level === 'warning').length;
  const notes = issues.length - warnings;
  const summary = [warnings && `${warnings} cảnh báo`, notes && `${notes} lưu ý`].filter(Boolean).join(', ');

  return (
    <div className={`pp-issues${warnings ? ' pp-issues--warning' : ''}`}>
      <button type="button" className="pp-issues-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {warnings ? <AlertTriangle size={15} /> : <Info size={15} />}
        <span><strong>{title}:</strong> {summary}</span>
      </button>
      {open && (
        <ul className="pp-issues-list">
          {issues.map(issue => (
            <li key={issue.id} className={`pp-issue pp-issue--${issue.level}`}>
              <div className="pp-issue-title">{issue.title}</div>
              <div className="pp-issue-detail">{issue.detail}</div>
              {onEdit && issue.txs.length > 0 && (
                <div className="pp-issue-actions">
                  {issue.txs.slice(0, 3).map((tx, k) => (
                    <button key={tx.id || k} type="button" className="pp-link" onClick={() => onEdit(tx)}>
                      Sửa: {tx.transactionType}{tx.ticker ? ` ${tx.ticker}` : ''} · {tx.date}
                    </button>
                  ))}
                  {issue.txs.length > 3 && <span className="pp-meta">+{issue.txs.length - 3} giao dịch khác</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
