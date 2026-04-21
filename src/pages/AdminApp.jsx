import React, { useState } from 'react';
import { Activity, BarChart3, Settings2, Users, LogOut, Shield, ChevronRight } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '../contexts/AdminAuthContext.jsx';
import AdminLogin from '../components/Admin/AdminLogin.jsx';
import AdminPriceBoard from '../components/Admin/AdminPriceBoard.jsx';
import AdminTickerConfig from '../components/Admin/AdminTickerConfig.jsx';
import AdminUserList from '../components/Admin/AdminUserList.jsx';
import AdminSettings from '../components/Admin/AdminSettings.jsx';

const NAV_ITEMS = [
  { id: 'prices', icon: <BarChart3 size={18} />, label: 'Bảng giá' },
  { id: 'tickers', icon: <Settings2 size={18} />, label: 'Ticker Config' },
  { id: 'users', icon: <Users size={18} />, label: 'Users' },
  { id: 'settings', icon: <Settings2 size={18} />, label: 'Settings' },
];

function AdminDashboard() {
  const { adminUser, adminLogout } = useAdminAuth();
  const [activeTab, setActiveTab] = useState('prices');

  return (
    <div className="app-layout">
      {/* Admin Sidebar */}
      <aside className="sidebar" style={{ borderRight: '1px solid rgba(244,63,94,0.2)' }}>
        <div className="sidebar-brand">
          <div className="sidebar-logo" style={{ background: 'var(--color-rose-500)' }}>
            <Shield size={20} />
          </div>
          <div>
            <h1 className="sidebar-title">Admin Portal</h1>
            <p className="sidebar-subtitle" style={{ color: 'var(--color-rose-400)' }}>System Control</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`admin-nav-${item.id}`}
              className={`nav-item ${activeTab === item.id ? 'nav-item--active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ padding: '0.2rem 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Admin: <strong style={{ color: 'var(--color-rose-400)' }}>{adminUser?.username}</strong>
          </div>
          <a
            href="/"
            className="btn-glass import-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
          >
            <ChevronRight size={14} /> Về User App
          </a>
          <button
            className="btn-glass import-btn"
            onClick={adminLogout}
            style={{ color: 'var(--color-rose-400)', borderColor: 'rgba(244,63,94,0.2)' }}
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-container">
        <main className="main-content">
          <div className="content-wrapper">
            {activeTab === 'prices' && <AdminPriceBoard />}
            {activeTab === 'tickers' && <AdminTickerConfig />}
            {activeTab === 'users' && <AdminUserList />}
            {activeTab === 'settings' && <AdminSettings />}
          </div>
        </main>
      </div>
    </div>
  );
}

function AdminAppInner() {
  const { adminUser } = useAdminAuth();
  if (!adminUser) return <AdminLogin />;
  return <AdminDashboard />;
}

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <AdminAppInner />
    </AdminAuthProvider>
  );
}
