# ⚛️ Architecture Frontend — Kiến trúc Frontend

## Tech Stack

| Công nghệ | Vai trò |
|-----------|---------|
| **React 18** | UI framework |
| **Vite 5** | Build tool & dev server |
| **Lucide Icons** | Icon library |
| **SVG tự viết** | Biểu đồ đường, cột, vùng xếp chồng, donut, heatmap (không dùng thư viện chart) |
| **Firebase SDK** | Authentication |
| **Vanilla CSS** | `src/index.css` (nền tảng, admin, form) + `src/styles/pp.css` (workspace kiểu Portfolio Performance) |
| **Vitest** | Unit test cho engine tính toán |

## Cấu trúc thư mục

```
src/
├── main.jsx                       # Entry — /admin → AdminApp, còn lại → App
├── App.jsx                        # Cổng đăng nhập + providers + AppShell
├── firebase.js                    # Firebase SDK initialization
├── index.css                      # Styles nền tảng (login, admin, modal, form)
├── styles/pp.css                  # Workspace: sidebar dạng cây, toolbar, bảng báo cáo
│
├── router/
│   ├── routes.js                  # Cây điều hướng (Dữ liệu chung / Tài khoản / Báo cáo / Phân loại)
│   └── useHashRoute.jsx           # Hash router tối giản + <Link>
│
├── contexts/
│   ├── AuthContext.jsx            # Trạng thái đăng nhập (Firebase + Guest)
│   ├── PortfolioDataContext.jsx   # Dữ liệu danh mục + dữ liệu dẫn xuất + modal giao dịch
│   ├── ReportingPeriodContext.jsx # Kỳ báo cáo dùng chung
│   └── AdminAuthContext.jsx
│
├── layout/
│   ├── AppShell.jsx               # Sidebar + Toolbar + màn hình đang mở + modal giao dịch
│   ├── Sidebar.jsx                # Cây điều hướng (ngăn kéo trên mobile)
│   ├── Toolbar.jsx                # Breadcrumb, kỳ báo cáo, làm mới, thêm giao dịch
│   └── PeriodPicker.jsx
│
├── views/                         # Một file cho mỗi màn hình (xem Feature Performance Reports)
│   ├── DashboardView.jsx
│   ├── SecuritiesView.jsx · ExchangeRatesView.jsx
│   ├── SecuritiesAccountsView.jsx · DepositAccountsView.jsx · OtherAssetsView.jsx · TransactionsView.jsx
│   ├── StatementOfAssetsView.jsx
│   ├── performance/               # Calculation · Chart · Securities · Payments · Trades
│   ├── taxonomies/                # AssetClasses (định nghĩa, biểu đồ, lịch sử, tái cân bằng) · Storage
│   ├── SettingsView.jsx
│   └── index.js                   # Bảng route → component
│
├── components/
│   ├── ui/                        # Card, Kpi, DataTable, Tabs, PageHeader, Badge, Empty
│   ├── charts/                    # LineChart, BarChart, StackedAreaChart, PerformanceChart, AssetChart, scale.js
│   ├── widgets/HeatmapWidget.jsx  # Lợi nhuận theo tháng
│   ├── AddTransactionModal.jsx    # Nạp / Rút / Mua / Bán / Cổ tức
│   ├── TransactionLog.jsx         # Nhật ký giao dịch nhóm theo năm/tháng
│   ├── NetWorthExternalManager.jsx · LiabilitiesManager.jsx
│   ├── RebalanceSettings.jsx · HistoricalSnapshotModal.jsx · AssetAllocationChart.jsx
│   ├── Auth/Login.jsx
│   └── Admin/…                    # Admin Portal
│
├── hooks/
│   ├── usePeriodReport.js         # Báo cáo hiệu suất cho kỳ đang chọn
│   └── useDailyPriceHistory.js    # Lịch sử giá hệ thống theo mã
│
├── services/
│   ├── api.js                     # API client (JWT, REST)
│   ├── adminApi.js
│   └── firestoreService.js        # Chỉ dùng cho script import CSV
│
└── utils/
    ├── portfolioCalculator.js     # Holdings, định giá, tài sản ròng, P&L, snapshot
    ├── performanceEngine.js       # TTWROR, IRR, drawdown, biến động, trades…
    ├── accounts.js                # Sổ quỹ tiền mặt, vị thế theo nơi lưu ký
    ├── assetClasses.js            # Màu, thứ tự, nhãn loại tài sản
    ├── reportingPeriod.js · dates.js · formatters.js
```

## Luồng dữ liệu

```
AuthProvider
 └─ App ──(chưa đăng nhập)──▶ Login
     └─ PortfolioDataProvider      tải transactions, snapshots, marketPrices, externalAssets,
        │                          liabilities, rebalance targets, benchmarks (một lần)
        │                          → holdings, portfolio, netWorth, replay giao dịch…
        └─ ReportingPeriodProvider kỳ báo cáo → { start, end }
            └─ AppShell            route hiện tại → view tương ứng
                └─ View            usePeriodReport() → computePeriodReport(snapshots, transactions, kỳ)
```

- Mọi màn hình đọc dữ liệu từ context, không tự gọi API trùng lặp (trừ lịch sử giá và danh sách mã được theo dõi).
- Sau khi thêm/sửa/xóa, view gọi `refresh()` để tải lại dữ liệu.
- Modal giao dịch là toàn cục: `openTransactionModal(tx?)` từ bất kỳ màn hình nào.
- Snapshot hôm nay được tự lưu khi mở ứng dụng nếu chưa có (theo ngày địa phương).

## Định tuyến

Hash router (`#/reports/performance/chart`) để không cần cấu hình rewrite phía server. `matchRoute()` tìm route dài nhất khớp với đường dẫn, phần còn lại (VD `holdings`, `rebalance`) là tab bên trong màn hình.

## Luồng Authentication

```
User mở app
  │
  ├── Đã login? → Load dữ liệu danh mục → AppShell
  │
  └── Chưa login? → Hiện Login.jsx
       ├── Firebase Auth → POST /api/auth/firebase/verify → JWT session token
       └── Guest Auth    → POST /api/auth/guest/login     → JWT session token
```

## API Client (`api.js`)

- Tự động gắn `Authorization: Bearer <JWT>` vào mọi request
- Base URL: `/api` (proxy qua Vite dev server hoặc Firebase Hosting rewrite)
- Hỗ trợ cả Firebase user (`system_users`) và Guest user (`guest_users`)

## Giao diện

- Theme sáng kiểu ứng dụng desktop: sidebar xám nhạt, bảng dày thông tin, số căn phải dạng `tabular-nums`, lãi màu xanh, lỗ màu đỏ.
- Responsive: dưới 860px sidebar thành ngăn kéo, lưới 4 cột thành 2 cột; biểu đồ tự đo bề rộng khung chứa.
- Admin Portal (`/admin`) giữ giao diện riêng trong `index.css`.

---

## Xem thêm

- [[Feature Performance Reports]] — Báo cáo và công thức hiệu suất
- [[Architecture Overview]] — Tổng quan hệ thống
- [[Architecture Backend]] — Backend FastAPI
- [[API Reference]] — API endpoints
