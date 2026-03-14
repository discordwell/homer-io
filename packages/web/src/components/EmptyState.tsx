import { C, F } from '../theme.js';

interface EmptyStateProps { icon?: string; title: string; description?: string; action?: React.ReactNode; }

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      padding: 48, textAlign: 'center', background: C.bg2,
      borderRadius: 12, border: `1px solid ${C.muted}`,
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: F.display, fontSize: 18, marginBottom: 8, color: C.text }}>{title}</h3>
      {description && <p style={{ color: C.dim, fontSize: 14, marginBottom: 20 }}>{description}</p>}
      {action}
    </div>
  );
}
