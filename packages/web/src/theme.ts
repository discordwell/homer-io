import type React from 'react';

// Design tokens — CSS variable references
// Actual values defined in app.css :root
// These let existing inline-style components pick up the new theme automatically.

export const C = {
  bg: 'var(--bg)',
  bg2: 'var(--bg2)',
  bg3: 'var(--bg-card)',
  surface: 'var(--bg2)',
  card: 'var(--bg-card)',
  accent: 'var(--accent)',
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
} as const;

export const F = {
  display: "var(--fd)",
  body: "var(--fb)",
  mono: "var(--fm)",
} as const;

// Map from C keys to their CSS RGB variable names
const rgbMap: Record<string, string> = {
  'var(--accent)': 'var(--accent-rgb)',
  'var(--green)': 'var(--green-rgb)',
  'var(--red)': 'var(--red-rgb)',
  'var(--yellow)': 'var(--yellow-rgb)',
  'var(--orange)': 'var(--orange-rgb)',
  'var(--purple)': 'var(--purple-rgb)',
  'var(--t1)': 'var(--t1-rgb)',
  'var(--t2)': 'var(--t2-rgb)',
  'var(--t3)': 'var(--t3-rgb)',
  'var(--border)': 'var(--border-rgb)',
};

/** Create a semi-transparent version of a theme color.
 *  Usage: alpha(C.accent, 0.1) → "rgba(var(--accent-rgb), 0.1)" */
export function alpha(color: string, opacity: number): string {
  const rgb = rgbMap[color];
  if (rgb) return `rgba(${rgb}, ${opacity})`;
  if (import.meta.env.DEV) console.warn(`alpha(): no RGB mapping for "${color}"`);
  return color;
}

// Shared button styles — use these instead of duplicating per-component
export const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#000', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};

export const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer', fontFamily: F.body, fontSize: 14,
};
