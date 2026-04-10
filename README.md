# 📊 Portfolio Manager V6.0 — Fullstack Digital Asset Management

> **A Vibe Coding Project** — Built with AI-assisted development by Google Deepmind (Antigravity Agent)
> Fullstack personal portfolio management with Python FastAPI backend, React frontend, Firebase Firestore, Vietnamese stock market integration (vnstock & FMarket), Crypto APIs (CoinGecko auto-detect), and automated daily scheduling.

---

## ✨ Core Features

### 🏠 Dashboard — Tổng quan Tài sản
- **Net Worth tracking** — Total Assets minus Liabilities
- **Assets vs Liabilities** visualization with gradient progress bars
- **Growth charts** — Track net worth changes over time with daily snapshots
- **External assets** — TOPI, bank deposits, real estate
- **Liabilities management** — Bank loans, credit cards

### 💼 Danh mục Đầu tư — Portfolio Overview
- **All holdings at a glance** — Mathematical verification via FIFO rules
- **Asset allocation** donut chart (Bonds, Stocks, Crypto, Gold, Cash)
- **Portfolio growth chart** — Value, Cost Basis, P&L over time

### 📊 Bảng giá Động — Dynamic Price Board
- **Auto-derived from portfolio** — Ticker list pulled from actual transactions, no hardcoded list
- **Base items** (USDT/VND, Vàng SJC) always visible
- **Fetch prices via API** — vnstock for VN stocks/funds, CoinGecko for crypto
- **CoinGecko Auto-Detect** — Unknown crypto tickers auto-resolved via search API

### 🤖 Auto Scheduler — Daily 9AM Job
- **Backend APScheduler** running at 9:00 AM Asia/Ho_Chi_Minh
- **For each user**: extract portfolio tickers → batch fetch prices → save daily prices → update market prices → generate snapshot
- **Manual trigger**: `POST /api/scheduler/run-now`
- **Status check**: `GET /api/scheduler/status`

### 🏦 Fund & API Connectivity
- **vnstock** — VN Stock & Fund NAVs from fmarket
- **CoinGecko** — Crypto prices in USD (realtime + historical)
- **Rate Limit Resilience** — 60-second in-memory caching, 0.5s delay between batch requests
- **Smart Fallback** — Unknown tickers try stock → CoinGecko auto-detect

### 🔐 Authentication
- **Firebase Auth** — For production users (ID token verification)
- **Guest Auth** — SHA-256 password hashing with JWT session tokens
- **User data isolation** — `system_users/{uid}/...` vs `guest_users/{uid}/...`

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Lucide Icons |
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
│   ├── App.jsx                      # Main app with tab navigation
│   ├── components/
│   │   ├── PriceManager.jsx         # Dynamic price board (from portfolio)
│   │   ├── TransactionLog.jsx       # Transaction history
│   │   ├── AddTransactionModal.jsx  # Add buy/sell transactions
│   │   ├── FundManager.jsx          # Investment fund management
│   │   ├── RebalanceSettings.jsx    # Portfolio rebalancing targets
│   │   ├── NetWorthExternalManager.jsx  # External assets
│   │   ├── LiabilitiesManager.jsx   # Debt management
│   │   └── Auth/Login.jsx           # Login (Firebase + Guest)
│   ├── services/
│   │   └── api.js                   # API client (JWT auth, REST calls)
│   ├── contexts/
│   │   └── AuthContext.jsx          # Auth state management
│   └── utils/
│       ├── portfolioCalculator.js   # Client-side calculations
│       └── formatters.js            # Number & currency formatting
│
├── backend/                         # Python FastAPI Backend
│   ├── app/
│   │   ├── main.py                  # App entry + scheduler startup
│   │   ├── config.py                # Settings from environment
│   │   ├── firebase_init.py         # Firebase Admin SDK
│   │   ├── routers/
│   │   │   ├── auth.py              # Login/register + JWT
│   │   │   ├── transactions.py      # CRUD transactions
│   │   │   ├── funds.py             # CRUD funds
│   │   │   ├── prices.py            # Price fetch + save
│   │   │   ├── dashboard.py         # Aggregated portfolio data
│   │   │   ├── scheduler.py         # Scheduler status + manual trigger
│   │   │   ├── snapshots.py         # Daily snapshots
│   │   │   ├── external_assets.py   # External assets
│   │   │   ├── liabilities.py       # Liabilities
│   │   │   └── settings.py          # Rebalance targets
│   │   ├── services/
│   │   │   ├── auth_service.py      # Auth logic (JWT, SHA-256, Firebase)
│   │   │   ├── firestore_service.py # Firestore CRUD operations
│   │   │   ├── portfolio_service.py # Portfolio calculations engine
│   │   │   ├── price_service.py     # vnstock + CoinGecko fetching
│   │   │   └── scheduler.py         # APScheduler daily job
│   │   ├── models/
│   │   │   └── schemas.py           # Pydantic request models
│   │   └── utils/
│   │       └── cache.py             # In-memory TTL cache
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml               # Backend + Frontend orchestration
├── vite.config.js                   # Vite dev server + API proxy
└── .env                             # Secrets (gitignored)
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
| `transactions` | Buy/Sell/Deposit transaction history |
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
| GET/POST | `/api/prices/daily` | User daily prices |
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
