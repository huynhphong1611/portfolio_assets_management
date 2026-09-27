import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Toolbar from './Toolbar.jsx';
import AddTransactionModal from '../components/AddTransactionModal.jsx';
import { useHashRoute } from '../router/useHashRoute.jsx';
import { matchRoute } from '../router/routes.js';
import { VIEWS, DashboardView } from '../views/index.js';
import { usePortfolioData } from '../contexts/PortfolioDataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

/** Application frame: navigation tree + toolbar + active report. */
export default function AppShell() {
  const { path } = useHashRoute();
  const { route, sub } = matchRoute(path);
  const View = VIEWS[route.path] || DashboardView;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { loading, error, txModal, closeTransactionModal, refresh, transactions } = usePortfolioData();
  const { currentUser } = useAuth();

  useEffect(() => { setDrawerOpen(false); }, [path]);
  useEffect(() => {
    document.title = `${route.label} · Portfolio Manager`;
  }, [route]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-logo"><Activity size={40} /></div>
          <h2 className="loading-title">Portfolio Manager</h2>
          <p className="loading-subtitle">Đang tải dữ liệu…</p>
          <div className="loading-bar"><div className="loading-bar-fill"></div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="pp-shell">
      <Sidebar activePath={route.path} open={drawerOpen} onClose={() => setDrawerOpen(false)} username={currentUser?.username} />
      <div className="pp-main">
        <Toolbar path={path} onMenu={() => setDrawerOpen(true)} />
        <main className="pp-content" key={route.path}>
          {error && <div className="pp-alert pp-alert--error">Không tải được dữ liệu: {error}</div>}
          <View sub={sub} route={route} />
        </main>
      </div>
      <AddTransactionModal
        isOpen={txModal.open}
        onClose={closeTransactionModal}
        onSuccess={refresh}
        transactionToEdit={txModal.tx}
        transactions={transactions}
      />
    </div>
  );
}
