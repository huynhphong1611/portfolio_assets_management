/**
 * Backend API Client
 * 
 * Replaces direct Firestore access with REST API calls to the Python backend.
 * All requests include JWT token for authentication.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Token Management ──

let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
}

export function getAuthToken() {
  return _authToken;
}

export function clearAuthToken() {
  _authToken = null;
}

// ── Core Request Function ──

async function request(endpoint, options = {}) {
  const { method = 'GET', body } = options;

  const headers = { 'Content-Type': 'application/json' };
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }

  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, config);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Unwrap APIResponse { success, data, error } */
async function requestData(endpoint, options = {}) {
  const res = await request(endpoint, options);
  if (res.success === false) {
    throw new Error(res.error || 'API error');
  }
  return res.data !== undefined ? res.data : res;
}

// ── Auth API ──

export async function apiGuestLogin(username, password) {
  return requestData('/auth/guest/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function apiGuestRegister(username, password) {
  return requestData('/auth/guest/register', {
    method: 'POST',
    body: { username, password },
  });
}

export async function apiFirebaseVerify(idToken) {
  return requestData('/auth/firebase/verify', {
    method: 'POST',
    body: { idToken },
  });
}

export async function apiGetMe() {
  return requestData('/auth/me');
}

// ── Transactions API ──

export async function apiGetTransactions() {
  return requestData('/transactions');
}

export async function apiAddTransaction(data) {
  return requestData('/transactions', { method: 'POST', body: data });
}

export async function apiUpdateTransaction(txId, data) {
  return requestData(`/transactions/${txId}`, { method: 'PUT', body: data });
}

export async function apiDeleteTransaction(txId) {
  return requestData(`/transactions/${txId}`, { method: 'DELETE' });
}

// ── Funds API ──

export async function apiGetFunds() {
  return requestData('/funds');
}

export async function apiAddFund(data) {
  return requestData('/funds', { method: 'POST', body: data });
}

export async function apiUpdateFund(fundId, data) {
  return requestData(`/funds/${fundId}`, { method: 'PUT', body: data });
}

export async function apiDeleteFund(fundId) {
  return requestData(`/funds/${fundId}`, { method: 'DELETE' });
}

export async function apiInitializeFunds() {
  return requestData('/funds/initialize', { method: 'POST' });
}

export async function apiGetFundCashHistory(fundId) {
  return requestData(`/funds/${fundId}/cash-history`);
}

export async function apiAddFundCashHistory(fundId, data) {
  return requestData(`/funds/${fundId}/cash-history`, { method: 'POST', body: data });
}

// ── External Assets API ──

export async function apiGetExternalAssets() {
  return requestData('/external-assets');
}

export async function apiAddExternalAsset(data) {
  return requestData('/external-assets', { method: 'POST', body: data });
}

export async function apiUpdateExternalAsset(assetId, data) {
  return requestData(`/external-assets/${assetId}`, { method: 'PUT', body: data });
}

export async function apiDeleteExternalAsset(assetId) {
  return requestData(`/external-assets/${assetId}`, { method: 'DELETE' });
}

// ── Liabilities API ──

export async function apiGetLiabilities() {
  return requestData('/liabilities');
}

export async function apiAddLiability(data) {
  return requestData('/liabilities', { method: 'POST', body: data });
}

export async function apiUpdateLiability(liabilityId, data) {
  return requestData(`/liabilities/${liabilityId}`, { method: 'PUT', body: data });
}

export async function apiDeleteLiability(liabilityId) {
  return requestData(`/liabilities/${liabilityId}`, { method: 'DELETE' });
}

// ── Prices API ──

export async function apiFetchPrice(symbol, source = 'VCI', targetDate = null) {
  let url = `/prices/stock?symbol=${encodeURIComponent(symbol)}&source=${source}`;
  if (targetDate) url += `&target_date=${targetDate}`;
  return requestData(url);
}

export async function apiFetchPrices(symbols, source = 'VCI', targetDate = null) {
  let url = `/prices/stocks?symbols=${symbols.join(',')}&source=${source}`;
  if (targetDate) url += `&target_date=${targetDate}`;
  return request(url); // Returns array directly, not wrapped
}

export async function apiGetMarketPrices() {
  return requestData('/prices/market');
}

export async function apiSaveMarketPrices(pricesMap) {
  return requestData('/prices/market', { method: 'POST', body: { prices: pricesMap } });
}

export async function apiGetLatestDailyPrices() {
  return requestData('/prices/daily/latest');
}

export async function apiGetFundListing(fundType = '') {
  let url = '/prices/funds/listing';
  if (fundType) url += `?fund_type=${fundType}`;
  return request(url); // Returns array directly
}

export async function apiGetBenchmarkHistory(days = 90) {
  return requestData(`/prices/benchmarks/history?days=${days}`);
}

export async function apiGetStablecoinRate(symbol = 'USDT') {
  return requestData(`/prices/stablecoin-rate?symbol=${encodeURIComponent(symbol)}`);
}

export async function apiGetGoldSjcPrice() {
  return requestData('/prices/gold-sjc');
}

export async function apiGetSystemTickers() {
  return requestData('/prices/system-tickers');
}

export async function apiAddSystemTicker(category, ticker) {
  return requestData('/prices/system-tickers', {
    method: 'POST',
    body: { category, ticker }
  });
}

export async function apiUserFetchLivePrices() {
  return requestData('/prices/fetch-live', { method: 'POST' });
}

// ── Snapshots API ──

export async function apiGetSnapshots() {
  return requestData('/snapshots');
}

export async function apiSaveSnapshot(data) {
  return requestData('/snapshots', { method: 'POST', body: data });
}

export async function apiBackfillSnapshots(startDate, endDate = null, overwrite = true) {
  return requestData('/snapshots/backfill', {
    method: 'POST',
    body: { start_date: startDate, end_date: endDate, overwrite }
  });
}

// ── Settings API ──

export async function apiGetRebalanceTargets() {
  return requestData('/settings/rebalance');
}

export async function apiSaveRebalanceTargets(targets) {
  return requestData('/settings/rebalance', {
    method: 'PUT',
    body: { targets },
  });
}

// ── Dashboard API ──

export async function apiGetDashboard() {
  return requestData('/dashboard');
}
