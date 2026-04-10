---
name: test_automation
description: Comprehensive guidelines for writing unit tests, integration tests, and E2E tests across React frontend (Vitest + React Testing Library) and Python backend (Pytest + FastAPI TestClient). Includes mock data generation, fixture factories, coverage configuration, and CI pipeline patterns.
---

# Test Automation Skill

## Test Philosophy

**AAA Pattern** — Every test follows:
1. **Arrange** — Set up data, mocks, and environment.
2. **Act** — Execute the function or trigger the interaction.
3. **Assert** — Verify the expected outcome.

**Test Pyramid** — Prioritize:
- 70% Unit tests (fast, isolated)
- 20% Integration tests (module interactions)
- 10% E2E tests (critical user flows)

---

## Frontend Testing — Vitest + React Testing Library

### Configuration

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/utils/**', 'src/services/**', 'src/components/**', 'src/hooks/**'],
      exclude: ['src/**/*.test.*', 'src/scripts/**', 'node_modules/'],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
      },
    },
  },
});
```

```javascript
// src/setupTests.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase globally
vi.mock('./firebase', () => ({
  db: {},
  auth: {},
  default: {},
}));

// Mock window.alert / confirm
global.alert = vi.fn();
global.confirm = vi.fn(() => true);
```

### Unit Testing Pure Functions

```javascript
// src/utils/__tests__/portfolioCalculator.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateHoldings,
  calculatePortfolio,
  calculateNetWorth,
  calculateRebalance,
  calculateTotalPnL,
  generateSnapshot,
} from '../portfolioCalculator';

// ── Test Data Factory ──
function tx(overrides = {}) {
  return {
    date: '01/01/2026 10:00:00',
    transactionType: 'Mua',
    assetClass: 'Trái phiếu',
    ticker: 'VFF',
    quantity: 100,
    unitPrice: 25000,
    totalVND: 2500000,
    currency: 'VNĐ',
    exchangeRate: 1,
    storage: 'Fmarket',
    fundId: null,
    fundName: null,
    ...overrides,
  };
}

describe('calculateHoldings', () => {
  it('returns [] for empty/null input', () => {
    expect(calculateHoldings([])).toEqual([]);
    expect(calculateHoldings(null)).toEqual([]);
    expect(calculateHoldings(undefined)).toEqual([]);
  });

  it('aggregates multiple buys of same ticker', () => {
    const result = calculateHoldings([
      tx({ quantity: 100, totalVND: 2500000 }),
      tx({ date: '02/01/2026 10:00:00', quantity: 50, totalVND: 1300000 }),
    ]);
    const vff = result.find(h => h.ticker === 'VFF');
    expect(vff.qty).toBe(150);
    expect(vff.totalCost).toBe(3800000);
    expect(vff.avgCost).toBeCloseTo(25333.33, 0);
  });

  it('reduces position on sell using average cost', () => {
    const result = calculateHoldings([
      tx({ quantity: 100, totalVND: 2500000 }),
      tx({ date: '02/01/2026 10:00:00', transactionType: 'Bán', quantity: 60, totalVND: 1800000 }),
    ]);
    const vff = result.find(h => h.ticker === 'VFF');
    expect(vff.qty).toBe(40);
  });

  it('removes fully sold positions', () => {
    const result = calculateHoldings([
      tx({ quantity: 100, totalVND: 2500000 }),
      tx({ date: '02/01/2026 10:00:00', transactionType: 'Bán', quantity: 100, totalVND: 3000000 }),
    ]);
    expect(result.find(h => h.ticker === 'VFF')).toBeUndefined();
  });

  it('handles VNĐ cash deposits', () => {
    const result = calculateHoldings([
      tx({ transactionType: 'Nạp tiền', assetClass: 'Tiền mặt VNĐ', ticker: 'VNĐ', quantity: 5000000, totalVND: 5000000 }),
    ]);
    const cash = result.find(h => h.ticker === 'VNĐ');
    expect(cash).toBeDefined();
    expect(cash.qty).toBe(5000000);
  });

  it('handles crypto with tiny quantities', () => {
    const result = calculateHoldings([
      tx({ ticker: 'PAXG', assetClass: 'Vàng', quantity: 0.01028, totalVND: 1333453 }),
    ]);
    const paxg = result.find(h => h.ticker === 'PAXG');
    expect(paxg.qty).toBeCloseTo(0.01028, 5);
  });

  it('handles multiple asset classes independently', () => {
    const result = calculateHoldings([
      tx({ ticker: 'VFF', assetClass: 'Trái phiếu', quantity: 100, totalVND: 2500000 }),
      tx({ ticker: 'VESAF', assetClass: 'Cổ phiếu', quantity: 50, totalVND: 1500000 }),
      tx({ ticker: 'CMCP', assetClass: 'Tài sản mã hóa', quantity: 532, totalVND: 13809288 }),
    ]);
    expect(result).toHaveLength(3);
  });
});

describe('calculatePortfolio', () => {
  it('uses market price when available', () => {
    const holdings = [{ ticker: 'VFF', assetClass: 'Trái phiếu', qty: 100, totalCost: 2500000, avgCost: 25000, currency: 'VNĐ' }];
    const prices = { VFF: { price: 26000 } };
    const result = calculatePortfolio(holdings, prices);
    expect(result[0].actualValue).toBe(2600000);
    expect(result[0].pnl).toBe(100000);
  });

  it('falls back to avgCost when no market price', () => {
    const holdings = [{ ticker: 'VFF', assetClass: 'Trái phiếu', qty: 100, totalCost: 2500000, avgCost: 25000, currency: 'VNĐ' }];
    const result = calculatePortfolio(holdings, {});
    expect(result[0].actualValue).toBe(2500000);
    expect(result[0].pnl).toBe(0);
  });

  it('converts crypto prices via USDT exchange rate', () => {
    const holdings = [{ ticker: 'CMCP', assetClass: 'Tài sản mã hóa', qty: 100, totalCost: 1400000, avgCost: 14000, currency: 'USDT' }];
    const prices = { USDT: { exchangeRate: 26000 }, CMCP: { price: 0.55 } };
    const result = calculatePortfolio(holdings, prices);
    expect(result[0].actualValue).toBe(100 * 0.55 * 26000);
  });
});

describe('calculateNetWorth', () => {
  it('separates liquid and investment assets', () => {
    const portfolio = [
      { ticker: 'VNĐ', assetClass: 'Tiền mặt VNĐ', actualValue: 5000000 },
      { ticker: 'VFF', assetClass: 'Trái phiếu', actualValue: 2500000 },
    ];
    const result = calculateNetWorth(portfolio, [], []);
    expect(result.totalLiquid).toBe(5000000);
    expect(result.totalInvest).toBe(2500000);
    expect(result.totalAssets).toBe(7500000);
    expect(result.totalNetWorth).toBe(7500000);
  });

  it('subtracts liabilities from net worth', () => {
    const portfolio = [{ ticker: 'VFF', assetClass: 'Trái phiếu', actualValue: 5000000 }];
    const liabilities = [{ amount: 2000000 }];
    const result = calculateNetWorth(portfolio, [], liabilities);
    expect(result.totalNetWorth).toBe(3000000);
  });

  it('includes external assets', () => {
    const externalAssets = [
      { id: '1', name: 'Saving', value: 10000000, group: 'Thanh khoản' },
      { id: '2', name: 'Gold', value: 5000000, group: 'Đầu tư' },
    ];
    const result = calculateNetWorth([], externalAssets, []);
    expect(result.totalLiquid).toBe(10000000);
    expect(result.totalInvest).toBe(5000000);
  });
});
```

### Component Testing

```javascript
// src/components/__tests__/TransactionLog.test.jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TransactionLog from '../TransactionLog';

const mockTransactions = [
  { id: '1', date: '01/01/2026 10:00:00', transactionType: 'Mua', assetClass: 'Trái phiếu', ticker: 'VFF', quantity: 100, unitPrice: 25000, totalVND: 2500000, storage: 'Fmarket' },
  { id: '2', date: '02/01/2026 14:00:00', transactionType: 'Bán', assetClass: 'Cổ phiếu', ticker: 'VESAF', quantity: 50, unitPrice: 36000, totalVND: 1800000, storage: 'SSI' },
];

describe('TransactionLog', () => {
  it('renders transactions table', () => {
    render(<TransactionLog transactions={mockTransactions} />);
    expect(screen.getByText('VFF')).toBeInTheDocument();
    expect(screen.getByText('VESAF')).toBeInTheDocument();
  });

  it('filters by search term', () => {
    render(<TransactionLog transactions={mockTransactions} />);
    const searchInput = screen.getByPlaceholderText(/Tìm mã/i);
    fireEvent.change(searchInput, { target: { value: 'VFF' } });
    expect(screen.getByText('VFF')).toBeInTheDocument();
    expect(screen.queryByText('VESAF')).not.toBeInTheDocument();
  });

  it('shows empty state when no transactions', () => {
    render(<TransactionLog transactions={[]} />);
    expect(screen.getByText(/Không có giao dịch/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TransactionLog transactions={[]} loading={true} />);
    expect(screen.getByText(/Đang tải/i)).toBeInTheDocument();
  });
});
```

### Mocking Firebase Services

```javascript
// src/services/__mocks__/firestoreService.js
import { vi } from 'vitest';

export const subscribeTransactions = vi.fn((callback) => {
  callback([]);
  return vi.fn(); // unsubscribe
});

export const addTransaction = vi.fn().mockResolvedValue('mock-id');
export const deleteTransaction = vi.fn().mockResolvedValue(undefined);
export const updateFund = vi.fn().mockResolvedValue(undefined);
export const saveDailyPrices = vi.fn().mockResolvedValue(undefined);
export const batchUpdateMarketPrices = vi.fn().mockResolvedValue(undefined);
export const getLatestDailyPrices = vi.fn().mockResolvedValue(null);
export const saveSnapshot = vi.fn().mockResolvedValue(undefined);
export const initializeDefaultFunds = vi.fn().mockResolvedValue(false);
```

---

## Backend Testing — Pytest + FastAPI

### Configuration

```ini
# pytest.ini (or pyproject.toml [tool.pytest.ini_options])
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks integration tests
```

```python
# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

@pytest.fixture
def client():
    """FastAPI test client."""
    from app.main import app
    return TestClient(app)

@pytest.fixture
def mock_firestore():
    """Mock Firestore database."""
    with patch("app.services.firebase_service.db") as mock_db:
        yield mock_db

@pytest.fixture
def sample_transactions():
    """Realistic test transaction data."""
    return [
        {
            "date": "01/01/2026 10:00:00",
            "transactionType": "Mua",
            "assetClass": "Trái phiếu",
            "ticker": "VFF",
            "quantity": 176.32,
            "unitPrice": 24838.54,
            "currency": "VNĐ",
            "exchangeRate": 1,
            "totalVND": 4379531.37,
            "storage": "Fmarket",
        },
        {
            "date": "02/01/2026 14:00:00",
            "transactionType": "Mua",
            "assetClass": "Cổ phiếu",
            "ticker": "VESAF",
            "quantity": 32.47,
            "unitPrice": 30788.61,
            "currency": "VNĐ",
            "exchangeRate": 1,
            "totalVND": 999706.17,
            "storage": "SSI",
        },
        {
            "date": "03/01/2026 10:00:00",
            "transactionType": "Mua",
            "assetClass": "Tài sản mã hóa",
            "ticker": "CMCP",
            "quantity": 532,
            "unitPrice": 1,
            "currency": "USDT",
            "exchangeRate": 25957.31,
            "totalVND": 13809288.92,
            "storage": "Binance",
        },
    ]

@pytest.fixture
def sample_market_prices():
    """Mock market price data."""
    return {
        "VFF": {"price": 25800, "type": "fund"},
        "VESAF": {"price": 36000, "type": "stock"},
        "USDT": {"price": 1, "exchangeRate": 26500},
        "CMCP": {"price": 0.55, "type": "crypto"},
    }
```

### API Endpoint Tests

```python
# tests/test_api_prices.py
import pytest
from unittest.mock import patch

class TestHealthEndpoint:
    def test_returns_ok(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "api_enabled" in data
        assert "version" in data

class TestStockPriceEndpoint:
    def test_valid_stock_symbol(self, client):
        with patch("app.routers.prices.price_service.get_price") as mock:
            mock.return_value = {"symbol": "VFF", "price": 25800, "type": "fund"}
            response = client.get("/api/prices/stock?symbol=VFF")
            assert response.status_code == 200
            assert response.json()["price"] == 25800

    def test_unknown_symbol_returns_404(self, client):
        with patch("app.routers.prices.price_service.get_price") as mock:
            mock.return_value = None
            response = client.get("/api/prices/stock?symbol=NONEXIST")
            assert response.status_code == 404

    def test_api_disabled_returns_503(self, client):
        with patch("app.config.settings.api_enabled", False):
            response = client.get("/api/prices/stock?symbol=VFF")
            assert response.status_code == 503

    def test_symbol_is_uppercased(self, client):
        with patch("app.routers.prices.price_service.get_price") as mock:
            mock.return_value = {"symbol": "VFF", "price": 25800}
            client.get("/api/prices/stock?symbol=vff")
            mock.assert_called_with("VFF", "VCI", None)

    @pytest.mark.parametrize("symbol", ["", " ", "A" * 100])
    def test_invalid_symbols_rejected(self, client, symbol):
        response = client.get(f"/api/prices/stock?symbol={symbol}")
        assert response.status_code in [400, 404, 422]

class TestBatchPriceEndpoint:
    def test_multiple_symbols(self, client):
        with patch("app.routers.prices.price_service.get_price") as mock:
            mock.side_effect = [
                {"symbol": "VFF", "price": 25800},
                {"symbol": "VESAF", "price": 36000},
            ]
            response = client.get("/api/prices/stocks?symbols=VFF,VESAF")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2

    def test_partial_failure_returns_mixed_results(self, client):
        with patch("app.routers.prices.price_service.get_price") as mock:
            mock.side_effect = [
                {"symbol": "VFF", "price": 25800},
                None,  # Second symbol fails
            ]
            response = client.get("/api/prices/stocks?symbols=VFF,INVALID")
            data = response.json()
            assert len(data) == 2
            assert data[0]["price"] == 25800
            assert data[1]["price"] is None
```

### Service Layer Tests

```python
# tests/test_price_service.py
import pytest
from unittest.mock import patch, MagicMock
from app.services.price_service import PriceService

class TestPriceService:
    def setup_method(self):
        self.service = PriceService()

    def test_detects_fund_symbol(self):
        assert self.service._is_fund("VFF") is True
        assert self.service._is_fund("VESAF") is True
        assert self.service._is_fund("FUEVN100") is False

    def test_detects_crypto_symbol(self):
        assert self.service._is_crypto("BTC") is True
        assert self.service._is_crypto("PAXG") is True
        assert self.service._is_crypto("VFF") is False

    def test_cache_returns_cached_value(self):
        self.service._cache.set("VFF_latest", {"price": 25800})
        result = self.service._cache.get("VFF_latest", ttl=60)
        assert result["price"] == 25800

    def test_cache_expires_after_ttl(self):
        import time
        self.service._cache.set("VFF_latest", {"price": 25800})
        time.sleep(0.1)
        result = self.service._cache.get("VFF_latest", ttl=0)  # Expired
        assert result is None
```

---

## Mock Data Factories

### JavaScript Factory
```javascript
// tests/factories.js
let idCounter = 0;

export function createTransaction(overrides = {}) {
  idCounter++;
  return {
    id: `tx_${idCounter}`,
    date: '01/01/2026 10:00:00',
    transactionType: 'Mua',
    assetClass: 'Trái phiếu',
    ticker: 'VFF',
    quantity: 100,
    unitPrice: 25000,
    currency: 'VNĐ',
    exchangeRate: 1,
    totalVND: 2500000,
    storage: 'Fmarket',
    fundId: 'fund_1',
    fundName: 'Quỹ Trái phiếu',
    notes: '',
    ...overrides,
  };
}

export function createFund(overrides = {}) {
  idCounter++;
  return {
    id: `fund_${idCounter}`,
    name: 'Quỹ Trái phiếu',
    assetClass: 'Trái phiếu',
    cashBalance: 5000000,
    description: 'Đầu tư trái phiếu',
    color: '#3b82f6',
    ...overrides,
  };
}

export function createExternalAsset(overrides = {}) {
  idCounter++;
  return {
    id: `ext_${idCounter}`,
    name: 'Tiết kiệm ngân hàng',
    value: 10000000,
    group: 'Thanh khoản',
    ...overrides,
  };
}

export function createLiability(overrides = {}) {
  idCounter++;
  return {
    id: `debt_${idCounter}`,
    name: 'Vay cá nhân',
    amount: 5000000,
    type: 'Vay cá nhân',
    interestRate: 0,
    ...overrides,
  };
}

export function createSnapshot(date, overrides = {}) {
  return {
    id: date,
    date,
    totalAssets: 50000000,
    totalLiabilities: 5000000,
    netWorth: 45000000,
    portfolioValue: 30000000,
    portfolioCost: 25000000,
    portfolioPnL: 5000000,
    portfolioPnLPercent: 20,
    ...overrides,
  };
}
```

### Python Factory
```python
# tests/factories.py
from datetime import datetime

_counter = 0

def create_transaction(**overrides):
    global _counter
    _counter += 1
    base = {
        "id": f"tx_{_counter}",
        "date": "01/01/2026 10:00:00",
        "transactionType": "Mua",
        "assetClass": "Trái phiếu",
        "ticker": "VFF",
        "quantity": 100,
        "unitPrice": 25000,
        "currency": "VNĐ",
        "exchangeRate": 1,
        "totalVND": 2500000,
        "storage": "Fmarket",
        "fundId": None,
        "fundName": None,
    }
    base.update(overrides)
    return base

def create_price_result(**overrides):
    base = {
        "symbol": "VFF",
        "price": 25800,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "source": "VCI",
        "type": "fund",
        "error": None,
    }
    base.update(overrides)
    return base
```

---

## Running Tests

### Commands
```bash
# ── Frontend ──
npm run test                    # Run all tests once
npm run test:watch              # Watch mode (re-run on changes)
npm run coverage                # Generate coverage report

# ── Backend ──
cd backend
pytest                          # Run all tests
pytest -v                       # Verbose output
pytest -x                       # Stop on first failure
pytest -k "test_price"          # Filter by name
pytest --cov=app                # Coverage report
pytest --cov=app --cov-report=html   # HTML coverage
pytest -m "not slow"            # Skip slow tests
```

### CI Pipeline Integration
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run coverage
      - uses: codecov/codecov-action@v4

  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest --cov=app --cov-report=xml
      - uses: codecov/codecov-action@v4
```
