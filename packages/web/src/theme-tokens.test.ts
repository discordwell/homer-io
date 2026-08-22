import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Guards the two palettes in app.css against drift.
 *
 * The failure this prevents: someone adds a color token to the dark `:root`
 * block, uses it in a component, and never gives it a light value. Nothing
 * errors — the token just inherits its dark value into light mode, and a
 * near-black panel appears on a white page. Only a human looking at the right
 * screen would catch it, so the check lives here instead.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'app.css'), 'utf8');

/** Pull the declaration body of a top-level rule by its selector. */
function block(selector: string): string {
  const start = css.indexOf(selector + ' {');
  expect(start, `selector "${selector}" not found in app.css`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const end = css.indexOf('\n}', open);
  return css.slice(open + 1, end);
}

function tokens(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of body.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gim)) {
    found.set(m[1], m[2].trim());
  }
  return found;
}

/**
 * Theme-variant = the value carries a literal color, or it is an `-rgb`
 * triple. Layout/typography tokens (clamp(), px, font stacks) are the same in
 * both themes by design and are excluded.
 */
function isThemeVariant(name: string, value: string): boolean {
  if (name.endsWith('-rgb')) return true;
  return /#[0-9a-f]{3,8}\b|rgba?\(/i.test(value);
}

const darkTokens = tokens(block(':root'));
const lightTokens = tokens(block("html[data-theme='light']"));

describe('app.css palette parity', () => {
  it('both palettes are non-trivially populated', () => {
    expect(darkTokens.size).toBeGreaterThan(20);
    expect(lightTokens.size).toBeGreaterThan(20);
  });

  it('every color token defined in dark also has a light value', () => {
    const missing = [...darkTokens]
      .filter(([name, value]) => isThemeVariant(name, value) && !lightTokens.has(name))
      .map(([name]) => name);

    expect(missing, `light palette is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('light defines no token that dark does not', () => {
    const orphans = [...lightTokens.keys()].filter((name) => !darkTokens.has(name));
    expect(orphans, `light-only tokens: ${orphans.join(', ')}`).toEqual([]);
  });

  it('light actually differs from dark for every color token it defines', () => {
    // Tokens that are the same in both themes on purpose. Anything else
    // matching dark verbatim is a copy-paste that never got its light value.
    const DELIBERATELY_SHARED = new Set([
      // Slate-500 sits near the middle of the range, so it stays legible
      // against both a near-black card and a white one without moving. See
      // the muted-text contrast test below for the measured ratios — light
      // clears AA, dark is a documented pre-existing shortfall.
      '--t3',
      '--t3-rgb',
    ]);

    const identical = [...lightTokens]
      .filter(([name, value]) => isThemeVariant(name, value)
        && darkTokens.get(name) === value
        && !DELIBERATELY_SHARED.has(name))
      .map(([name]) => name);

    expect(identical, `light re-declares dark's value verbatim: ${identical.join(', ')}`).toEqual([]);
  });

  it('every --x-rgb triple matches the hex of its --x token', () => {
    // These are consumed by alpha() to build rgba() washes. A drifted triple
    // tints a surface a slightly different color than the solid token it is
    // named after, which is invisible in review and maddening on screen.
    for (const [palette, set] of [['dark', darkTokens], ['light', lightTokens]] as const) {
      for (const [name, value] of set) {
        if (!name.endsWith('-rgb')) continue;
        const base = set.get(name.replace(/-rgb$/, ''));
        if (!base || !base.startsWith('#')) continue;
        const h = base.slice(1);
        const expected = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
        expect(value, `${palette} ${name} vs ${base}`).toBe(expected);
      }
    }
  });

  it('the light palette is opted into by attribute, never by media query alone', () => {
    // A bare prefers-color-scheme rule would flash light at dark-mode users on
    // any path where theme-init.js has not run yet.
    const mediaBlocks = css.match(/@media\s*\(prefers-color-scheme[^)]*\)/g) ?? [];
    expect(mediaBlocks).toEqual([]);
  });

  it('dark remains the default for an unstamped document', () => {
    // :root carries the dark values, so no data-theme attribute == dark.
    expect(darkTokens.get('--bg')).toBe('#06090F');
    expect(darkTokens.get('color-scheme' as never)).toBeUndefined();
    expect(block(':root')).toMatch(/color-scheme:\s*dark/);
    expect(block("html[data-theme='light']")).toMatch(/color-scheme:\s*light/);
  });
});

describe('app.css contrast-critical roles', () => {
  /** WCAG relative luminance. */
  function luminance(hex: string): number {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  const AA = 4.5;

  it('light: body and secondary text clear AA on the card surface', () => {
    const card = lightTokens.get('--bg-card')!;
    expect(ratio(lightTokens.get('--t1')!, card)).toBeGreaterThanOrEqual(AA);
    expect(ratio(lightTokens.get('--t2')!, card)).toBeGreaterThanOrEqual(AA);
    expect(ratio(lightTokens.get('--t3')!, card)).toBeGreaterThanOrEqual(AA);
  });

  it('muted text: light clears AA, dark is a pinned pre-existing shortfall', () => {
    // --t3 is shared between the palettes (see DELIBERATELY_SHARED). On white
    // it measures 4.76:1 and clears AA. On the dark card it is 3.73:1, which
    // clears AA-large and the 3:1 non-text threshold but NOT AA for the small
    // labels it is used on.
    //
    // That shortfall predates light mode — dark's --t3 is unchanged — so it is
    // pinned rather than silently omitted: fixing it means darkening every
    // muted label in the dark theme, which is a deliberate visual change and
    // not part of adding light mode.
    expect(ratio(lightTokens.get('--t3')!, lightTokens.get('--bg-card')!)).toBeGreaterThanOrEqual(AA);

    const darkMuted = ratio(darkTokens.get('--t3')!, darkTokens.get('--bg-card')!);
    expect(darkMuted).toBeGreaterThanOrEqual(3); // must not get worse
    expect(darkMuted).toBeLessThan(AA);          // delete this line when it is fixed
  });

  it('light: --accent-text clears AA where raw --accent would not', () => {
    const card = lightTokens.get('--bg-card')!;
    expect(ratio(lightTokens.get('--accent-text')!, card)).toBeGreaterThanOrEqual(AA);
    // The reason the separate token exists — pin it so nobody "simplifies"
    // --accent-text away back into --accent.
    expect(ratio(lightTokens.get('--accent')!, card)).toBeLessThan(AA);
  });

  it('light: status colors clear AA as text on cards', () => {
    const card = lightTokens.get('--bg-card')!;
    for (const token of ['--green', '--red', '--yellow', '--orange', '--purple']) {
      expect(ratio(lightTokens.get(token)!, card), `${token} on --bg-card`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('both: --on-accent is readable on the --accent fill it sits on', () => {
    expect(ratio(darkTokens.get('--on-accent')!, darkTokens.get('--accent')!)).toBeGreaterThanOrEqual(AA);
    expect(ratio(lightTokens.get('--on-accent')!, lightTokens.get('--accent')!)).toBeGreaterThanOrEqual(AA);
  });

  it('dark: text roles still clear AA (no regression from the refactor)', () => {
    const card = darkTokens.get('--bg-card')!;
    expect(ratio(darkTokens.get('--t1')!, card)).toBeGreaterThanOrEqual(AA);
    expect(ratio(darkTokens.get('--t2')!, card)).toBeGreaterThanOrEqual(AA);
    expect(ratio(darkTokens.get('--accent-text')!, card)).toBeGreaterThanOrEqual(AA);
  });
});
