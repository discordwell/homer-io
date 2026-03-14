import { useAnalytics } from '../hooks/useAnalytics.js';
import { KPICard } from '../components/KPICard.js';
import { TrendChart } from '../components/analytics/TrendChart.js';
import { DriverLeaderboard } from '../components/analytics/DriverLeaderboard.js';
import { RouteEfficiencyCard } from '../components/analytics/RouteEfficiencyCard.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { C, F } from '../theme.js';

const ranges = ['7d', '30d', '90d'] as const;

export function AnalyticsPage() {
  const { overview, drivers, routeEfficiency, trends, range, setRange, loading, exportCsv } = useAnalytics();

  if (loading && !overview) return <LoadingSpinner />;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Analytics</h2>
          <p style={{ color: C.dim, margin: 0, fontSize: 14 }}>Performance metrics and trends</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Range selector */}
          <div style={{
            display: 'flex', background: C.bg3, borderRadius: 8,
            border: `1px solid ${C.muted}`, overflow: 'hidden',
          }}>
            {ranges.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '8px 16px', border: 'none', cursor: 'pointer',
                  fontFamily: F.body, fontSize: 13, fontWeight: 500,
                  background: range === r ? C.accent : 'transparent',
                  color: range === r ? C.bg : C.dim,
                  transition: 'all 0.15s ease',
                }}
              >
                {r}
              </button>
            ))}
          </div>
          {/* Export button */}
          <button
            onClick={exportCsv}
            style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.muted}`,
              background: C.bg3, color: C.text, cursor: 'pointer',
              fontFamily: F.body, fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard
          icon="📦"
          label="Total Deliveries"
          value={overview?.totalDeliveries ?? 0}
          color={C.green}
        />
        <KPICard
          icon="✅"
          label="Success Rate"
          value={overview?.successRate != null ? `${overview.successRate}%` : '\u2014'}
          color={C.accent}
        />
        <KPICard
          icon="🗺️"
          label="Total Routes"
          value={overview?.totalRoutes ?? 0}
          color={C.purple}
        />
        <KPICard
          icon="📋"
          label="Orders Received"
          value={overview?.ordersReceived ?? 0}
          color={C.yellow}
        />
      </div>

      {/* Two-column: TrendChart + RouteEfficiency */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
        <TrendChart data={trends} />
        <RouteEfficiencyCard data={routeEfficiency} />
      </div>

      {/* Full-width: Driver Leaderboard */}
      <DriverLeaderboard drivers={drivers} />
    </div>
  );
}
