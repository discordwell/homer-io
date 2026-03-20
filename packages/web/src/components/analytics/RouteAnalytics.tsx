import { C, F, alpha } from '../../theme.js';
import type { EnhancedRouteEfficiency } from '@homer-io/shared';

interface RouteAnalyticsProps {
  data: EnhancedRouteEfficiency;
}

export function RouteAnalytics({ data }: RouteAnalyticsProps) {
  const completedRoutes = data.routes.filter(r => r.durationMinutes != null);
  const maxDuration = Math.max(...completedRoutes.map(r => r.durationMinutes ?? 0), 1);

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Routes', value: data.totalRoutes },
          { label: 'Completed', value: data.completedRoutes },
          { label: 'Avg Stops/Route', value: data.avgStopsPerRoute },
          { label: 'Completion Rate', value: `${data.avgCompletionRate}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: alpha(C.text, 0.03), borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: 'uppercase' as const, fontFamily: F.body }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: F.display, color: C.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Duration bars — actual vs planned */}
      <h4 style={{ fontFamily: F.display, fontSize: 14, color: C.text, margin: '0 0 12px 0' }}>
        Route Duration Comparison
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {completedRoutes.slice(0, 15).map((r) => {
          const actual = r.durationMinutes ?? 0;
          const planned = r.plannedDurationMinutes ?? actual;
          const overUnder = planned > 0 ? ((actual - planned) / planned) * 100 : 0;
          const isOver = overUnder > 5;
          const isUnder = overUnder < -5;

          return (
            <div key={r.routeId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Route name */}
              <div style={{
                width: 140, fontSize: 11, color: C.dim, fontFamily: F.body,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {r.routeName}
              </div>

              {/* Bar */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  height: 12, borderRadius: 4, overflow: 'hidden', flex: 1,
                  background: alpha(C.text, 0.06), position: 'relative',
                }}>
                  {/* Planned bar (ghost) */}
                  {planned > 0 && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, height: '100%',
                      width: `${Math.min((planned / maxDuration) * 100, 100)}%`,
                      background: alpha(C.text, 0.08),
                      borderRadius: 4,
                    }} />
                  )}
                  {/* Actual bar */}
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${Math.min((actual / maxDuration) * 100, 100)}%`,
                    background: isOver ? C.red : isUnder ? C.green : C.accent,
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>

                {/* Duration label */}
                <span style={{
                  fontSize: 10, fontFamily: F.mono, color: C.dim, minWidth: 40, textAlign: 'right',
                }}>
                  {actual}m
                </span>

                {/* Over/under indicator */}
                {Math.abs(overUnder) > 5 && (
                  <span style={{
                    fontSize: 9, fontFamily: F.mono, padding: '1px 5px', borderRadius: 3,
                    background: isOver ? alpha(C.red, 0.1) : alpha(C.green, 0.1),
                    color: isOver ? C.red : C.green,
                  }}>
                    {isOver ? '+' : ''}{Math.round(overUnder)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stops vs Duration scatter */}
      {completedRoutes.length >= 3 && (
        <>
          <h4 style={{ fontFamily: F.display, fontSize: 14, color: C.text, margin: '24px 0 12px 0' }}>
            Stops vs Duration
          </h4>
          <div style={{ position: 'relative', height: 200, border: `1px solid ${alpha(C.text, 0.06)}`, borderRadius: 8, padding: '10px 10px 24px 30px' }}>
            {/* Y axis label */}
            <div style={{ position: 'absolute', left: 2, top: '50%', transform: 'rotate(-90deg) translateX(50%)', fontSize: 9, color: C.dim, fontFamily: F.body }}>
              Duration (min)
            </div>
            {/* X axis label */}
            <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: C.dim, fontFamily: F.body }}>
              Stops
            </div>

            {/* Dots */}
            {completedRoutes.map((r) => {
              const maxStops = Math.max(...completedRoutes.map(rr => rr.stops), 1);
              const x = (r.stops / maxStops) * 100;
              const y = 100 - ((r.durationMinutes ?? 0) / maxDuration) * 100;
              return (
                <div
                  key={r.routeId}
                  title={`${r.routeName}: ${r.stops} stops, ${r.durationMinutes}m`}
                  style={{
                    position: 'absolute',
                    left: `${10 + x * 0.8}%`,
                    top: `${5 + y * 0.85}%`,
                    width: 8, height: 8, borderRadius: '50%',
                    background: r.completionRate >= 90 ? C.green : r.completionRate >= 50 ? C.accent : C.red,
                    border: `1px solid ${C.bg}`,
                    cursor: 'default',
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
