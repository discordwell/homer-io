import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Theme mode store.
 *
 * The load-bearing test here is `theme-init.js parity` at the bottom: the
 * pre-paint script duplicates the store's resolution logic on purpose (it has
 * to run before any bundle loads, with zero imports). These tests pin the two
 * copies to the same answers so an edit to one can't silently drift.
 *
 * Vitest's default env is node, so window/document/localStorage are shimmed
 * per-test rather than provided by jsdom.
 */

const STORAGE_KEY = 'homer-theme';

function installLocalStorage(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  const ls: Storage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage = ls;
  return ls;
}

/** Minimal <html> + <meta name="theme-color"> stand-in. */
function installDocument() {
  const attrs = new Map<string, string>();
  const meta = {
    content: '',
    setAttribute(_n: string, v: string) { this.content = v; },
  };
  const doc = {
    documentElement: {
      style: { colorScheme: '' },
      setAttribute: (n: string, v: string) => { attrs.set(n, v); },
      getAttribute: (n: string) => attrs.get(n) ?? null,
    },
    querySelector: (sel: string) => (sel.includes('theme-color') ? meta : null),
  };
  (globalThis as unknown as { document: unknown }).document = doc;
  return { doc, meta, attrs };
}

/** matchMedia stub driven by a single "OS is dark" boolean. */
function installMatchMedia(osIsDark: boolean) {
  const listeners = new Set<() => void>();
  const mm = (query: string) => ({
    matches: query.includes('dark') ? osIsDark : !osIsDark,
    media: query,
    addEventListener: (_e: string, cb: () => void) => { listeners.add(cb); },
    removeEventListener: (_e: string, cb: () => void) => { listeners.delete(cb); },
  });
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = mm;
  return { fire: () => listeners.forEach((cb) => cb()), listenerCount: () => listeners.size };
}

function cleanup() {
  for (const k of ['localStorage', 'document', 'matchMedia', 'window']) {
    delete (globalThis as unknown as Record<string, unknown>)[k];
  }
}

async function loadStore() {
  return import('./theme.js');
}

describe('theme store — resolution', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  it('defaults to dark when nothing is stored', async () => {
    installLocalStorage();
    installDocument();
    installMatchMedia(false); // OS prefers light
    const { readStoredMode, useThemeStore, DEFAULT_MODE } = await loadStore();

    expect(DEFAULT_MODE).toBe('dark');
    expect(readStoredMode()).toBe('dark');
    // An OS light preference must NOT override the product default.
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('rejects a garbage stored value instead of applying it', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'chartreuse' });
    installDocument();
    installMatchMedia(true);
    const { readStoredMode } = await loadStore();
    expect(readStoredMode()).toBe('dark');
  });

  it('falls back to the default when storage throws', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem() { throw new Error('SecurityError: storage disabled'); },
      setItem() { throw new Error('SecurityError: storage disabled'); },
    } as unknown as Storage;
    installDocument();
    installMatchMedia(true);
    const { readStoredMode } = await loadStore();
    expect(readStoredMode()).toBe('dark');
  });

  it('system mode follows the OS preference in both directions', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'system' });
    installDocument();
    installMatchMedia(true);
    const { resolveTheme } = await loadStore();
    expect(resolveTheme('system')).toBe('dark');

    installMatchMedia(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('explicit modes ignore the OS preference', async () => {
    installLocalStorage();
    installDocument();
    installMatchMedia(true); // OS dark
    const { resolveTheme } = await loadStore();
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});

describe('theme store — applying and persisting', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  it('setMode stamps the document, storage, and meta theme-color', async () => {
    const ls = installLocalStorage();
    const { attrs, doc, meta } = installDocument();
    installMatchMedia(true);
    const { useThemeStore } = await loadStore();

    useThemeStore.getState().setMode('light');

    expect(ls.getItem(STORAGE_KEY)).toBe('light');
    expect(attrs.get('data-theme')).toBe('light');
    expect(doc.documentElement.style.colorScheme).toBe('light');
    expect(meta.content).toBe('#FFFFFF');
    expect(useThemeStore.getState().resolved).toBe('light');

    useThemeStore.getState().setMode('dark');
    expect(attrs.get('data-theme')).toBe('dark');
    expect(meta.content).toBe('#06090F');
  });

  it('stores the mode, not the resolved palette', async () => {
    const ls = installLocalStorage();
    const { attrs } = installDocument();
    installMatchMedia(false); // OS light
    const { useThemeStore } = await loadStore();

    useThemeStore.getState().setMode('system');

    // Persisting 'light' here would freeze the choice and stop it tracking the OS.
    expect(ls.getItem(STORAGE_KEY)).toBe('system');
    expect(attrs.get('data-theme')).toBe('light');
  });

  it('cycleMode goes light -> dark -> system -> light', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'light' });
    installDocument();
    installMatchMedia(true);
    const { useThemeStore, THEME_CYCLE } = await loadStore();

    expect([...THEME_CYCLE]).toEqual(['light', 'dark', 'system']);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      useThemeStore.getState().cycleMode();
      seen.push(useThemeStore.getState().mode);
    }
    expect(seen).toEqual(['dark', 'system', 'light', 'dark']);
  });
});

