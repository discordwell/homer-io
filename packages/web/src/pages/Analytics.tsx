import { useAnalytics } from '../hooks/useAnalytics.js';
import { AnimatedKPICard } from '../components/analytics/AnimatedKPICard.js';
import { EnhancedTrendChart } from '../components/analytics/EnhancedTrendChart.js';
import { DeliveryHeatmap } from '../components/analytics/DeliveryHeatmap.js';
import { InsightsStrip } from '../components/analytics/InsightsStrip.js';
import { AnalyticsPromptBar } from '../components/analytics/AnalyticsPromptBar.js';
import { DriverPerformanceTable } from '../components/analytics/DriverPerformanceTable.js';
import { RouteAnalytics } from '../components/analytics/RouteAnalytics.js';
import { DeliveryOutcomes } from '../components/analytics/DeliveryOutcomes.js';
import { ReportDownload } from '../components/analytics/ReportDownload.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { C, F, alpha } from '../theme.js';

const ranges = ['7d', '30d', '90d'] as const;

export function AnalyticsPage() {
  const {
    enhancedOverview, enhancedDrivers, enhancedRoutes, enhancedTrends,
    heatmap, insights, outcomes,
    range, setRange, loading, exportCsv, activeTab, setActiveTab,
  } = useAnalytics();

  if (loading && !enhancedOverview) return <LoadingSpinner />;

  const ov = enhancedOverview;

  return (
    <div>
      {/* ── Zone A: The Glance ── */}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Analytics</h2>
          <p style={{ color: C.dim, margin: 0, fontSize: 13 }}>Performance metrics, trends, and insights</p>
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
          <ReportDownload />
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

      {/* Copilot Prompt Bar */}
      <AnalyticsPromptBar />

      {/* KPI Cards (6 animated) */}
      {ov && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24,
        }}>
          <AnimatedKPICard
            icon="📦"
            label="Deliveries"
            value={ov.totalDeliveries}
            sparkline={ov.sparklines.deliveries}
            delta={ov.deltas.deliveries}
            color={C.green}
            delay={0}
          />
          <AnimatedKPICard
            icon="✅"
            label="Success Rate"
            value={Math.round(ov.successRate)}
            suffix="%"
            sparkline={ov.sparklines.successRate}
            delta={ov.deltas.successRate}
            color={ov.successRate >= 95 ? C.green : ov.successRate >= 90 ? C.yellow : C.red}
            delay={80}
          />
          <AnimatedKPICard
            icon="⏱"
            label="On-Time Rate"
            value={Math.round(ov.onTimeRate)}
            suffix="%"
            sparkline={ov.sparklines.onTimeRate}
            delta={ov.deltas.onTimeRate}
            color={ov.onTimeRate >= 95 ? C.green : ov.onTimeRate >= 90 ? C.yellow : C.red}
            delay={160}
          />
          <AnimatedKPICard
            icon="⚡"
            label="Avg Time"
            value={ov.avgDeliveryTime ?? 0}
            suffix="m"
            sparkline={ov.sparklines.avgDeliveryTime}
            delta={ov.deltas.avgDeliveryTime}
            color={C.accent}
            delay={240}
          />
          <AnimatedKPICard
            icon="🚗"
            label="Active Drivers"
            value={ov.activeDriverCount}
            sparkline={ov.sparklines.activeDrivers}
            delta={ov.deltas.activeDrivers}
            color={C.purple}
            delay={320}
          />
          <AnimatedKPICard
            icon="📋"
            label="Orders"
            value={ov.ordersReceived}
            sparkline={ov.sparklines.ordersReceived}
            delta={ov.deltas.ordersReceived}
            color={C.yellow}
            delay={400}
          />
        </div>
      )}

      {/* ── Zone B: The Story ── */}

      {/* Trend Chart + Heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 24 }}>
        <EnhancedTrendChart data={enhancedTrends} />
        <DeliveryHeatmap data={heatmap} />
      </div>

      {/* Insights Strip */}
      <InsightsStrip insights={insights} />

      {/* ── Zone C: The Detail ── */}

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.muted}`,
      }}>
        {([
          { key: 'drivers' as const, label: 'Drivers' },
          { key: 'routes' as const, label: 'Routes' },
          { key: 'outcomes' as const, label: 'Delivery Outcomes' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              fontFamily: F.body, fontSize: 13, fontWeight: 500,
              background: 'transparent',
              color: activeTab === key ? C.accent : C.dim,
              borderBottom: `2px solid ${activeTab === key ? C.accent : 'transparent'}`,
              marginBottom: -1,
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 20,
        animation: 'tab-fade-in 200ms ease-out',
      }}>
        {activeTab === 'drivers' && enhancedDrivers.length > 0 && (
          <DriverPerformanceTable drivers={enhancedDrivers} />
        )}
        {activeTab === 'routes' && enhancedRoutes && (
          <RouteAnalytics data={enhancedRoutes} />
        )}
        {activeTab === 'outcomes' && outcomes && (
          <DeliveryOutcomes data={outcomes} />
        )}
        {activeTab === 'drivers' && enhancedDrivers.length === 0 && !loading && (
          <div style={{ color: C.dim, fontSize: 13, fontFamily: F.body, padding: 20, textAlign: 'center' }}>
            No driver performance data for this period.
          </div>
        )}
      </div>
    </div>
  );
}
