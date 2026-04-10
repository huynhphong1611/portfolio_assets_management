---
name: fullstack_implementation
description: Comprehensive guidelines for building fullstack applications with React frontend, Python FastAPI backend, and Firebase. Covers architecture, API design, state management, styling, error handling, and mobile-first responsive design.
---

# Fullstack Implementation Guidelines

## Project Structure

### Frontend (React + Vite)
```
src/
├── components/          # Reusable UI components
│   ├── charts/          # Chart/visualization components
│   ├── Auth/            # Authentication components
│   └── ui/              # Generic UI primitives (Button, Modal, Input...)
├── pages/               # Page-level components (one per route)
├── hooks/               # Custom React hooks
├── contexts/            # React Context providers
├── services/            # API calls and external service wrappers
│   ├── api.js           # Backend API client (fetch/axios wrapper)
│   └── firestoreService.js  # Direct Firestore operations (if needed)
├── utils/               # Pure utility functions (formatters, calculators)
├── scripts/             # One-off scripts (CSV import, migration)
├── assets/              # Static assets (images, fonts)
├── index.css            # Global styles + design tokens
└── main.jsx             # App entry point
```

### Backend (Python FastAPI)
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app factory, middleware, CORS
│   ├── config.py             # Settings via pydantic-settings / env vars
│   ├── routers/              # Route handlers grouped by domain
│   │   ├── __init__.py
│   │   ├── auth.py           # Auth endpoints
│   │   ├── portfolio.py      # Portfolio CRUD
│   │   ├── prices.py         # Market price endpoints (vnstock, CoinGecko)
│   │   ├── transactions.py   # Transaction CRUD
│   │   └── snapshots.py      # Daily snapshot endpoints
│   ├── services/             # Business logic layer
│   │   ├── __init__.py
│   │   ├── firebase_service.py   # Firestore read/write operations
│   │   ├── price_service.py      # Price fetching + caching logic
│   │   ├── portfolio_service.py  # Holdings, P&L, rebalance calculations
│   │   └── auth_service.py       # Authentication logic
│   ├── models/               # Pydantic models for request/response
│   │   ├── __init__.py
│   │   ├── transaction.py
│   │   ├── portfolio.py
│   │   └── common.py         # Shared response wrappers
│   └── utils/                # Helper functions
│       ├── __init__.py
│       ├── formatters.py
│       └── cache.py          # TTL cache implementation
├── tests/
│   ├── test_prices.py
│   └── test_portfolio.py
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## React Architecture

### Component Design
1. **Single Responsibility**: Each component does ONE thing. If it grows past ~150 lines, split it.
2. **Smart vs Dumb**: Pages/containers fetch data and manage state. UI components receive props and render.
3. **Composition over Inheritance**: Use children, render props, or hooks — never class inheritance.

### State Management
```jsx
// ✅ GOOD — Context for globally shared state
// contexts/PortfolioContext.jsx
const PortfolioContext = createContext();

export function PortfolioProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derived state via useMemo — not separate useState
  const holdings = useMemo(() => calculateHoldings(transactions), [transactions]);
  const portfolio = useMemo(() => calculatePortfolio(holdings, marketPrices), [holdings, marketPrices]);

  return (
    <PortfolioContext.Provider value={{ transactions, holdings, portfolio, loading }}>
      {children}
    </PortfolioContext.Provider>
  );
}

// Custom hook for consuming
export const usePortfolio = () => useContext(PortfolioContext);
```

### API Client Pattern
```jsx
// services/api.js — Central API client
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(endpoint, options = {}) {
  const { method = 'GET', body, token } = options;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// Typed API functions
export const api = {
  // Portfolio
  getPortfolio: (userId) => request(`/portfolio/${userId}`),
  getDashboard: (userId) => request(`/dashboard/${userId}`),

  // Transactions
  getTransactions: (userId) => request(`/transactions/${userId}`),
  addTransaction: (userId, data) => request(`/transactions/${userId}`, { method: 'POST', body: data }),
  deleteTransaction: (userId, txId) => request(`/transactions/${userId}/${txId}`, { method: 'DELETE' }),

  // Prices
  fetchPrices: (symbols, date) => request(`/prices/batch?symbols=${symbols.join(',')}&date=${date || ''}`),
  saveDailyPrices: (userId, date, prices) => request(`/prices/daily/${userId}`, { method: 'POST', body: { date, prices } }),

  // Snapshots
  getSnapshots: (userId) => request(`/snapshots/${userId}`),
  saveSnapshot: (userId, data) => request(`/snapshots/${userId}`, { method: 'POST', body: data }),

  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  register: (credentials) => request('/auth/register', { method: 'POST', body: credentials }),
};
```

### Hooks Pattern
```jsx
// hooks/useAsyncAction.js — Reusable async state handler
export function useAsyncAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (asyncFn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute, clearError: () => setError(null) };
}
```

---

## CSS & Styling

