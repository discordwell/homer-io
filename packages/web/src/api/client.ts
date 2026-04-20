import { authResponseSchema } from '@homer-io/shared';
import { useAuthStore } from '../stores/auth.js';

export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingError';
  }
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Module-level mutex for refresh requests. Multiple concurrent 401s must
 * share a single refresh attempt rather than each firing their own. The
 * promise resolves to the fresh access token on success or `null` on
 * failure (which means the user has been logged out).
 */
let pendingRefresh: Promise<string | null> | null = null;

async function performRefresh(refreshToken: string): Promise<string | null> {
  const { setAuth, logout } = useAuthStore.getState();
  try {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshRes.ok) {
      logout();
      return null;
    }
    let body: unknown;
    try {
      body = await refreshRes.json();
    } catch {
      logout();
      return null;
    }
    const parsed = authResponseSchema.safeParse(body);
    if (!parsed.success) {
      logout();
      return null;
    }
    setAuth(parsed.data);
    return parsed.data.accessToken;
  } catch {
    logout();
    return null;
  }
}

function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!pendingRefresh) {
    pendingRefresh = performRefresh(refreshToken).finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  // Internal guard: once true, a 401 response will NOT trigger another
  // refresh attempt for this request. Prevents infinite refresh loops.
  alreadyRetried = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (alreadyRetried) {
      // Refreshed token still got 401 — do not refresh again, bail out.
      useAuthStore.getState().logout();
      throw new Error('Unauthorized');
    }
    const { refreshToken } = useAuthStore.getState();
    if (!refreshToken) {
      throw new Error('Unauthorized');
    }
    const newAccessToken = await refreshAccessToken(refreshToken);
    if (!newAccessToken) {
      // performRefresh already logged out the user
      throw new Error('Unauthorized');
    }
    // Retry the original request exactly once with the fresh token.
    return request<T>(path, options, true);
  }

  if (res.status === 402) {
    const body = await res.json().catch(() => ({}));
    window.dispatchEvent(new CustomEvent('homer:billing-blocked', { detail: body }));
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
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const { accessToken } = useAuthStore.getState();
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    // Do NOT set Content-Type — the browser will set it with the boundary for multipart
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || res.statusText);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  },
};
