# 📊 Portfolio Manager V5 — Personal Asset Management System

> **A Vibe Coding Project** — Built with AI-assisted development  
> Comprehensive personal portfolio management with fund-based architecture, real-time Firebase sync, and Vietnamese stock market integration.

---

## ✨ Features

### 🏠 Dashboard — Tổng quan Tài sản
- **Net Worth tracking** — Total Assets minus Liabilities
- **Assets vs Liabilities** visualization with gradient progress bars
- **Growth charts** — Track net worth changes over time with daily snapshots
- **External assets** — TOPI, bank deposits, wedding gold, real estate...
- **Liabilities management** — Bank loans, credit cards, installments

### 💼 Danh mục Đầu tư — Portfolio Overview
- **All holdings at a glance** — Every asset across all funds
- **Asset allocation** donut chart (Bonds, Stocks, Crypto, Gold, Cash)
- **Portfolio growth chart** — Value, Cost Basis, P&L over time
- **Search & filter** across all tickers

### 🏦 Quỹ Đầu tư — Fund Management
- **5 investment funds**: Bond Fund, Stock Fund, Crypto Fund, Gold Fund, Cash Fund
- **Per-fund cash balance** — Deposit/withdraw money into each fund
- **Cash validation** — Cannot buy if fund has insufficient cash
- **Sell → returns cash** back to the fund automatically
- **Per-fund P&L** and growth charts

### ⚖️ Tái cơ cấu — Rebalancing
- **Target weight allocation** per asset class (editable, saved to Firebase)
- **Visual comparison** — Actual vs Target weights with variance indicators
- **Action badges** — BUY MORE / SELL / HOLD recommendations

### 📋 Bảng giá — Daily Price Entry
- **Manual price input** for: Gold, USD, Bonds, Stocks, Crypto
- **API integration** — Fetch Vietnamese stock prices from [vnstock](https://github.com/thinh-vu/vnstock) 
- **Historical prices** — View and edit past daily prices
- **Fallback logic** — Uses latest available price if today's not entered

### 📝 Nhật ký Giao dịch — Transaction Log
- **Full transaction history** with search, filter, sort, pagination
- **Fund-linked transactions** — Every buy/sell tied to a specific fund
- **14-field transaction form** with auto-calculated totals
- **CSV import** — Bulk import from Excel/CSV
- **Auto snapshot** — Daily portfolio snapshot saved automatically

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Lucide Icons |
| **Styling** | Vanilla CSS (Custom Design System — Glassmorphism) |
| **Database** | Firebase Firestore (Realtime) |
| **API Proxy** | Python FastAPI + vnstock |
| **Charts** | Custom SVG (LineChart, DonutChart) |
| **Container** | Docker + Docker Compose |
| **Font** | Inter (Google Fonts) |

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed
- A Firebase project with Firestore enabled

### 1. Clone the repository

```bash
git clone https://github.com/your-username/portfolio_assets_management.git
cd portfolio_assets_management
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
# Firebase Config
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# vnstock API Proxy
VNSTOCK_API_ENABLED=true
LOG_LEVEL=INFO
VNSTOCK_API_KEY=your_vnstock_api_key

COINGECKO_API_KEY=your_coingecko_api_key
```

### 3. Start the application

```bash
docker-compose up --build
```

### 4. Open the app

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Proxy**: [http://localhost:8000](http://localhost:8000)
- **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)

### 5. First-time setup

1. Click **"Import CSV"** in the sidebar to load your transaction history
2. Go to **Quỹ Đầu tư** → Deposit initial cash into each fund
3. Go to **Bảng giá** → Enter today's market prices
4. The dashboard will auto-calculate everything! 🎉

---

## 📁 Project Structure

```
├── src/
│   ├── App.jsx                      # Main app (6 tabs)
│   ├── index.css                    # Premium design system
│   ├── firebase.js                  # Firebase config
│   ├── main.jsx                     # Entry point
│   ├── components/
│   │   ├── AddTransactionModal.jsx  # Transaction form (fund-linked)
│   │   ├── AssetAllocationChart.jsx # SVG donut chart
│   │   ├── FundManager.jsx          # Fund management
│   │   ├── LiabilitiesManager.jsx   # Debt tracking
│   │   ├── NetWorthExternalManager.jsx
│   │   ├── PriceManager.jsx         # Daily price entry
│   │   ├── RebalanceSettings.jsx    # Target weights editor
│   │   ├── TransactionLog.jsx       # Transaction history
│   │   └── charts/
│   │       └── LineChart.jsx        # SVG line chart
│   ├── services/
│   │   └── firestoreService.js      # Firebase CRUD (8 collections)
│   ├── utils/
│   │   ├── formatters.js            # Number/currency formatting
│   │   └── portfolioCalculator.js   # Calculation engine
│   └── scripts/
│       └── importCSV.js             # CSV data importer
├── api/
│   ├── main.py                      # FastAPI + vnstock proxy
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml               # 2 services: webapp + api
├── Dockerfile                       # Frontend container
├── .env                             # Environment variables
└── package.json
```

---

## 🗄️ Firebase Collections

| Collection | Purpose |
|-----------|---------|
| `transactions` | Buy/Sell/Deposit transaction history |
| `externalAssets` | Assets outside portfolio (bank, gold, TOPI) |
| `liabilities` | Debts and loans |
| `funds` | Investment fund definitions + cash balance |
| `dailySnapshots` | Daily portfolio/net worth snapshots |
| `dailyPrices` | Manual market price entries per day |
| `marketPrices` | Current market prices (API-updated) |
| `settings` | Rebalance target weights |

---

## 🔧 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VNSTOCK_API_ENABLED` | `true` | Enable/disable the vnstock API proxy |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |

Set `VNSTOCK_API_ENABLED=false` in `.env` to disable the API proxy without shutting down the service.

API logs are stored at `./logs/vnstock_api.log`.

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>🎨 A Vibe Coding Project</strong><br/>
  <em>Built with AI-assisted development — where creativity meets automation</em>
</p>
