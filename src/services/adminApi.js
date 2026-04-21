/**
 * Admin API Client — Separate from the user API client.
 * Uses adminToken stored in sessionStorage (clears on tab close).
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let _adminToken = null;

export function setAdminToken(token) {
  _adminToken = token;
  if (token) sessionStorage.setItem('adminToken', token);
  else sessionStorage.removeItem('adminToken');
}

export function getAdminToken() {
  if (!_adminToken) {
    _adminToken = sessionStorage.getItem('adminToken');
  }
  return _adminToken;
}

export function clearAdminToken() {
  _adminToken = null;
  sessionStorage.removeItem('adminToken');
}

// ── Core Request ──

async function adminRequest(endpoint, options = {}) {
  const { method = 'GET', body } = options;
  const token = getAdminToken();

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function adminRequestData(endpoint, options = {}) {
  const res = await adminRequest(endpoint, options);
  if (res.success === false) throw new Error(res.error || 'API error');
  return res.data !== undefined ? res.data : res;
}

// ── Admin Auth ──

export async function apiAdminLogin(username, password) {
  return adminRequestData('/admin/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function apiAdminMe() {
  return adminRequestData('/admin/me');
}

// ── System Prices ──

export async function apiGetSystemPrices(date = null) {
  const url = date ? `/admin/system-prices?date=${date}` : '/admin/system-prices';
  return adminRequestData(url);
}

export async function apiGetSystemPricesHistory() {
  return adminRequestData('/admin/system-prices/history');
}

export async function apiSaveSystemPrices(prices, date = null) {
  return adminRequestData('/admin/system-prices', {
    method: 'POST',
    body: { prices, date },
  });
}

export async function apiFetchSystemPricesFromAPI(date = null) {
  const url = date
    ? `/admin/system-prices/fetch-api?date=${date}`
    : '/admin/system-prices/fetch-api';
  return adminRequestData(url, { method: 'POST' });
}

// ── Ticker Config ──

export async function apiGetAdminTickers() {
  return adminRequestData('/admin/tickers');
}

export async function apiSaveAdminTickers(data) {
  return adminRequestData('/admin/tickers', { method: 'PUT', body: data });
}

export async function apiGetAdminTickerStats() {
  return adminRequestData('/admin/tickers/stats');
}

// ── Users ──

export async function apiGetAdminUsers() {
  return adminRequestData('/admin/users');
}

export async function apiGetAdminUserDetail(userId) {
  return adminRequestData(`/admin/users/${userId}`);
}

export async function apiSetUserActive(userId, isActive) {
  return adminRequestData(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
}

// ── Global Settings ──

export async function apiGetAdminSettings() {
  return adminRequestData('/admin/settings');
}

export async function apiSaveAdminSettings(data) {
  return adminRequestData('/admin/settings', { method: 'PUT', body: data });
}

// ── Migration ──

export async function apiMigrateDailyPrices() {
  return adminRequestData('/admin/migrate/daily-prices', { method: 'POST' });
}
