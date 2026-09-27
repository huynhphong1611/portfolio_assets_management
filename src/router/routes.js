/**
 * Navigation tree — mirrors Portfolio Performance's sidebar:
 *   General Data · Accounts · Reports · Taxonomies (+ Dashboard & Settings).
 */
export const NAV_SECTIONS = [
  {
    key: 'top',
    items: [
      { path: '/dashboard', label: 'Tổng quan', en: 'Dashboard', icon: 'LayoutDashboard' },
    ],
  },
  {
    key: 'general', label: 'Dữ liệu chung', en: 'General Data',
    items: [
      { path: '/securities', label: 'Tất cả chứng khoán', en: 'All Securities', icon: 'LineChart' },
      { path: '/exchange-rates', label: 'Tỷ giá & Vàng', en: 'Exchange Rates', icon: 'Coins' },
    ],
  },
  {
    key: 'accounts', label: 'Tài khoản', en: 'Accounts',
    items: [
      { path: '/accounts/securities', label: 'Tài khoản chứng khoán', en: 'Securities Accounts', icon: 'Briefcase' },
      { path: '/accounts/deposit', label: 'Tài khoản tiền mặt', en: 'Deposit Accounts', icon: 'Wallet' },
      { path: '/accounts/other', label: 'Tài sản khác & Nợ', en: 'Other Assets & Liabilities', icon: 'Landmark' },
      { path: '/transactions', label: 'Tất cả giao dịch', en: 'All Transactions', icon: 'ArrowRightLeft' },
    ],
  },
  {
    key: 'reports', label: 'Báo cáo', en: 'Reports',
    items: [
      { path: '/reports/assets', label: 'Bảng kê tài sản', en: 'Statement of Assets', icon: 'Table2',
        tabs: [
          { key: 'holdings', label: 'Danh mục nắm giữ' },
          { key: 'chart', label: 'Biểu đồ tài sản' },
          { key: 'allocation', label: 'Phân bổ' },
        ] },
      { path: '/reports/performance', label: 'Hiệu suất', en: 'Performance', icon: 'TrendingUp',
        children: [
          { path: '/reports/performance/calculation', label: 'Tính toán', en: 'Calculation' },
          { path: '/reports/performance/chart', label: 'Biểu đồ', en: 'Chart' },
          { path: '/reports/performance/securities', label: 'Theo chứng khoán', en: 'Securities' },
          { path: '/reports/performance/payments', label: 'Cổ tức & Dòng tiền', en: 'Payments' },
          { path: '/reports/performance/trades', label: 'Giao dịch lãi/lỗ', en: 'Trades' },
        ] },
    ],
  },
  {
    key: 'taxonomies', label: 'Phân loại', en: 'Taxonomies',
    items: [
      { path: '/taxonomies/asset-classes', label: 'Loại tài sản', en: 'Asset Classes', icon: 'PieChart',
        tabs: [
          { key: 'definition', label: 'Định nghĩa & Mục tiêu' },
          { key: 'pie', label: 'Biểu đồ tròn' },
          { key: 'history', label: 'Theo thời gian' },
          { key: 'rebalance', label: 'Tái cân bằng' },
        ] },
      { path: '/taxonomies/storage', label: 'Nơi lưu ký', en: 'Custodian / Broker', icon: 'Building2' },
    ],
  },
  {
    key: 'bottom',
    items: [
      { path: '/settings', label: 'Cài đặt & Dữ liệu', en: 'Settings', icon: 'Settings2' },
    ],
  },
];

/** Flat list of every navigable route (children included). */
export const ALL_ROUTES = NAV_SECTIONS.flatMap(s => s.items.flatMap(i => [i, ...(i.children || [])]));

/**
 * Find the route for a path. Returns the longest matching route and the
 * remaining sub-path (used for in-view tabs).
 */
export function matchRoute(path) {
  let best = null;
  for (const r of ALL_ROUTES) {
    if (path === r.path || path.startsWith(r.path + '/')) {
      if (!best || r.path.length > best.path.length) best = r;
    }
  }
  if (!best) return { route: ALL_ROUTES[0], sub: '' };
  const sub = path.slice(best.path.length).replace(/^\//, '');
  return { route: best, sub };
}

/** Breadcrumb labels for a route path. */
export function breadcrumbFor(path) {
  const { route } = matchRoute(path);
  const crumbs = [];
  for (const s of NAV_SECTIONS) {
    for (const item of s.items) {
      if (item.path === route.path) {
        if (s.label) crumbs.push(s.label);
        crumbs.push(item.label);
        return crumbs;
      }
      for (const c of item.children || []) {
        if (c.path === route.path) {
          if (s.label) crumbs.push(s.label);
          crumbs.push(item.label, c.label);
          return crumbs;
        }
      }
    }
  }
  return [route.label];
}