### Design Tokens (CSS Custom Properties)
```css
/* index.css — Define once, use everywhere */
:root {
  /* Colors */
  --color-primary-400: #818cf8;
  --color-primary-500: #6366f1;
  --color-primary-600: #4f46e5;
  --color-emerald-400: #34d399;
  --color-emerald-500: #10b981;
  --color-rose-400: #fb7185;
  --color-rose-500: #f43f5e;

  /* Surfaces */
  --bg-main: #0f172a;
  --bg-card: rgba(30, 41, 59, 0.6);
  --glass-bg: rgba(30, 41, 59, 0.4);
  --glass-border: rgba(148, 163, 184, 0.1);

  /* Text */
  --text-main: #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Spacing scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### Rules
1. **No inline styles for layout**. Only use `style={}` for truly dynamic values (e.g., `width` from a calculation).
2. **BEM-like naming**: `.card`, `.card__header`, `.card--expanded`.
3. **Mobile-first media queries**: Base styles = mobile. Add `@media (min-width: 768px)` for tablet, `@media (min-width: 1024px)` for desktop.
4. **Use `clamp()` for responsive typography**: `font-size: clamp(0.875rem, 2vw, 1rem)`.
5. **Transitions on interactive elements**: All buttons, links, cards should have `transition: var(--transition-fast)`.

---

## Backend — FastAPI Patterns

### Router Structure
```python
# routers/prices.py
from fastapi import APIRouter, Query, HTTPException, Depends
from app.services.price_service import PriceService
from app.models.common import APIResponse

router = APIRouter(prefix="/api/prices", tags=["prices"])

@router.get("/stock/{symbol}", response_model=APIResponse)
async def get_stock_price(
    symbol: str,
    source: str = Query("VCI", description="Data source"),
    target_date: str | None = Query(None, description="YYYY-MM-DD"),
    price_svc: PriceService = Depends(),
):
    """Fetch price for a single symbol (auto-detects stock vs fund vs crypto)."""
    result = await price_svc.get_price(symbol.upper(), source, target_date)
    if not result:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return APIResponse(data=result)
```

### Pydantic Models
```python
# models/common.py
from pydantic import BaseModel
from typing import Any, Optional

class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    error: Optional[str] = None

class PaginatedResponse(APIResponse):
    total: int = 0
    page: int = 1
    per_page: int = 20
```

### Error Handling
```python
# main.py — Global exception handlers
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": str(exc)}
    )
```

### Caching Pattern
```python
# utils/cache.py
import time
from typing import Any

class TTLCache:
    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str, ttl: int = 60) -> Any | None:
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < ttl:
                return value
            del self._store[key]
        return None

    def set(self, key: str, value: Any):
        self._store[key] = (value, time.time())

cache = TTLCache()
```

---

## Firebase Firestore

### Document Schema Design
```
Firestore Structure:
├── users/                  # Guest user credentials (SHA-256)
│   └── {userId}
├── guest_users/            # Guest user data partition
│   └── {userId}/
│       ├── transactions/   # Buy/Sell/Deposit records
│       ├── funds/          # Investment funds
│       ├── externalAssets/  # Assets outside portfolio
│       ├── liabilities/    # Debts
│       ├── dailySnapshots/ # Daily net worth snapshots
│       ├── dailyPrices/    # Manual price entries
│       └── settings/       # User preferences (rebalance targets)
├── system_users/           # Firebase Auth user data (same sub-collections)
│   └── {uid}/...
└── marketPrices/           # Global shared price data
    └── {ticker}
```

### Rules
1. **Always use sub-collections** for user-scoped data — never put user data at root level.
2. **Batch writes** for multi-document mutations:
   ```python
   batch = db.batch()
   for item in items:
       ref = db.collection("users").document(uid).collection("transactions").document()
       batch.set(ref, item)
   batch.commit()
   ```
3. **Real-time listeners** must be cleaned up:
   ```jsx
   useEffect(() => {
     const unsub = onSnapshot(query, callback);
     return () => unsub(); // ← ALWAYS clean up
   }, [dependency]);
   ```
4. **Handle errors** on every Firestore call — network failures, permission denied, quota exceeded.

---

## Mobile-First Responsive Design

### Breakpoints
```css
/* Mobile first — base styles are for phones */
.container { padding: 1rem; }

/* Tablet */
@media (min-width: 768px) {
  .container { padding: 1.5rem; }
  .grid { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop */
@media (min-width: 1024px) {
  .container { padding: 2rem; }
  .grid { grid-template-columns: repeat(3, 1fr); }
  .sidebar { display: flex; }
}
```

### Touch-Friendly Rules
1. **Minimum tap target**: 44×44px for all interactive elements.
2. **No hover-only interactions**: Anything triggered by hover must also work on tap.
3. **Swipe-friendly**: Use horizontal scroll for tables on mobile instead of forcing tiny text.
4. **Bottom navigation**: On mobile, primary actions go at the bottom of the screen for thumb reach.

---

## Error Handling Checklist

### Frontend
- [ ] Every `fetch` / API call wrapped in try/catch
- [ ] Loading states shown during async operations
- [ ] Error messages displayed to user (toast / inline)
- [ ] Retry option for transient failures
- [ ] Graceful fallback when data is unavailable

### Backend
- [ ] Input validation via Pydantic models
- [ ] Custom HTTP exceptions with clear error messages
- [ ] Global exception handler for uncaught errors
- [ ] Structured logging with request context
- [ ] Rate limit handling for external APIs (vnstock, CoinGecko)
- [ ] Timeout on all external HTTP calls

---

## Security Checklist

- [ ] All secrets in `.env` — never hardcoded
- [ ] `.env` listed in `.gitignore`
- [ ] Firestore rules enforce user data isolation
- [ ] Backend validates all input server-side (never trust frontend)
- [ ] CORS configured with specific origins (not `*` in production)
- [ ] API keys for external services stored server-side only
- [ ] Run `/pre_commit_scan` workflow before every commit
