import { C, F } from '../theme.js';

const colorMap: Record<string, string> = {
  blue: C.accent, green: C.green, yellow: C.yellow, red: C.red, orange: C.orange, purple: C.purple, dim: C.dim,
};

interface BadgeProps { color?: keyof typeof colorMap | string; size?: 'sm' | 'md'; children: React.ReactNode; }

export function Badge({ color = 'blue', size = 'sm', children }: BadgeProps) {
  const c = colorMap[color] || color;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999, fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600, fontFamily: F.body,
      background: `${c}18`, color: c, border: `1px solid ${c}30`,
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {children}
    </span>
  );
}
