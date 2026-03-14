import { C, F } from '../theme.js';

interface PillProps { active?: boolean; onClick?: () => void; children: React.ReactNode; }

export function Pill({ active, onClick, children }: PillProps) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 999,
      background: active ? C.accent : 'transparent',
      color: active ? '#fff' : C.dim,
      border: `1px solid ${active ? C.accent : C.muted}`,
      fontSize: 13, fontWeight: 500, cursor: 'pointer',
      fontFamily: F.body, transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}
