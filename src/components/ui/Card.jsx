import React from 'react';

/** Flat report panel (Portfolio Performance style). */
export default function Card({ title, subtitle, actions, children, className = '', padded = true, style }) {
  return (
    <section className={`pp-card ${padded ? '' : 'pp-card--flush'} ${className}`} style={style}>
      {(title || actions) && (
        <header className="pp-card-header">
          <div>
            {title && <h3 className="pp-card-title">{title}</h3>}
            {subtitle && <p className="pp-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="pp-card-actions">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'pp-card-body' : ''}>{children}</div>
    </section>
  );
}
