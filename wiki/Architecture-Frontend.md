# ⚛️ Architecture Frontend — Kiến trúc Frontend

## Tech Stack

| Công nghệ | Vai trò |
|-----------|---------|
| **React 18** | UI framework |
| **Vite 5** | Build tool & dev server |
| **Lucide Icons** | Icon library |
| **Recharts** | Charts & visualizations |
| **Firebase SDK** | Authentication |
| **Vanilla CSS** | Styling (dark theme) |

## Cấu trúc thư mục

```
src/
├── App.jsx                        # Main app — Tab navigation, routing logic
├── main.jsx                       # Entry point — render App
├── firebase.js                    # Firebase SDK initialization
├── index.css                      # Global styles (dark theme, 67KB)
│
├── components/
│   ├── AddTransactionModal.jsx    # Modal thêm giao dịch mua/bán
│   ├── TransactionLog.jsx         # Bảng lịch sử giao dịch (filter, sort)
│   ├── FundManager.jsx            # Quản lý quỹ đầu tư ảo
│   ├── SystemPricesBoard.jsx      # Bảng giá hệ thống (đọc từ admin)
│   ├── RebalanceSettings.jsx      # Cài đặt mục tiêu phân bổ tài sản
│   ├── NetWorthExternalManager.jsx # Quản lý tài sản ngoài danh mục
│   ├── LiabilitiesManager.jsx     # Quản lý nợ phải trả
│   ├── HistoricalSnapshotModal.jsx # Modal backfill snapshot lịch sử
│   ├── AssetAllocationChart.jsx   # Biểu đồ phân bổ tài sản (donut)
│   ├── CumulativePerformanceChart.jsx # Biểu đồ hiệu suất tích luỹ
│   │
│   ├── Auth/
│   │   └── Login.jsx              # Trang đăng nhập (Firebase + Guest)
│   │
│   ├── Admin/
│   │   └── ...                    # Admin Portal components
│   │
│   └── charts/
│       └── ...                    # Chart sub-components
│
├── pages/
│   └── AdminApp.jsx               # Admin Portal page
│
├── services/
│   ├── api.js                     # API client (JWT auth, REST calls)
│   ├── adminApi.js                # Admin API client
│   └── firestoreService.js        # Direct Firestore operations
│
├── contexts/
│   └── AuthContext.jsx            # React Context — auth state management
│
└── utils/
    ├── portfolioCalculator.js     # Client-side portfolio calculations
    └── formatters.js              # Number & currency formatting (VNĐ)
```

## App.jsx — Component chính

`App.jsx` là trung tâm điều khiển với hệ thống **tab navigation**:

| Tab | Component | Mô tả |
|-----|-----------|--------|
| 🏠 Dashboard | _(inline)_ | Net Worth, Assets vs Liabilities, Growth chart |
| 💼 Portfolio | _(inline)_ | Holdings table, P&L, Asset allocation chart |
| 📋 Transactions | `TransactionLog` | Lịch sử giao dịch, filter theo loại/ticker |
| 💰 Funds | `FundManager` | Quản lý quỹ ảo (Conservative, Growth...) |
| 📊 Prices | `SystemPricesBoard` | Bảng giá, trigger fetch giá mới |
| ⚖️ Rebalance | `RebalanceSettings` | Target allocation percentages |
| 🏦 External | `NetWorthExternalManager` | Tài sản ngoài (TOPI, deposits) |
| 💳 Liabilities | `LiabilitiesManager` | Khoản vay, thẻ tín dụng |

## Luồng Authentication

```
User mở app
  │
  ├── Đã login? → Load dashboard data
  │
  └── Chưa login? → Hiện Login.jsx
       │
       ├── Firebase Auth (Google/Email)
       │   → signInWithPopup/signInWithEmailPassword
       │   → POST /api/auth/firebase/verify (ID token)
       │   → Nhận JWT session token
       │
       └── Guest Auth
           → POST /api/auth/guest/login (username + password)
           → Backend verify SHA-256 hash
           → Nhận JWT session token
```

## API Client (`api.js`)

- Tự động gắn `Authorization: Bearer <JWT>` vào mọi request
- Base URL: `/api` (proxy qua Vite dev server hoặc Firebase Hosting rewrite)
- Xử lý lỗi 401 → logout tự động
- Hỗ trợ cả Firebase user (`system_users`) và Guest user (`guest_users`)

## Styling

- **Dark theme** là mặc định — gradient tím/xanh
- File `index.css` ~67KB chứa toàn bộ styles
- Responsive design cho mobile
- Sử dụng CSS variables cho theming

---

## Xem thêm

- [[Architecture Overview]] — Tổng quan hệ thống
- [[Architecture Backend]] — Backend FastAPI
- [[API Reference]] — API endpoints
