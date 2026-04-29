import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { KPICard } from './KPICard.js';
import { C, F } from '../theme.js';

interface InsightsData {
  summary: {
    totalAddressesLearned: number;
    totalDeliveriesTracked: number;
    overallFailureRate: number;
  };
  last7Days: {
    deliveriesTracked: number;
    avgServiceTimeSeconds: number | null;
    avgEtaErrorMinutes: number | null;
  };
  topFailureAddresses: Array<{
    addressHash: string;
    addressNormalized: { street: string; city: string; state: string; zip: string };
    totalDeliveries: number;
    failedDeliveries: number;
    successfulDeliveries: number;
    commonFailureReasons: Array<{ reason: string; count: number }>;
  }>;
}

export function IntelligenceWidget() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.get<InsightsData>('/intelligence/insights');
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.warn('IntelligenceWidget: failed to fetch insights', err);
        setError(err instanceof Error ? err.message : 'Failed to load intelligence');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: C.dim, fontSize: 13, textAlign: 'center', padding: 24 }}>Loading intelligence...</div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently hide widget if intelligence unavailable
  }

  const { summary, topFailureAddresses } = data;

  // Don't show widget if no data has been learned yet
  if (summary.totalAddressesLearned === 0 && summary.totalDeliveriesTracked === 0) {
    return null;
  }

  const avgServiceMin = data.last7Days.avgServiceTimeSeconds
    ? `${(data.last7Days.avgServiceTimeSeconds / 60).toFixed(1)} min`
    : '\u2014';

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0, color: C.text }}>
          Delivery Intelligence
        </h3>
        <span style={{ fontSize: 12, color: C.dim }}>Powered by learning</span>
      </div>

      {/* KPI row */}
      <div className="intel-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard icon="🧠" label="Addresses Learned" value={summary.totalAddressesLearned} color={C.accent} />
        <KPICard icon="📊" label="Deliveries Tracked" value={summary.totalDeliveriesTracked} color={C.green} />
        <KPICard icon="⏱️" label="Avg Service Time" value={avgServiceMin} color={C.yellow} />
      </div>

      {/* Top failure addresses */}
      {topFailureAddresses.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10, fontFamily: F.display }}>
            Top Failure Addresses
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topFailureAddresses.slice(0, 5).map((addr) => {
              const failRate = addr.totalDeliveries > 0
                ? Math.round((addr.failedDeliveries / addr.totalDeliveries) * 100)
                : 0;
              const topReason = addr.commonFailureReasons?.[0];
              return (
                <div key={addr.addressHash} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: C.bg3, borderRadius: 8,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text }}>
                      {addr.addressNormalized.street}, {addr.addressNormalized.city}
                    </div>
                    {topReason && (
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                        Top reason: {topReason.reason.replace(/_/g, ' ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, fontFamily: F.mono,
                      color: failRate >= 50 ? C.red : failRate >= 30 ? C.orange : C.yellow,
                    }}>
                      {failRate}% fail
                    </div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      {addr.totalDeliveries} deliveries
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  background: C.bg2, borderRadius: 12,
  border: `1px solid ${C.muted}`, padding: 16,
};
