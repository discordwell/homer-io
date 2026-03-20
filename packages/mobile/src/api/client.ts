import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '@/constants';

const TOKEN_KEY = 'homer_access_token';
const REFRESH_KEY = 'homer_refresh_token';

export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingError';
  }
}

/** Read tokens from secure storage */
export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

/** Persist tokens to secure storage */
export async function setTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ]);
}

/** Clear tokens from secure storage */
export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

/** Event listeners for auth events */
type AuthEventListener = () => void;
const logoutListeners: AuthEventListener[] = [];
export function onLogout(listener: AuthEventListener) {
  logoutListeners.push(listener);
  return () => {
    const idx = logoutListeners.indexOf(listener);
    if (idx >= 0) logoutListeners.splice(idx, 1);
  };
}
function emitLogout() {
  logoutListeners.forEach((l) => l());
}

const billingListeners: Array<(detail: unknown) => void> = [];
export function onBillingBlocked(listener: (detail: unknown) => void) {
  billingListeners.push(listener);
  return () => {
    const idx = billingListeners.indexOf(listener);
    if (idx >= 0) billingListeners.splice(idx, 1);
  };
}

// Mutex for token refresh — prevents concurrent 401s from racing
let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) return false;

  const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (refreshRes.ok) {
    const data = await refreshRes.json();
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  }
  await clearTokens();
  emitLogout();
  return false;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = await getTokens();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Use mutex so concurrent 401s share a single refresh attempt
    if (!refreshPromise) {
      refreshPromise = attemptTokenRefresh().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      const { accessToken: newToken } = await getTokens();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, { ...options, headers });
      if (!retryRes.ok) throw new Error(await retryRes.text());
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    }
    throw new Error('Unauthorized');
  }

  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    billingListeners.forEach((l) => l(body));
    throw new BillingError(body.message || 'Subscription required');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
