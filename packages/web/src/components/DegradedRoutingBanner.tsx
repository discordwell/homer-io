import { C, F } from '../theme.js';

interface DegradedRoutingBannerProps {
  /** What was degraded: 'optimization', 'dispatch', or 'eta' */
  context: string;
}

/**
 * Big angry banner shown when the routing engine fell back to haversine.
 * This is intentionally loud — we never want silent degradation.
 */
export function DegradedRoutingBanner({ context }: DegradedRoutingBannerProps) {
  return (
    <div style={{
      background: `${C.red}12`,
      border: `2px solid ${C.red}60`,
      borderRadius: 12,
      padding: '14px 18px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
      <div>
        <div style={{
          fontFamily: F.display,
          fontSize: 14,
          fontWeight: 700,
          color: C.red,
          marginBottom: 4,
        }}>
          Degraded Routing — Estimates Are Approximate
        </div>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
          The routing engine (OSRM) is unavailable. {context === 'optimization'
            ? 'Route was optimized using straight-line distances — stop order may not be optimal.'
            : context === 'dispatch'
            ? 'Dispatch used straight-line distances — assignments may not reflect actual road distances.'
            : 'ETAs are calculated from straight-line distance with a road correction factor, not actual roads.'}
          {' '}Contact your admin to check OSRM status.
        </div>
      </div>
    </div>
  );
}
