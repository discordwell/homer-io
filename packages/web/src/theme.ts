import type React from 'react';

// Design tokens — CSS variable references
// Actual values defined in app.css (dark on :root, light on html[data-theme='light'])
// These let existing inline-style components pick up the active theme automatically.

export const C = {
  bg: 'var(--bg)',
  bg2: 'var(--bg2)',
  bg3: 'var(--bg-card)',
  surface: 'var(--bg2)',
  card: 'var(--bg-card)',
  cardHover: 'var(--bg-card-h)',

  /** Brand amber as a FILL — button/bar/dot backgrounds. Pair with `onAccent`. */
  accent: 'var(--accent)',
  accentHover: 'var(--accent-h)',
  /** Brand amber as FOREGROUND — links, labels, icons on a page background.
   *  Darkened in light mode so it clears AA on white; `accent` cannot. */
  accentText: 'var(--accent-text)',
  /** Text/icon color that sits on top of an `accent` fill. */
  onAccent: 'var(--on-accent)',
  accentGlow: 'var(--accent-glow)',

  green: 'var(--green)',
  yellow: 'var(--yellow)',
  red: 'var(--red)',
  orange: 'var(--orange)',
  purple: 'var(--purple)',

  text: 'var(--t1)',
  dim: 'var(--t2)',
  muted: 'var(--t3)',
  border: 'var(--border)',
  border2: 'var(--border2)',
  /** Heavier card/input border. Equals `muted` in dark (unchanged look),
   *  softens to slate-300 in light where `muted` would read as a hard rule. */
  borderStrong: 'var(--border-strong)',

  /** Scrim behind modals and the mobile sidebar. */
  overlay: 'var(--overlay)',
  /** Translucent backdrop-filtered nav chrome. */
  chrome: 'var(--chrome-bg)',
} as const;

export const S = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const;

export const F = {
  display: "var(--fd)",
  body: "var(--fb)",
  mono: "var(--fm)",
} as const;

// Map from C keys to their CSS RGB variable names
const rgbMap: Record<string, string> = {
  'var(--accent)': 'var(--accent-rgb)',
  'var(--accent-text)': 'var(--accent-text-rgb)',
  'var(--green)': 'var(--green-rgb)',
  'var(--red)': 'var(--red-rgb)',
  'var(--yellow)': 'var(--yellow-rgb)',
  'var(--orange)': 'var(--orange-rgb)',
  'var(--purple)': 'var(--purple-rgb)',
  'var(--t1)': 'var(--t1-rgb)',
  'var(--t2)': 'var(--t2-rgb)',
  'var(--t3)': 'var(--t3-rgb)',
  'var(--border)': 'var(--border-rgb)',
  'var(--border-strong)': 'var(--border-strong-rgb)',
  'var(--on-accent)': 'var(--on-accent-rgb)',
  'var(--bg)': 'var(--bg-rgb)',
  'var(--bg2)': 'var(--bg2-rgb)',
  'var(--bg-card)': 'var(--bg-card-rgb)',
};

/** Create a semi-transparent version of a theme color.
 *  Usage: alpha(C.accent, 0.1) → "rgba(var(--accent-rgb), 0.1)"
 *
 *  Always use this instead of string-concatenating a hex alpha suffix:
 *  `${C.green}18` produces the literal "var(--green)18", which is invalid
 *  CSS and gets dropped silently. */
export function alpha(color: string, opacity: number): string {
  const rgb = rgbMap[color];
  if (rgb) return `rgba(${rgb}, ${opacity})`;
  // Falling through returns the color at full opacity, which looks like a
  // working style and silently loses the transparency — a spinner track ends
  // up the same color as its head, a de-emphasized label stops being
  // de-emphasized. Fail loudly outside production so it is caught at the call
  // site; `theme.test.ts` pins every mapped token.
  if (import.meta.env.DEV) {
    throw new Error(`alpha(): no RGB mapping for "${color}" — add it to rgbMap and define its --*-rgb token in app.css`);
  }
  return color;
}

// Shared button styles — use these instead of duplicating per-component
export const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: C.onAccent, cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

export const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.borderStrong}`, color: C.dim, cursor: 'pointer', fontFamily: F.body, fontSize: 14,
};
