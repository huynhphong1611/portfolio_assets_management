# 🐍 Architecture Backend — Kiến trúc Backend

## Tech Stack

| Công nghệ | Vai trò |
|-----------|---------|
| **Python 3.11** | Runtime |
| **FastAPI** | Web framework |
| **Uvicorn** | ASGI server |
| **APScheduler** | Background job scheduler |
| **Firebase Admin SDK** | Firestore & Auth |
| **vnstock ≥3.0.0** | VN stock/fund data |
| **requests** | HTTP client (CoinGecko, vang.today) |
| **python-dotenv** | Env var loading |
| **PyJWT** | JWT token handling |

## Cấu trúc thư mục

```
backend/
├── Dockerfile                     # Docker build config
├── requirements.txt               # Python dependencies
├── firebase-service-account.json  # 🔒 Firebase credentials (gitignored)
│
└── app/
    ├── __init__.py
    ├── main.py                    # FastAPI app + CORS + startup/shutdown
    ├── config.py                  # Settings class (env vars)
    ├── firebase_init.py           # Firebase Admin SDK initialization
    │
    ├── routers/                   # API route handlers
    │   ├── auth.py                # /api/auth/* — Login, Register, Verify
    │   ├── transactions.py        # /api/transactions — CRUD
    │   ├── funds.py               # /api/funds — CRUD
    │   ├── prices.py              # /api/prices/* — Price fetch & save
    │   ├── snapshots.py           # /api/snapshots/* — Daily snapshots
    │   ├── dashboard.py           # /api/dashboard — Aggregated data
    │   ├── scheduler.py           # /api/scheduler/* — Status & trigger
    │   ├── external_assets.py     # /api/external-assets — CRUD
    │   ├── liabilities.py         # /api/liabilities — CRUD
    │   ├── settings.py            # /api/settings — User preferences
    │   └── admin.py               # /api/admin/* — Admin portal APIs
    │
    ├── services/                  # Business logic layer
    │   ├── auth_service.py        # JWT encode/decode, SHA-256, Firebase verify
    │   ├── firestore_service.py   # Firestore CRUD (20KB — core data layer)
    │   ├── portfolio_service.py   # FIFO holdings, P&L, snapshot generation
    │   ├── price_service.py       # Multi-source price fetching engine
    │   └── scheduler.py           # APScheduler config + daily job logic
    │
    └── utils/
        └── cache.py               # In-memory TTL cache (60s default)
```

## Kiến trúc phân lớp

```
┌──────────────────────────────────────────────┐
│                  Routers (API Layer)          │
│  auth.py │ prices.py │ snapshots.py │ ...     │
├──────────────────────────────────────────────┤
│                 Services (Business Logic)     │
│  auth_service │ price_service │ portfolio_svc │
├──────────────────────────────────────────────┤
│              Data Layer (Firestore)           │
│           firestore_service.py                │
├──────────────────────────────────────────────┤
│           External APIs                       │
│  vnstock │ CoinGecko │ vang.today             │
└──────────────────────────────────────────────┘
```

## Các Service chính

### `price_service.py` — Engine lấy giá đa nguồn

Xem chi tiết tại [[Feature Price Service]]

**Luồng xử lý của `get_price()`:**
```
get_price(symbol, asset_type_hint)
  │
  ├── Stablecoin (USDT/USDC)? → CoinGecko VND rate
  ├── Gold (GOLD)?             → vang.today API
  ├── Fund (VFF, VESAF...)?    → vnstock Fund module
  ├── Crypto (BTC, ETH...)?    → CoinGecko USD price
  ├── Stock (explicit hint)?   → vnstock Quote (KBS source)
  │
  └── No hint? → Auto-detect:
       ├── Try stock first → vnstock
       └── If fail → Try CoinGecko auto-detect search
```

### `portfolio_service.py` — Tính toán danh mục

- **FIFO (First-In-First-Out)** — Tính giá vốn bán ra
- **Holdings calculation** — Từ transaction log → số lượng nắm giữ
- **P&L calculation** — Unrealized + Realized profit/loss
- **Snapshot generation** — Chụp nhanh trạng thái danh mục theo ngày

### `firestore_service.py` — Tầng dữ liệu

- CRUD cho tất cả collections (transactions, funds, snapshots...)
- Phân biệt `system_users/{uid}` vs `guest_users/{uid}`
- Batch operations cho market prices
- System-level prices tại `system/prices/daily/{date}`

### `scheduler.py` — Lịch trình tự động

Xem chi tiết tại [[Feature Scheduler]]

## Error Handling

- Global exception handler trong `main.py` — catch-all trả về 500
- Không leak stack traces ra client (bảo mật)
- Logging chi tiết vào file `logs/backend.log` + stdout
- Rate limit handling cho vnstock và CoinGecko

## Caching

- In-memory TTL cache (60 giây) cho fund listing
- CoinGecko ID cache — tránh search lặp lại
- Delay 0.5s giữa các request batch — tránh rate limit

---

## Xem thêm

- [[Architecture Overview]] — Tổng quan hệ thống
- [[Architecture Frontend]] — Frontend React
- [[Architecture Database]] — Firestore schema
- [[API Reference]] — Endpoints chi tiết
