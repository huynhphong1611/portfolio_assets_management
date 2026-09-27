import React from 'react';
import { useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Auth/Login.jsx';
import { PortfolioDataProvider } from './contexts/PortfolioDataContext.jsx';
import { ReportingPeriodProvider } from './contexts/ReportingPeriodContext.jsx';
import AppShell from './layout/AppShell.jsx';

/**
 * Portfolio Manager — structure modelled on Portfolio Performance:
 *   General Data · Accounts · Reports · Taxonomies, with a global reporting period.
 */
export default function App() {
  const { currentUser } = useAuth();
  if (!currentUser) return <Login />;

  return (
    <PortfolioDataProvider>
      <ReportingPeriodProvider>
        <AppShell />
      </ReportingPeriodProvider>
    </PortfolioDataProvider>
  );
}
