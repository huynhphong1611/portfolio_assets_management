# 📊 Portfolio Manager V6.0 — Fullstack Digital Asset Management

> **A Vibe Coding Project** — Built with AI-assisted development by Google Deepmind (Antigravity Agent)
> Fullstack personal portfolio management with Python FastAPI backend, React frontend, Firebase Firestore, Vietnamese stock market integration (vnstock & FMarket), Crypto APIs (CoinGecko auto-detect), and automated daily scheduling.

---

## ✨ Core Features

Giao diện được tổ chức theo mô hình của [Portfolio Performance](https://www.portfolio-performance.info/en/): cây điều hướng bên trái, **kỳ báo cáo** dùng chung trên thanh công cụ, báo cáo dạng bảng dày thông tin và URL riêng cho từng màn hình (`#/reports/performance/chart`…).

| Nhóm | Màn hình |
|------|----------|
| **Tổng quan** | Tài sản ròng, giá trị danh mục, TTWROR, IRR, delta, max drawdown, biểu đồ so với VN-Index/Bitcoin, heatmap lợi nhuận theo tháng, phân bổ, vị thế lớn nhất, giao dịch gần đây |
| **Dữ liệu chung** | Tất cả chứng khoán của bạn (nguồn giá Tự động / Nhập tay / JSON, giá nhập tay, import lịch sử giá, cảnh báo mã thiếu giá) · Tỷ giá & Vàng (USDT, USDC, SJC) |
| **Tài khoản** | Tài khoản chứng khoán (vị thế theo nơi lưu ký) · Tài khoản tiền mặt (sổ quỹ với số dư lũy kế) · Tài sản khác & Nợ · Tất cả giao dịch (lọc, nhóm theo năm/tháng, xuất CSV) |
| **Báo cáo** | Bảng kê tài sản (nhóm theo loại tài sản, biểu đồ giá trị, phân bổ) · Hiệu suất: Tính toán, Biểu đồ + Lợi suất/Biến động, Theo chứng khoán, Cổ tức & Dòng tiền, Giao dịch lãi/lỗ |
| **Phân loại** | Loại tài sản (định nghĩa, biểu đồ tròn, tỷ trọng theo thời gian, tái cân bằng kèm số tiền cần mua/bán) · Nơi lưu ký |
| **Cài đặt & Dữ liệu** | Snapshot hôm nay, dựng snapshot lịch sử, cập nhật giá & tính lại, import CSV giao dịch/giá có xem trước, sao lưu và khôi phục toàn bộ dữ liệu |

### 📈 Chỉ số hiệu suất
- **TTWROR** (lợi suất theo thời gian, loại bỏ nạp/rút) và **IRR** (lợi suất theo dòng tiền), tích lũy và năm hóa
- **Thay đổi tuyệt đối, Delta**, bảng tính: đầu kỳ + lãi/lỗ chưa thực hiện + đã thực hiện + thu nhập + nạp/rút = cuối kỳ
- **Max drawdown** (và thời gian), **biến động / semi-volatility**, lợi nhuận theo tháng và năm
- Lệnh lãi/lỗ theo **giá vốn bình quân gia quyền di động** (tại ngày bán), hiệu suất và IRR theo từng mã
- **Kiểm tra dữ liệu**: chỉ ra lệnh bán vượt số lượng đang giữ, số dư tiền mặt âm, nơi lưu ký viết khác nhau — kèm nút mở giao dịch cần sửa
- Loại giao dịch **Cổ tức** cho cổ tức tiền mặt, coupon và lãi tiền gửi

Chi tiết công thức: [wiki/Feature-Performance-Reports.md](wiki/Feature-Performance-Reports.md) (hiệu suất) và [wiki/Feature-Snapshot-Engine.md](wiki/Feature-Snapshot-Engine.md) (giá vốn, tiền mặt, vốn ròng, tổng lãi/lỗ).

### 🪙 Dữ liệu của riêng bạn
- Mỗi user có **danh sách chứng khoán và lịch sử giá riêng**, như Portfolio Performance. Mỗi mã chọn nguồn giá: **Tự động** (vnstock, CoinGecko, SJC), **Nhập tay**, hoặc **JSON** (URL + JSONPath, có nút thử).
- Tài sản không có API như vàng nhẫn, trái phiếu riêng lẻ được định giá bằng giá bạn nhập hoặc import, thay vì giá vốn.
- **Import CSV** giao dịch và lịch sử giá: tự nhận tên cột tiếng Việt/tiếng Anh, số kiểu `1.234.567,89` hoặc `1,234,567.89`, xem trước và báo lỗi từng dòng, bỏ qua giao dịch trùng.
- **Sao lưu / khôi phục** toàn bộ dữ liệu của user bằng một file JSON.

Chi tiết: [wiki/Feature-User-Securities.md](wiki/Feature-User-Securities.md).

### 🤖 Auto Scheduler — Daily 9AM Job
- **Backend APScheduler** running at 9:00 AM Asia/Ho_Chi_Minh
- Fetches system prices once for the admin ticker list plus every user's AUTO securities
- **For each user**: refresh their JSON feeds → value with system prices overlaid by their own prices → save snapshot
- **Manual trigger**: `POST /api/scheduler/run-now` · **Status**: `GET /api/scheduler/status`

### 🏦 Price Sources
- **vnstock** — VN stocks & fund NAVs (fmarket) · **CoinGecko** — crypto & stablecoin VND rates · **vang.today** — SJC gold
- 60-second in-memory caching, smart fallback for unknown tickers

### 🔐 Authentication
- **Firebase Auth** (ID token verification) and **Guest Auth** (SHA-256 + JWT)
- **User data isolation** — `system_users/{uid}/...` vs `guest_users/{uid}/...`

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Lucide Icons, custom SVG charts |
| **Backend** | Python FastAPI + Uvicorn |
| **Database** | Firebase Firestore (Admin SDK) |
| **Scheduler** | APScheduler (BackgroundScheduler) |
| **Data APIs** | `vnstock >=3.0.0`, CoinGecko API |
| **Auth** | Firebase Auth + Custom JWT (Guest) |
| **Container** | Docker Engine & Docker Compose |

---

## 🚀 Quick Setup & Configuration

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed & running
- Firebase project with Firestore enabled
- Firebase service account JSON key

### 1. Environment Configuration (`.env`)
Create a `.env` file in the project root:

```env
# Firebase Config (Frontend)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Backend
JWT_SECRET=your_random_jwt_secret_key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# API Settings
VNSTOCK_API_ENABLED=true
LOG_LEVEL=INFO

# Third Party APIs (optional)
VNSTOCK_API_KEY=your_vnstock_community_key
COINGECKO_API_KEY=your_coingecko_api_key
```

### 2. Firebase Service Account
Place your Firebase service account JSON in `backend/firebase-service-account.json`.
> ⚠️ This file is in `.gitignore` — never commit it.

### 3. Start the App via Docker
```bash
docker compose up -d --build
```
- **React App**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

### 4. Verify Services
```bash
# Health check
curl http://localhost:8000/

# Scheduler status
curl http://localhost:8000/api/scheduler/status

# Service status
curl http://localhost:8000/api/status
```

---

## 📁 Project Structure

```
├── src/                             # React Frontend
│   ├── App.jsx                      # Auth gate + data/period providers + AppShell
│   ├── router/                      # routes.js (navigation tree), useHashRoute.jsx
│   ├── layout/                      # AppShell, Sidebar (tree), Toolbar, PeriodPicker
│   ├── views/                       # Dashboard, Securities, ExchangeRates, Accounts, Transactions,
│   │   ├── performance/             #   Calculation, Chart, Securities, Payments, Trades
│   │   └── taxonomies/              #   AssetClasses (+ rebalancing), Storage
│   ├── contexts/                    # AuthContext, PortfolioDataContext, ReportingPeriodContext
│   ├── components/
│   │   ├── ui/                      # Card, Kpi, DataTable, Tabs, PageHeader, Badge, Empty
│   │   ├── charts/                  # LineChart, BarChart, StackedAreaChart, PerformanceChart…
│   │   ├── widgets/                 # HeatmapWidget (monthly returns)
│   │   └── …                        # AddTransactionModal, TransactionLog, managers, Admin/, Auth/
│   ├── hooks/                       # usePeriodReport, useDailyPriceHistory
│   │   (ImportCSVModal, SecuritiesView: per-user securities, feeds, prices)
│   ├── services/api.js              # API client (JWT auth, REST calls)
│   ├── styles/pp.css                # Portfolio Performance–style workspace theme
│   └── utils/
│       ├── portfolioCalculator.js   # Holdings, valuation, net worth, P&L, snapshots
│       ├── performanceEngine.js     # TTWROR, IRR, drawdown, volatility, trades
│       ├── accounts.js              # Cash ledger, holdings per custodian
│       ├── priceResolver.js         # System prices + the user's own prices by quote feed
│       └── reportingPeriod.js · dates.js · formatters.js · assetClasses.js
│
├── backend/                         # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                  # App entry + scheduler startup
│   │   ├── routers/                 # auth, transactions, prices, snapshots, dashboard, admin, securities, data_io…
│   │   ├── services/                # portfolio_service, price_service, scheduler, quote_feed_service,
│   │   │                            #   quote_update_service, csv_import_service…
│   │   └── models/schemas.py        # Pydantic request models
│   ├── tests/                       # pytest (CSV import, JSON feeds, price rules, routers)
│   ├── requirements.txt · requirements-dev.txt
│   └── Dockerfile
│
├── wiki/                            # Project wiki (architecture, features, API)
├── docker-compose.yml               # Backend + Frontend orchestration
└── vite.config.js                   # Vite dev server + API proxy
```

### Tests

```bash
npm test                                   # Vitest: calculator, performance engine, accounts, price rules, charts
cd backend && pip install -r requirements-dev.txt && python -m pytest   # backend, runs without Firebase
```

---

## 🗄️ Firebase Collections

| Collection | Scope | Purpose |
|-----------|-------|---------|
| `users` | Global | Guest user auth credentials |
| `guest_users/{uid}/*` | Per-user | Guest user portfolio data |
| `system_users/{uid}/*` | Per-user | Firebase Auth user portfolio data |
| `marketPrices` | Global | Latest market prices for all tickers |

### Per-user sub-collections:
| Sub-collection | Purpose |
|---------------|---------|
| `transactions` | Nạp tiền / Rút tiền / Mua / Bán / Cổ tức history |
| `securities` | The user's securities: name, asset class, quote feed (AUTO / MANUAL / GENERIC-JSON) |
| `securityPrices` | The user's own price history per security |
| `externalAssets` | Assets outside the investment portfolio |
| `liabilities` | Debts and loans |
| `funds` | Virtual investment fund divisions |
| `dailyPrices` | Daily price snapshots per date |
| `dailySnapshots` | Daily portfolio value snapshots |
| `settings` | User preferences (rebalance targets) |

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/guest/login` | Guest login |
| POST | `/api/auth/guest/register` | Guest register |
| POST | `/api/auth/firebase/verify` | Firebase token verify |

### Portfolio Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Full dashboard aggregation |
| GET/POST | `/api/transactions` | Transaction CRUD |
| GET/POST | `/api/funds` | Fund management |
| GET/POST | `/api/external-assets` | External assets |
| GET/POST | `/api/liabilities` | Liabilities |

### Prices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices/stock?symbol=VCB` | Single price fetch |
| GET | `/api/prices/stocks?symbols=BTC,VFF` | Multi price fetch |
| GET | `/api/prices/daily?limit=30` | System daily price history (newest first) |

### Securities & Data (per user)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/securities` · `/api/securities/prices` | Securities and own price history |
| PUT/DELETE | `/api/securities/{ticker}` · `/api/securities/{ticker}/prices` | Edit security, feed and prices |
| POST | `/api/securities/feed/test` · `/api/securities/update-quotes` | Try a JSON feed · update quotes |
| POST | `/api/data/import/transactions` · `/api/data/import/prices` | CSV import (dry-run preview) |
| GET/POST | `/api/data/export` · `/api/data/import/workspace` | Backup · restore |
| GET/POST | `/api/prices/market` | Global market prices |

### Scheduler
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduler/status` | Scheduler status & next run |
| POST | `/api/scheduler/run-now` | Manual trigger |

---

<p align="center">
  <strong>🛡️ Built with AI-assisted development</strong><br/>
  <em>Google Deepmind Antigravity Agent — Fullstack Agent + SecurityOps Agent</em>
</p>
