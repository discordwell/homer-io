import { create } from 'zustand';

/**
 * Theme mode store.
 *
 * `mode` is what the user picked; `resolved` is what actually renders.
 * They differ only when mode === 'system', where resolved tracks the OS
 * preference live.
 *
 * Persistence deliberately does NOT use zustand's `persist` middleware: the
 * pre-paint script (public/theme-init.js) has to read the same value with no
 * dependencies, so the stored format is a bare string rather than zustand's
 * `{state,version}` envelope. Keep the two resolution paths in sync —
 * theme.test.ts asserts they agree.
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'homer-theme';

/** Product default. Dark is HOMER's designed-for look; light is opt-in. */
export const DEFAULT_MODE: ThemeMode = 'dark';

/** Cycle order for the compact topnav toggle. */
export const THEME_CYCLE: readonly ThemeMode[] = ['light', 'dark', 'system'] as const;

const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#06090F',
  light: '#FFFFFF',
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

/** Read the persisted mode. Storage can throw (Safari private mode). */
export function readStoredMode(): ThemeMode {
  try {
    const raw = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return isThemeMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function writeStoredMode(mode: ThemeMode): void {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Non-fatal: the theme still applies for this session, it just won't persist.
  }
}

/** True when the OS is asking for a dark UI. */
export function prefersDark(): boolean {
  return typeof globalThis.matchMedia === 'function'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
}

/** Collapse a mode into the palette that should actually render. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') return prefersDark() ? 'dark' : 'light';
  return mode;
}

/**
 * Stamp the resolved theme onto the document.
 *
 * `data-theme` drives the token overrides in app.css; `color-scheme` makes the
 * browser render native widgets (scrollbars, form controls, autofill) to match;
 * `<meta name="theme-color">` colors mobile browser chrome and the PWA shell.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  /** Set an explicit mode; persists and repaints immediately. */
  setMode: (mode: ThemeMode) => void;
  /** Advance through THEME_CYCLE — used by the compact topnav toggle. */
  cycleMode: () => void;
  /** Re-resolve against the current OS preference (system mode only). */
  syncSystem: () => void;
}

const initialMode = readStoredMode();

export const useThemeStore = create<ThemeState>()((set, get) => ({
  mode: initialMode,
  resolved: resolveTheme(initialMode),

  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    writeStoredMode(mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },

  cycleMode: () => {
    const index = THEME_CYCLE.indexOf(get().mode);
    // indexOf returns -1 for an unknown mode, so this lands on THEME_CYCLE[0].
    get().setMode(THEME_CYCLE[(index + 1) % THEME_CYCLE.length]);
  },

  syncSystem: () => {
    if (get().mode !== 'system') return;
    const resolved = resolveTheme('system');
    if (resolved === get().resolved) return;
    applyTheme(resolved);
    set({ resolved });
  },
}));

/**
 * Start tracking OS theme changes. Called once from main.tsx.
 * Returns a teardown so tests can unsubscribe.
 */
export function initTheme(): () => void {
  // theme-init.js already stamped data-theme pre-paint; re-apply so the
  // <meta theme-color> and color-scheme stay correct even if it was skipped
  // (e.g. a consumer embedding the bundle without the public/ assets).
  applyTheme(useThemeStore.getState().resolved);

  if (typeof globalThis.matchMedia !== 'function') return () => {};

  const mql = globalThis.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => useThemeStore.getState().syncSystem();
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
