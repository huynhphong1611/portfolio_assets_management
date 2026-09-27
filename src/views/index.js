import DashboardView from './DashboardView.jsx';
import SecuritiesView from './SecuritiesView.jsx';
import ExchangeRatesView from './ExchangeRatesView.jsx';
import SecuritiesAccountsView from './SecuritiesAccountsView.jsx';
import DepositAccountsView from './DepositAccountsView.jsx';
import OtherAssetsView from './OtherAssetsView.jsx';
import TransactionsView from './TransactionsView.jsx';
import StatementOfAssetsView from './StatementOfAssetsView.jsx';
import CalculationView from './performance/CalculationView.jsx';
import PerformanceChartView from './performance/PerformanceChartView.jsx';
import SecurityPerformanceView from './performance/SecurityPerformanceView.jsx';
import PaymentsView from './performance/PaymentsView.jsx';
import TradesView from './performance/TradesView.jsx';
import AssetClassesView from './taxonomies/AssetClassesView.jsx';
import StorageView from './taxonomies/StorageView.jsx';
import SettingsView from './SettingsView.jsx';

/** Route path → view component. Keys must match router/routes.js. */
export const VIEWS = {
  '/dashboard': DashboardView,
  '/securities': SecuritiesView,
  '/exchange-rates': ExchangeRatesView,
  '/accounts/securities': SecuritiesAccountsView,
  '/accounts/deposit': DepositAccountsView,
  '/accounts/other': OtherAssetsView,
  '/transactions': TransactionsView,
  '/reports/assets': StatementOfAssetsView,
  '/reports/performance': CalculationView,
  '/reports/performance/calculation': CalculationView,
  '/reports/performance/chart': PerformanceChartView,
  '/reports/performance/securities': SecurityPerformanceView,
  '/reports/performance/payments': PaymentsView,
  '/reports/performance/trades': TradesView,
  '/taxonomies/asset-classes': AssetClassesView,
  '/taxonomies/storage': StorageView,
  '/settings': SettingsView,
};

export { DashboardView };
