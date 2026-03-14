import { C, F } from '../../theme.js';
import type { RouteEfficiency } from '@homer-io/shared';

interface RouteEfficiencyCardProps {
  data: RouteEfficiency | null;
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, fontFamily: F.display, color: C.text }}>
        {value}
      </div>
      {sub && <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function RouteEfficiencyCard({ data }: RouteEfficiencyCardProps) {
  if (!data) return null;

  const completionPct = data.avgCompletionRate;

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 20,
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, margin: '0 0 20px 0', color: C.text }}>
        Route Efficiency
      </h3>
      <Metric label="Total Routes" value={data.totalRoutes} />
      <Metric label="Completed" value={data.completedRoutes}
        sub={data.totalRoutes > 0 ? `${Math.round((data.completedRoutes / data.totalRoutes) * 100)}% of total` : undefined} />
      <Metric label="Avg Stops / Route" value={data.avgStopsPerRoute} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: C.dim, fontSize: 12, marginBottom: 4 }}>Completion Rate</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 600, fontFamily: F.display, color: C.text }}>
            {completionPct}%
          </div>
          <div style={{
            flex: 1, height: 6, borderRadius: 3, background: C.muted, overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(completionPct, 100)}%`, height: '100%', borderRadius: 3,
              background: completionPct > 80 ? C.green : completionPct > 50 ? C.yellow : C.red,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>
      <Metric label="Avg Duration" value={data.avgDuration != null ? `${data.avgDuration} min` : '\u2014'} />
    </div>
  );
}
