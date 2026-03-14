import { C } from '../theme.js';

interface BarProps { val: number; color?: string; height?: number; }

export function Bar({ val, color = C.accent, height = 6 }: BarProps) {
  return (
    <div style={{ background: C.muted, borderRadius: height / 2, height, width: '100%', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, val))}%`, height: '100%',
        background: color, borderRadius: height / 2, transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
