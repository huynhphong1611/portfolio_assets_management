# Changelog

All notable changes to this project will be documented in this file.

## [2026-09-27] — user-owned securities & data
### Added
- **securities**: Per-user securities and price history (`securities/{ticker}`, `securityPrices/{ticker}`) with Portfolio Performance style quote feeds: `AUTO` (system prices), `MANUAL` (entered or imported by the user), `GENERIC-JSON` (URL + JSONPath + factor). New `/api/securities` router and a security editor in the All Securities view (feed configuration, feed test, manual prices, missing-price warnings).
- **feeds**: `quote_feed_service.py` downloads JSON feeds with SSRF guards (public IPs only, default ports, no redirects, 1 MB / 10 s limits) and a JSONPath subset.
- **import**: Backend CSV import for transactions and historical prices with dry-run preview, per-row errors, duplicate detection, Vietnamese and international number formats; reads the legacy Google Form sheet and the app's own export.
- **backup**: Full workspace export and idempotent restore (`/api/data/export`, `/api/data/import/workspace`).
- **tests**: Backend pytest suite running without Firebase; frontend tests for the price resolver.

### Changed
- **valuation**: Frontend, scheduler, snapshot backfill and dashboard value holdings with system prices overlaid by the user's own prices (MANUAL/JSON win, AUTO only fills gaps).
- **scheduler**: The ticker universe includes every user's AUTO securities; JSON feeds are refreshed per user before snapshots.
- **prices**: System daily prices are merged per date instead of overwritten.

### Security
- **prices**: Removed `POST /api/prices/market` and `POST /api/prices/system-tickers`, which let any signed-in user overwrite shared prices and tickers. `POST /api/prices/fetch-live` now only fetches the caller's own AUTO tickers.

### Removed
- **import**: The client-side CSV import with hard-coded data (`src/scripts/importCSV.js`, `src/services/firestoreService.js`); it wrote to Firestore from the browser and was blocked for guest users.

## [2026-09-27]
### Changed
- **ui**: Restructured the whole user app after Portfolio Performance: navigation tree (General Data / Accounts / Reports / Taxonomies), global reporting period, hash routes for every view, flat desktop-style theme (`src/styles/pp.css`), responsive drawer on mobile.
- **architecture**: Split the 650-line `App.jsx` into `PortfolioDataContext`, `ReportingPeriodContext`, `layout/` and one component per view under `src/views/`.
- **charts**: Charts measure their container width, use round axis ticks and month/year labels on long ranges.

### Added
- **performance**: `performanceEngine.js` with TTWROR, IRR, absolute change, delta, max drawdown (+ duration), volatility, semi-volatility, monthly/yearly returns, trades and per-security performance.
- **reports**: Statement of Assets, Performance (Calculation, Chart with Returns/Volatility, Securities, Payments, Trades), Securities and Deposit Accounts (running cash balance), All Securities with price history, Exchange Rates, Asset Classes taxonomy with rebalancing amounts, custodian taxonomy, CSV export of transactions.
- **transactions**: New `Cổ tức` type (dividends, coupons, interest) in the JS engine, the Python engine and the API schema.
- **api**: `GET /api/prices/daily` accepts `limit` (1–1000).

### Fixed
- **transactions**: Editing a `Rút tiền` transaction no longer opens with an empty amount.
- **snapshots**: Snapshots created by the app use the local calendar date instead of the UTC date.
- **tests**: Mock market prices now use VND (as stored by the backend); the 2 previously failing calculator tests pass.

### Removed
- **ui**: `CumulativePerformanceChart` and `SystemPricesBoard`, replaced by the Performance Chart and All Securities views.

## [2026-05-03]
### Fixed
- **api**: Fixed 422 Unprocessable Entity error when selling USDC or performing cash transactions. Updated schema to support USDC currency, negative quantities for sales, and optional tickers for deposits/withdrawals. [AI: Gemini 3 Flash]

## [2026-05-02]
### Changed
- **workflows**: Updated `pre_commit_scan.md` to be more structured and instructed AI to adopt `SecurityOps_Agent` persona. [AI: Gemini 3.1 Pro (High)]

### Fixed
- **price_service**: Fixed Bitcoin (USD) benchmark data fetching. Added fallback to 365 days if `days=max` returns 401/403 (Free tier limit). [AI: Gemini 3 Flash]
- **charts**: Resolved overlapping x-axis labels in charts.

