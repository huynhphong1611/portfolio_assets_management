import React from 'react';

export default function Empty({ title = 'Chưa có dữ liệu', hint, action }) {
  return (
    <div className="pp-empty">
      <div className="pp-empty-title">{title}</div>
      {hint && <div className="pp-empty-hint">{hint}</div>}
      {action && <div className="pp-empty-action">{action}</div>}
    </div>
  );
}
