import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Pins M5 behavior: on rehydrate, `pendingGoogleUser` is always cleared.
 *
 * The Google OAuth `credential` is a short-lived JWT. If a user navigates
 * away from /org-choice mid-flow and returns later (reload), the credential
 * would be stale. `onRehydrateStorage` must wipe it.
 *
 * We simulate rehydration by seeding localStorage under the persist key,
 * then re-importing the module to trigger Zustand's hydration step.
 */

const PERSIST_KEY = 'homer-auth';

// Minimal localStorage shim (vitest default env is node).
// Zustand persist default storage uses `window.localStorage`, so we need to
// install both globalThis.window and localStorage before importing the store.
function installLocalStorage() {
  const store = new Map<string, string>();
  const ls: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as unknown as { window: { localStorage: Storage } }).window = { localStorage: ls };
  (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
  return ls;
}

describe('useAuthStore rehydrate — M5', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it('clears pendingGoogleUser on rehydrate even if a prior in-memory copy existed', async () => {
    // Pre-seed persisted state with a real (non-demo) session. pendingGoogleUser
    // is NOT persisted via partialize, but we also seed it here to prove the
    // guard: even if some future persist change leaked it in, rehydrate wipes.
    const persisted = {
      state: {
        user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'owner', tenantId: 't', createdAt: '' },
        accessToken: 'real-token',
        refreshToken: 'rt',
        isAuthenticated: true,
        // Deliberately include to prove the guard.
        pendingGoogleUser: {
          credential: 'stale-jwt',
          email: 'a@b.c',
          name: 'A',
          orgOptions: [],
        },
      },
      version: 0,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(persisted));

    const { useAuthStore } = await import('./auth.js');

    // Zustand persist hydration is synchronous for sync storage; wait a tick
    // to flush any onRehydrateStorage callback.
    await Promise.resolve();
    await Promise.resolve();

    const s = useAuthStore.getState();
    expect(s.pendingGoogleUser).toBeNull();
    // Sanity: normal fields survived.
    expect(s.accessToken).toBe('real-token');
    expect(s.isAuthenticated).toBe(true);
  });

  it('still clears demo-token on rehydrate (existing behavior untouched)', async () => {
    const persisted = {
      state: {
        user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'owner', tenantId: 't', createdAt: '' },
        accessToken: 'demo-token',
        refreshToken: 'rt',
        isAuthenticated: true,
      },
      version: 0,
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(persisted));

    const { useAuthStore } = await import('./auth.js');
    await Promise.resolve();
    await Promise.resolve();

    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
    expect(s.pendingGoogleUser).toBeNull();
  });

  it('does not persist pendingGoogleUser via partialize (defense in depth)', async () => {
    const { useAuthStore } = await import('./auth.js');
    await Promise.resolve();

    useAuthStore.setState({
      pendingGoogleUser: {
        credential: 'fresh-jwt',
        email: 'a@b.c',
        name: 'A',
        orgOptions: [],
      },
    });

    // Force persist to flush
    await useAuthStore.persist?.rehydrate?.();

    const raw = localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      expect(parsed.state?.pendingGoogleUser).toBeUndefined();
    }
  });
});
