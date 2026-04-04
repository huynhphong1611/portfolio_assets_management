# 📊 Portfolio Manager V5.2 — Advanced Digital Asset Management

> **A Vibe Coding Project** — Built with AI-assisted development by Google Deepmind (Antigravity Agent)
> Comprehensive personal portfolio management with fund-based architecture, real-time Firebase sync, Vietnamese stock market integration (VnStock & FMarket), Crypto APIs (CoinGecko), and automated Dockerized Vitest execution.

---

## ✨ Core Features

### 🏠 Dashboard — Tổng quan Tài sản
- **Net Worth tracking** — Total Assets minus Liabilities.
- **Assets vs Liabilities** visualization with gradient progress bars.
- **Growth charts** — Track net worth changes over time with daily snapshots.
- **External assets** — TOPI, bank deposits, real estate.
- **Liabilities management** — Bank loans, credit cards.

### 💼 Danh mục Đầu tư — Portfolio Overview
- **All holdings at a glance** — Mathematical verification via FIFO rules.
- **Asset allocation** donut chart (Bonds, Stocks, Crypto, Gold, Cash).
- **Portfolio growth chart** — Value, Cost Basis, P&L over time.

### 🏦 Quỹ Đầu tư & Crypto — API Connectivity
- **Automated Pricing**:
  - Fetches VN Stock & Fund NAVs from [vnstock](https://github.com/thinh-vu/vnstock).
  - Fetches Crypto USD from **CoinGecko API** (Historical + Realtime).
- **Rate Limit Resilience**: Implemented 60-second In-Memory Server Caching to protect against vnstock community rate drops.
- **Smart Validation**: Handles SystemExits and API blocks gracefully, routing warnings back to React.

### 🧪 Automated QA Testing (Vitest & Docker)
- Integrated heavily with `vitest` for core logic testing (`portfolioCalculator.js`).
- Complete isolated testing via Docker environments without dirtying host machines.
- Verifies Crypto (`USDT` chained conversion), FMarket Funds, VNĐ Cash pooling logic strictly!

---

## 🏗️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 5, Lucide Icons |
| **Logic Testing**| Vitest, @vitest/coverage-v8 |
| **Database** | Firebase Firestore (Realtime) |
| **Backend Proxy**| Python FastAPI + Uvicorn |
| **Data APIs** | `vnstock >=3.0.0` (Community Keys), `CoinGecko` |
| **Container** | Docker Engine & Docker Compose |

---

## 🚀 Quick Setup & Configuration

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed & Running
- Firebase API Keys

### 1. Environment Configuration (`.env`)
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

# vnstock API Proxy & Rate Limiting Guard
VNSTOCK_API_ENABLED=true
LOG_LEVEL=INFO

# Third Party APIs
VNSTOCK_API_KEY=your_vnstock_community_key
COINGECKO_API_KEY=your_coingecko_api_key
```

### 2. Start the App via Docker
Build and launch the complete stack immediately:
```bash
docker-compose up -d --build
```
- **React App**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Core**: [http://localhost:8000](http://localhost:8000)

### 3. Run Automated Logic Tests
The project features an automated QA Pipeline configured via Vitest directly inside the Docker `webapp` container to preserve your local Host ecosystem!

```bash
docker-compose exec webapp npm run test
```

*This verifies your USD conversion scalings, Portfolio NAV logic, and VNĐ mapping using dynamic mock datasets!*

---

## 📁 Project Structure

```
├── src/
│   ├── App.jsx                      # Main app structure
│   ├── firebase.js                  # Firebase configurations
│   ├── components/
│   │   ├── PriceManager.jsx         # Auto-fetch via APIs 
│   │   └── ...                      
│   ├── utils/
│   │   ├── portfolioCalculator.js   # Advanced calculation engine
│   │   └── __tests__/               # Vitest Mock Datasets & QA Test Suites
├── api/
│   ├── main.py                      # Python FastAPI (vnstock + Caching logic)
│   ├── requirements.txt             # python-dotenv, fastapi, vnstock
│   └── Dockerfile
├── docker-compose.yml               # WebApp + API orchestration
├── README.md      
└── package.json                     # Vitest definitions
```

---

## 🗄️ Firebase Collections Roadmap

| Collection | Purpose |
|-----------|---------|
| `transactions` | Buy/Sell/Deposit transactions |
| `externalAssets` | Assets outside portfolio |
| `liabilities` | Debts and loans |
| `funds` | Virtual Investment divisions |
| `dailySnapshots` | Daily history charts source |

---

<p align="center">
  <strong>🛡️ Coded by QATester Agent & Fullstack Agent</strong><br/>
  <em>Built with AI-assisted development — Ensuring High Quality & Bulletproof Logic Execution!</em>
</p>
