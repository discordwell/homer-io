import { C, F } from '../theme.js';

interface EtaBadgeProps {
  /** ETA in minutes. If <= 2, shows "Arriving" */
  etaMinutes: number | null;
  /** Optional size variant */
  size?: 'sm' | 'md';
  /** Routing source — 'haversine' triggers a degraded-mode indicator */
  source?: 'google' | 'osrm' | 'haversine';
}

export function EtaBadge({ etaMinutes, size = 'sm', source }: EtaBadgeProps) {
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

  const isDegraded = source === 'haversine';
  const isArriving = etaMinutes <= 2;
  const color = isDegraded ? C.red : isArriving ? C.green : etaMinutes <= 15 ? C.accent : etaMinutes <= 30 ? C.yellow : C.orange;
  const label = isArriving ? 'Arriving' : `~${Math.round(etaMinutes)} min`;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      borderRadius: 999,
      fontSize: size === 'sm' ? 11 : 13,
      fontWeight: 600,
      fontFamily: F.mono,
      background: `${color}18`,
      color,
      border: `1px solid ${color}30`,
    }}>
      {isDegraded && <span title="Approximate — routing engine unavailable">⚠</span>}
      {label}
    </span>
  );
}
