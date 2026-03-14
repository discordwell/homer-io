// Design tokens derived from demo App.jsx
export const C = {
  bg: '#03080F',
  bg2: '#070F1C',
  bg3: '#0B1525',
  surface: '#070F1C',  // alias for bg2
  card: '#0B1525',     // alias for bg3
  accent: '#5BA4F5',
  accentGlow: '0 0 20px rgba(91,164,245,0.3)',
  green: '#34D399',
  yellow: '#FBBF24',
  red: '#F87171',
  orange: '#FB923C',
  purple: '#A78BFA',
  text: '#EEF3FC',
  dim: '#6888AA',
  muted: '#2A3F5C',
  border: '#162030',
} as const;

export const F = {
  display: "'Syne', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;
