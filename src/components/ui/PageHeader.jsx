import React from 'react';

/** View title bar: title + one-line description + actions. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="pp-page-header">
      <div className="pp-page-heading">
        <h1 className="pp-page-title">{title}</h1>
        {subtitle && <p className="pp-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="pp-page-actions">{actions}</div>}
    </div>
  );
}
