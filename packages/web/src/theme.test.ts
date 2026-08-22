import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { C, S, alpha } from './theme.js';

/**
 * `alpha()` is the only way to build a translucent theme color, and its old
 * failure mode was silent: an unmapped token fell through and returned the
 * color at FULL opacity. That looks like a working style — a spinner track the
 * same color as its head, a "de-emphasized" label that isn't — so nothing
 * catches it in review. It now throws outside production; these tests pin the
 * mapping so the throw never reaches a user.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'app.css'), 'utf8');

/** Declaration body of a top-level rule. Anchored on the opening brace — the
 *  header comment mentions the light selector, so a bare indexOf matches
 *  prose and silently yields an empty block. */
function block(selector: string): string {
  const start = css.indexOf(selector + ' {');
  expect(start, `selector "${selector}" not found in app.css`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
}

const darkBlock = block(':root');
const lightBlock = block("html[data-theme='light']");

describe('alpha()', () => {
  it('resolves to an rgba() referencing the paired --*-rgb token', () => {
    expect(alpha(C.accent, 0.1)).toBe('rgba(var(--accent-rgb), 0.1)');
    expect(alpha(C.green, 0.25)).toBe('rgba(var(--green-rgb), 0.25)');
  });

  it('throws on an unmapped color rather than silently returning it opaque', () => {
    expect(() => alpha('var(--not-a-token)', 0.5)).toThrow(/no RGB mapping/);
    // The old behavior — returning the input — is what made this class of bug
    // invisible. Guard against a well-meaning revert.
    expect(() => alpha('#F59E0B', 0.5)).toThrow();
  });

  it('supports every C.* token that call sites actually pass to it', () => {
    // Anything reachable as a translucent surface, wash, or de-emphasized
    // foreground. Adding a token to C without its --*-rgb pair fails here
    // rather than at runtime in one unlucky component.
    const mustSupport = [
      C.accent, C.accentText, C.onAccent,
      C.green, C.red, C.yellow, C.orange, C.purple,
      C.text, C.dim, C.muted,
      C.border, C.borderStrong,
      C.bg, C.bg2, C.card,
    ];
    for (const token of mustSupport) {
      expect(() => alpha(token, 0.5), `alpha() rejects ${token}`).not.toThrow();
    }
  });

  it('every --*-rgb token it references is defined in both palettes', () => {
    const referenced = new Set<string>();
    for (const token of Object.values(C)) {
      let out: string;
      try { out = alpha(token, 0.5); } catch { continue; }
      const m = /var\((--[a-z0-9-]+)\)/.exec(out);
      if (m) referenced.add(m[1]);
    }
    expect(referenced.size).toBeGreaterThan(8);

    for (const name of referenced) {
      expect(darkBlock, `${name} missing from the dark palette`).toContain(`${name}:`);
      expect(lightBlock, `${name} missing from the light palette`).toContain(`${name}:`);
    }
  });
});

describe('shadow tokens', () => {
  it('S maps to shadow variables defined in both palettes', () => {
    for (const value of Object.values(S)) {
      const name = /var\((--[a-z0-9-]+)\)/.exec(value)![1];
      expect(darkBlock).toContain(`${name}:`);
      expect(lightBlock).toContain(`${name}:`);
    }
  });
});
