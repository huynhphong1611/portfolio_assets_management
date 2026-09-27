import React from 'react';
import { Link } from '../../router/useHashRoute.jsx';

/**
 * Sub-navigation tabs. Either link-based (base + tab key → hash route)
 * or controlled (active/onChange).
 */
export default function Tabs({ tabs = [], active, base, onChange }) {
  return (
    <nav className="pp-tabs" role="tablist">
      {tabs.map(t => {
        const isActive = t.key === active;
        const cls = `pp-tab ${isActive ? 'pp-tab--active' : ''}`;
        if (base) {
          return <Link key={t.key} to={`${base}/${t.key}`} className={cls} role="tab" aria-selected={isActive}>{t.label}</Link>;
        }
        return (
          <button key={t.key} type="button" className={cls} role="tab" aria-selected={isActive} onClick={() => onChange && onChange(t.key)}>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