describe('theme store — OS preference changes', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  it('repaints on an OS change while in system mode', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'system' });
    const { attrs } = installDocument();
    let mm = installMatchMedia(true);
    const { useThemeStore, initTheme } = await loadStore();

    const teardown = initTheme();
    expect(attrs.get('data-theme')).toBe('dark');

    // OS flips to light; the media listener fires.
    mm = installMatchMedia(false);
    useThemeStore.getState().syncSystem();
    expect(useThemeStore.getState().resolved).toBe('light');
    expect(attrs.get('data-theme')).toBe('light');

    teardown();
    void mm;
  });

  it('ignores OS changes when a mode was chosen explicitly', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'dark' });
    const { attrs } = installDocument();
    installMatchMedia(true);
    const { useThemeStore, initTheme } = await loadStore();
    initTheme();

    installMatchMedia(false); // OS goes light
    useThemeStore.getState().syncSystem();

    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(attrs.get('data-theme')).toBe('dark');
  });

  it('initTheme unsubscribes on teardown', async () => {
    installLocalStorage();
    installDocument();
    const mm = installMatchMedia(true);
    const { initTheme } = await loadStore();

    const teardown = initTheme();
    expect(mm.listenerCount()).toBe(1);
    teardown();
    expect(mm.listenerCount()).toBe(0);
  });
});

describe('theme-init.js parity', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const initSrc = readFileSync(resolve(here, '../../public/theme-init.js'), 'utf8');

  /** Run the pre-paint IIFE against a fake window/document, return data-theme. */
  function runInitScript(stored: string | null, osIsDark: boolean, withMatchMedia = true) {
    const attrs = new Map<string, string>();
    const meta = { content: '', setAttribute(_n: string, v: string) { this.content = v; } };
    const doc = {
      documentElement: {
        style: { colorScheme: '' },
        setAttribute: (n: string, v: string) => { attrs.set(n, v); },
      },
      querySelector: (sel: string) => (sel.includes('theme-color') ? meta : null),
    };
    const win: Record<string, unknown> = {
      localStorage: { getItem: (_k: string) => stored },
      document: doc,
    };
    if (withMatchMedia) {
      win.matchMedia = (q: string) => ({ matches: q.includes('dark') ? osIsDark : !osIsDark });
    }
    new Function('window', 'document', initSrc)(win, doc);
    return { theme: attrs.get('data-theme'), colorScheme: doc.documentElement.style.colorScheme, meta: meta.content };
  }

  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  const cases: Array<[string | null, boolean]> = [
    ['light', true], ['light', false],
    ['dark', true], ['dark', false],
    ['system', true], ['system', false],
    [null, true], [null, false],
    ['bogus', true], ['bogus', false],
  ];

  it.each(cases)('stored=%s osDark=%s resolves identically in both copies', async (stored, osIsDark) => {
    installLocalStorage(stored === null ? {} : { [STORAGE_KEY]: stored });
    installDocument();
    installMatchMedia(osIsDark);
    const { readStoredMode, resolveTheme } = await loadStore();

    const fromStore = resolveTheme(readStoredMode());
    const fromScript = runInitScript(stored, osIsDark);

    expect(fromScript.theme).toBe(fromStore);
    expect(fromScript.colorScheme).toBe(fromStore);
  });

  it('agrees with the store when matchMedia is unavailable', async () => {
    // The one case the matrix above cannot reach: both copies must fall back
    // to the product default rather than one guessing light.
    installLocalStorage({ [STORAGE_KEY]: 'system' });
    installDocument();
    delete (globalThis as unknown as Record<string, unknown>).matchMedia;
    const { readStoredMode, resolveTheme } = await loadStore();

    expect(resolveTheme(readStoredMode())).toBe('dark');
    expect(runInitScript('system', false, false).theme).toBe('dark');
  });

  it('sets the same meta theme-color as the store', async () => {
    installLocalStorage({ [STORAGE_KEY]: 'light' });
    const { meta } = installDocument();
    installMatchMedia(true);
    const { useThemeStore } = await loadStore();
    useThemeStore.getState().setMode('light');

    expect(runInitScript('light', true).meta).toBe(meta.content);
  });

  it('is loaded as an external script, because the CSP forbids inline ones', () => {
    // If script-src ever gained 'unsafe-inline' this test would relax on its
    // own; what it really guards is the reverse — that the FOUC script stays
    // external and keeps running under the current policy.
    const html = readFileSync(resolve(here, '../../index.html'), 'utf8');
    expect(html).toContain('<script src="/theme-init.js"></script>');

    // Read the policy itself; the file also *discusses* CSP in comments.
    const csp = /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/.exec(html)?.[1];
    expect(csp, 'CSP meta tag not found in index.html').toBeTruthy();
    const scriptSrc = /script-src([^;]*)/.exec(csp!)?.[1] ?? '';
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
