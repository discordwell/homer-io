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
  'var(--t2)': 'var(--t2-rgb)',
  'var(--t3)': 'var(--t3-rgb)',
};

/** Create a semi-transparent version of a theme color.
 *  Usage: alpha(C.accent, 0.1) → "rgba(var(--accent-rgb), 0.1)" */
export function alpha(color: string, opacity: number): string {
  const rgb = rgbMap[color];
  if (rgb) return `rgba(${rgb}, ${opacity})`;
  // Fallback: return the color as-is (won't have alpha but won't crash)
  return color;
}
