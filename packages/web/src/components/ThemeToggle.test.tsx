import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders to static markup (matching FormField.test.tsx) rather than pulling
 * in @testing-library/react. That means these cover the accessible naming and
 * selected-state markup, not click behaviour — cycling itself is covered
 * directly against the store in stores/theme.test.ts.
 */

function installEnv(stored: string, osIsDark = true) {
  const map = new Map<string, string>([['homer-theme', stored]]);
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
  } as Storage;
  (globalThis as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({
    matches: q.includes('dark') ? osIsDark : !osIsDark,
    addEventListener() {},
    removeEventListener() {},
  });
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: { style: {}, setAttribute() {} },
    querySelector: () => null,
  };
}

function cleanup() {
  for (const k of ['localStorage', 'matchMedia', 'document']) {
    delete (globalThis as unknown as Record<string, unknown>)[k];
  }
}

async function load() {
  return import('./ThemeToggle.js');
}

describe('ThemeToggle (compact)', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  it('names the current mode and the one activation moves to', async () => {
    installEnv('dark');
    const { ThemeToggle } = await load();
    const html = renderToStaticMarkup(<ThemeToggle />);

    // Without both halves, a screen-reader user cannot tell what the control
    // is set to now, only that it is a button.
    expect(html).toContain('aria-label="Theme: Dark. Activate to switch to System."');
  });

  it('wraps from the last mode back to the first', async () => {
    installEnv('system');
    const { ThemeToggle } = await load();
    expect(renderToStaticMarkup(<ThemeToggle />)).toContain('switch to Light');
  });

  it('reflects the selected mode, not the resolved palette', async () => {
    // system + OS dark: resolved is dark, but the control must still read
    // "System" or the user cannot tell the two states apart.
    installEnv('system', true);
    const { ThemeToggle } = await load();
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('Theme: System.');
    expect(html).not.toContain('Theme: Dark.');
  });

  it('accepts a className so layouts can position it', async () => {
    installEnv('light');
    const { ThemeToggle } = await load();
    expect(renderToStaticMarkup(<ThemeToggle compact className="hp-nav-theme" />))
      .toContain('class="hp-nav-theme"');
  });

  it('is a type="button" so it never submits a surrounding form', async () => {
    installEnv('light');
    const { ThemeToggle } = await load();
    expect(renderToStaticMarkup(<ThemeToggle />)).toContain('type="button"');
  });
});

describe('ThemeModeSelector', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.resetModules(); cleanup(); });

  it('is a labelled radiogroup with exactly one checked option', async () => {
    installEnv('light');
    const { ThemeModeSelector } = await load();
    const html = renderToStaticMarkup(<ThemeModeSelector />);

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Color theme"');
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
  });

  it('checks the option matching the stored mode', async () => {
    installEnv('system');
    const { ThemeModeSelector } = await load();
    const html = renderToStaticMarkup(<ThemeModeSelector />);

    const checkedLabel = /aria-checked="true"[\s\S]*?<\/svg>([A-Za-z]+)</.exec(html)?.[1];
    expect(checkedLabel).toBe('System');
  });

  it('spells out what System currently resolves to', async () => {
    installEnv('system', false); // OS prefers light
    const { ThemeModeSelector } = await load();
    const html = renderToStaticMarkup(<ThemeModeSelector />);
    expect(html).toContain('currently light');
  });

  it('describes a pinned mode instead of the device setting', async () => {
    installEnv('dark');
    const { ThemeModeSelector } = await load();
    const html = renderToStaticMarkup(<ThemeModeSelector />);
    expect(html).toContain('Always use the dark palette');
    expect(html).not.toContain('Following your device setting');
  });
});
