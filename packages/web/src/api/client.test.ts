import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from './client.js';
import { useAuthStore } from '../stores/auth.js';

/**
 * Regression tests for Finding H12: the API client refresh flow must
 * 1. Not loop — a second 401 after refresh must reject, not refresh again.
 * 2. Validate the refresh response — malformed bodies must log the user out.
 * 3. Coalesce concurrent refreshes — two simultaneous 401s share one refresh.
 */

const VALID_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  name: 'Alice',
  role: 'owner' as const,
  tenantId: '00000000-0000-0000-0000-000000000002',
  createdAt: '2026-04-20T00:00:00.000Z',
};

function makeResponse(status: number, body: unknown): Response {
  const isJson = body !== undefined;
  return new Response(isJson ? JSON.stringify(body) : null, {
    status,
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
  });
}

function makeTextResponse(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

describe('api client — 401 refresh flow (Finding H12)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: VALID_USER,
      accessToken: 'stale-access',
      refreshToken: 'valid-refresh',
      isAuthenticated: true,
      pendingGoogleUser: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs out and rejects when refresh returns non-2xx', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        return makeResponse(401, { error: 'invalid refresh' });
      }
      return makeResponse(401, { error: 'unauthorized' });
    });

    await expect(api.get('/orders')).rejects.toThrow(/unauthorized/i);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('logs out when refresh returns 2xx with malformed body (missing fields)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        // Missing user + refreshToken — should NOT be accepted
        return makeResponse(200, { accessToken: 'new-token' });
      }
      return makeResponse(401, { error: 'unauthorized' });
    });

    await expect(api.get('/orders')).rejects.toThrow(/unauthorized/i);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('logs out when refresh returns 2xx with invalid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        return makeTextResponse(200, 'not json at all');
      }
      return makeResponse(401, { error: 'unauthorized' });
    });

    await expect(api.get('/orders')).rejects.toThrow(/unauthorized/i);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('does NOT refresh twice — if retried request still 401s, reject', async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return makeResponse(200, {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
          user: VALID_USER,
        });
      }
      protectedCalls += 1;
      // Always 401 — even after refresh
      return makeResponse(401, { error: 'unauthorized' });
    });

    await expect(api.get('/orders')).rejects.toThrow(/unauthorized/i);
    expect(refreshCalls).toBe(1);
    // Protected request fired once before refresh and once after retry
    expect(protectedCalls).toBe(2);
    // After the second 401, client should log the user out
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('succeeds when refresh is valid and retried request returns 200', async () => {
    const orderPayload = { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
    let protectedCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        return makeResponse(200, {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
          user: VALID_USER,
        });
      }
      protectedCalls += 1;
      if (protectedCalls === 1) return makeResponse(401, { error: 'expired' });
      return makeResponse(200, orderPayload);
    });

    const result = await api.get('/orders');
    expect(result).toEqual(orderPayload);
    expect(useAuthStore.getState().accessToken).toBe('fresh-access');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('coalesces concurrent 401s into a single refresh call', async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    const orderPayload = { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        // Add a microtask tick to simulate network latency — this widens the
        // window during which both callers can observe pendingRefresh.
        await new Promise((r) => setTimeout(r, 10));
        return makeResponse(200, {
          accessToken: 'fresh-access',
          refreshToken: 'fresh-refresh',
          user: VALID_USER,
        });
      }
      protectedCalls += 1;
      // First call from each of the 2 concurrent requests is 401; the
      // retries after refresh succeed.
      if (protectedCalls <= 2) return makeResponse(401, { error: 'expired' });
      return makeResponse(200, orderPayload);
    });

    const [a, b] = await Promise.all([api.get('/orders'), api.get('/routes')]);
    expect(a).toEqual(orderPayload);
    expect(b).toEqual(orderPayload);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(4); // 2 original 401s + 2 retried 200s
  });

  it('does not attempt refresh if no refreshToken is stored', async () => {
    useAuthStore.setState({ refreshToken: null });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return makeResponse(401, { error: 'unauthorized' });
    });

    await expect(api.get('/orders')).rejects.toThrow(/unauthorized/i);
    // Only the initial request should have fired; no refresh attempt
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
