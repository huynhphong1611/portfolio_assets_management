import React from 'react';
import { Menu, RefreshCw, PlusCircle, LogOut, ChevronRight } from 'lucide-react';
import PeriodPicker from './PeriodPicker.jsx';
import { breadcrumbFor } from '../router/routes.js';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Toolbar({ path, onMenu }) {
  const { refresh, refreshing, openTransactionModal } = usePortfolioData();
  const { currentUser, logout } = useAuth();
  const crumbs = breadcrumbFor(path);

  return (
    <header className="pp-toolbar">
      <button type="button" className="pp-icon-btn pp-menu-btn" onClick={onMenu} aria-label="Mở menu">
        <Menu size={18} />
      </button>

      <div className="pp-breadcrumb" aria-label="Vị trí">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={14} className="pp-breadcrumb-sep" />}
            <span className={i === crumbs.length - 1 ? 'pp-breadcrumb-current' : 'pp-breadcrumb-part'}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="pp-toolbar-actions">
        <PeriodPicker />
        <button type="button" className="pp-btn pp-btn--ghost" onClick={refresh} disabled={refreshing} title="Tải lại dữ liệu">
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          <span className="pp-hide-sm">Làm mới</span>
        </button>
        <button type="button" className="pp-btn pp-btn--primary" onClick={() => openTransactionModal()} title="Ghi nhận giao dịch">
          <PlusCircle size={15} />
          <span className="pp-hide-sm">Giao dịch</span>
        </button>
        <button type="button" className="pp-icon-btn" onClick={logout} title={`Đăng xuất (${currentUser?.username || ''})`} aria-label="Đăng xuất">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
