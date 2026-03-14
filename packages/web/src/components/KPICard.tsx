import { C, F } from '../theme.js';

interface KPICardProps { icon: string; label: string; value: string | number; sub?: string; color?: string; }

export function KPICard({ icon, label, value, sub, color = C.accent }: KPICardProps) {
  return (
    <div style={{
      background: `radial-gradient(ellipse at top left, ${color}12 0%, ${C.bg2} 70%)`,
      borderRadius: 12, padding: 20, border: `1px solid ${C.muted}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ color: C.dim, fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: F.display, color: C.text }}>
        {value}
      </div>
      {sub && <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
