import React from 'react';
import {
  LayoutDashboard, LineChart, Coins, Briefcase, Wallet, Landmark, ArrowRightLeft,
  Table2, TrendingUp, PieChart, Building2, Settings2, Activity, X,
} from 'lucide-react';
import { NAV_SECTIONS } from '../router/routes.js';
import { Link } from '../router/useHashRoute.jsx';

const ICONS = {
  LayoutDashboard, LineChart, Coins, Briefcase, Wallet, Landmark, ArrowRightLeft,
  Table2, TrendingUp, PieChart, Building2, Settings2,
};

function isActive(activePath, itemPath) {
  return activePath === itemPath || activePath.startsWith(itemPath + '/');
}

/** Navigation tree (Portfolio Performance style). */
export default function Sidebar({ activePath, open, onClose, username }) {
  return (
    <>
      <div className={`pp-drawer-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`pp-sidebar ${open ? 'is-open' : ''}`} aria-label="Điều hướng">
        <div className="pp-brand">
          <div className="pp-brand-logo"><Activity size={18} /></div>
          <div className="pp-brand-text">
            <div className="pp-brand-title">Portfolio Manager</div>
            <div className="pp-brand-sub">{username ? `@${username}` : 'Quản lý danh mục'}</div>
          </div>
          <button type="button" className="pp-icon-btn pp-sidebar-close" onClick={onClose} aria-label="Đóng menu"><X size={18} /></button>
        </div>

        <nav className="pp-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.key} className="pp-nav-section">
              {section.label && (
                <div className="pp-nav-heading" title={section.en}>{section.label}</div>
              )}
              {section.items.map(item => {
                const Icon = ICONS[item.icon] || LayoutDashboard;
                const active = isActive(activePath, item.path);
                return (
                  <div key={item.path}>
                    <Link
                      to={item.children ? item.children[0].path : item.path}
                      className={`pp-nav-item ${active ? 'is-active' : ''} ${item.children ? 'has-children' : ''}`}
                      title={item.en}
                    >
                      <Icon size={16} className="pp-nav-icon" />
                      <span>{item.label}</span>
                    </Link>
                    {item.children && (
                      <div className="pp-nav-children">
                        {item.children.map(child => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`pp-nav-child ${activePath === child.path ? 'is-active' : ''}`}
                            title={child.en}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