### Added
- **docs**: Created a comprehensive project Wiki in the `wiki/` directory covering architecture, APIs, deployment, and features. [AI: Gemini 3.1 Pro (Low)]
- **agents**: Added `repo_wiki` AI agent skill for managing GitHub/GitLab repository wikis. [AI: Gemini 3.1 Pro (Low)]
- **charts**: Added 100% stacked area chart and user-rebased 'All' time range.

## [2026-04-26]
### Added
- **security**: Security hardening and improvements.
- **scheduler**: Fixed daily portfolio scheduler.

## [2026-04-25]
### Added
- **docs**: Added deployment guide.
- **prices**: Added edit prices functionality.

## [2026-04-24]
### Fixed
- **accounting**: Resolved negative `totalCost` bug in P&L calculation. [AI: Gemini 3.1 Pro (High)]
- **data**: Added historical market data import script. [AI: Gemini 3.1 Pro (High)]

## [2026-04-22]
### Added
- **snapshots**: Implemented historical snapshot backfill functionality.
- **prices**: Integrated admin-controlled price sync. [AI: Gemini 1.5 Pro]

### Fixed
- **ui**: Added missing `Calendar` import in `App.jsx`.
- **api**: Fixed typo in `api.js` and ensured fetch API prices if missing in backfill.

### Refactored
- **cleanup**: Removed dead user-scoped `dailyPrices` code and `PriceManager` component. [AI: Claude Sonnet]
- **accounting**: Refined portfolio P&L accounting logic. [AI: Gemini 1.5 Pro]

## [2026-04-21]
### Added
- **admin**: Implemented Admin Portal with centralized system prices and role-based Auth. [AI: Gemini 3.1 Pro (High)]

## [2026-04-15]
### Fixed
- **trigger**: Fixed trigger issue.
- **prices**: Injected user-specific fallback prices into snapshot portfolio calculation. [AI: Gemini 3.1 Pro]
- **scheduler**: Resolved scheduler fallback corruption and performance chart calculation. [AI: Gemini 2.0 Flash]

## [2026-04-13]
### Fixed
- **prices**: Sanitized legacy stablecoin prices in `PriceManager` (ensures USDT defaults to 25,500 VND). [AI: Gemini 3.1 Pro (High)]
- **kpi**: Synchronized portfolio KPIs and optimized auto-save logic. [AI: Gemini 3.1 Pro (High)]
- **scheduler**: Added backend fallback logic to retain known market price if fetch fails. [AI: Gemini 3.1 Pro (High)]

### Added
- **crypto**: Added USDC and Gold (SJC) price tracking via CoinGecko and vang.today. [AI: Gemini 3.1 Pro (High)]
- **ui**: Updated `AddTransactionModal` and `PriceManager` for new assets. [AI: Gemini 3.1 Pro (High)]

## [2026-04-12]
### Added
- **transactions**: Implemented `AddTransactionModal` with validation and fund balance updates.
- **scheduler**: Implemented scheduler service with support for standalone and serverless modes.
- **docs**: Added deployment guide for portfolio assets management system. [AI: Gemini 3.1 Pro (High)]

### Fixed
- **ui**: Displayed logout and snapshot buttons in mobile menu.

## [2026-04-11]
### Added
- **scheduler**: Implemented backend scheduler service with external cron support.
- **config**: Added VS Code QA agent configurations.

## [2026-04-10]
### Added
- **security**: Updated Firestore security rules.
- **ui**: Implemented `TransactionLog` component with filtering and sorting.
- **management**: Implemented `PriceManager` and `FundManager` components.
- **charts**: Added Cumulative Performance Chart with VN-Index and BTC benchmarks.
- **refactor**: Fullstack refactor (v6.0) with dynamic prices and auto-scheduler. [AI: Antigravity]

## [2026-04-06]
### Added
- **auth**: Implemented Dual Auth. [AI: Gemini 3.1 Pro (High)]

### Fixed
- **security**: Isolated Firebase and custom auth data. [AI: Gemini 3.1 Pro (High)]
- **pnl**: Fixed crypto PnL fallback. [AI: Gemini 3.1 Pro (High)]

## [2026-04-04]
### Added
- **qa**: Implemented Dockerized Vitest coverage.
- **api**: Integrated CoinGecko APIs and VnStock Community Tier Authentication.

## [2026-04-01]
### Added
- **core**: Initial implementation of portfolio management engine and calculation utilities.
- **migration**: Migrated codebase to React with Firebase integration.

## [2026-03-28]
### Added
- **ui**: Initial web UI with mock data.

## [2024-05-08]
- Initial commit.
