import { C, F } from '../theme.js';

interface EtaBadgeProps {
  /** ETA in minutes. If <= 2, shows "Arriving" */
  etaMinutes: number | null;
  /** Optional size variant */
  size?: 'sm' | 'md';
}

export function EtaBadge({ etaMinutes, size = 'sm' }: EtaBadgeProps) {
  if (etaMinutes == null) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '2px 8px' : '4px 12px',
        borderRadius: 999,
        fontSize: size === 'sm' ? 11 : 13,
        fontWeight: 600,
        fontFamily: F.mono,
        background: `${C.dim}18`,
        color: C.dim,
        border: `1px solid ${C.dim}30`,
      }}>
        --
      </span>
    );
  }

  const isArriving = etaMinutes <= 2;
  const color = isArriving ? C.green : etaMinutes <= 15 ? C.accent : etaMinutes <= 30 ? C.yellow : C.orange;
  const label = isArriving ? 'Arriving' : `~${Math.round(etaMinutes)} min`;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      fontFamily: F.mono,
      background: `${color}18`,
      color,
      border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}
