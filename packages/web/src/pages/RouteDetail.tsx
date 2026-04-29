import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoutesStore } from '../stores/routes.js';
import { RouteMap } from '../components/RouteMap.js';
import { Badge } from '../components/Badge.js';
import { Bar } from '../components/Bar.js';
import { KPICard } from '../components/KPICard.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { MessagePanel } from '../components/MessagePanel.js';
import { useToast } from '../components/Toast.js';
import { DegradedRoutingBanner } from '../components/DegradedRoutingBanner.js';
import { RiskBadge, riskSummary } from '../components/RiskBadge.js';
import { api } from '../api/client.js';
import { C, F, alpha, primaryBtnStyle, secondaryBtnStyle } from '../theme.js';

interface RiskScore {
  orderId: string;
  score: number;
  factors: Array<{ name: string; points: number; detail: string }>;
}

const statusColors: Record<string, string> = {
  draft: 'dim', planned: 'blue', in_progress: 'yellow', completed: 'green', cancelled: 'red',
};

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRoute, fetchRoute, optimizeRoute } = useRoutesStore();
  const { toast } = useToast();
  const [optimizing, setOptimizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);

  // Reset loading/error on id change — adjust state during render.
  const [seenId, setSeenId] = useState(id);
  if (seenId !== id) {
    setSeenId(id);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchRoute(id)
      .then(() => { if (!cancelled) setLoading(false); })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Route not found');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, fetchRoute]);

  // Fetch risk scores for planned/in_progress routes
  useEffect(() => {
    if (!id || !currentRoute) return;
    const { status } = currentRoute;
    if (status !== 'planned' && status !== 'in_progress') return;
    api.get<RiskScore[]>(`/intelligence/risk/${id}`)
      .then(setRiskScores)
      .catch(() => {}); // Silently fail — intelligence is optional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentRoute?.status]);

  if (loading) return <LoadingSpinner />;

  if (error || !currentRoute) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
        <h3 style={{ fontFamily: F.display, fontSize: 18, marginBottom: 8, color: C.text }}>Route not found</h3>
        <p style={{ color: C.dim, fontSize: 14, marginBottom: 20 }}>{error || 'This route does not exist or was deleted.'}</p>
        <button onClick={() => navigate('/dashboard/routes')} style={{
          padding: '10px 20px', borderRadius: 8, background: C.accent,
          border: 'none', color: '#000', cursor: 'pointer', fontFamily: F.body, fontWeight: 600,
        }}>Back to Routes</button>
      </div>
    );
  }

  const route = currentRoute;
  const pct = route.totalStops > 0 ? (route.completedStops / route.totalStops) * 100 : 0;

  const mapStops = (route.orders || [])
    .filter(o => o.deliveryLat && o.deliveryLng)
    .map(o => ({
      lat: Number(o.deliveryLat),
      lng: Number(o.deliveryLng),
      label: o.recipientName,
    }));

  async function handleOptimize() {
    if (!id) return;
    setOptimizing(true);
    try {
      const result = await optimizeRoute(id);
      toast(result.message, result.optimized ? 'success' : 'info');
      if (result.optimized) fetchRoute(id);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Optimization failed', 'error');
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <div>
      <div className="route-detail-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard/routes')}
            style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 18 }}>←</button>
          <div>
            <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>{route.name}</h2>
            <Badge color={statusColors[route.status]}>{route.status.replace('_', ' ')}</Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowMessages(!showMessages)} style={secondaryBtnStyle}>
            {showMessages ? 'Hide Messages' : 'Messages'}
          </button>
          <button onClick={handleOptimize} disabled={optimizing || (route.orders?.length || 0) < 2}
            style={primaryBtnStyle}>
            {optimizing ? 'Optimizing...' : 'Optimize Route'}
          </button>
        </div>
      </div>

      {/* Degraded routing warning */}
      {route.optimizationNotes?.includes('approximate') && (
        <DegradedRoutingBanner context="optimization" />
      )}

      {/* KPI row */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard icon="📍" label="Total Stops" value={route.totalStops} color={C.accent} />
        <KPICard icon="✅" label="Completed" value={route.completedStops} color={C.green} />
        <KPICard icon="📏" label="Distance" value={route.totalDistance ? `${Number(route.totalDistance).toFixed(1)} km` : '—'} color={C.yellow} />
        <KPICard icon="⏱️" label="Duration" value={route.totalDuration ? `${route.totalDuration} min` : '—'} color={C.purple} />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: C.dim, fontSize: 13 }}>Progress</span>
          <span style={{ color: C.dim, fontSize: 13 }}>{Math.round(pct)}%</span>
        </div>
        <Bar val={pct} color={pct === 100 ? C.green : C.accent} height={8} />
      </div>

      {/* Map */}
      {mapStops.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <RouteMap stops={mapStops} height="400px" />
        </div>
      )}

      {/* Optimization notes */}
      {route.optimizationNotes && (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 8 }}>Optimization Notes</h3>
          <p style={{ color: C.dim, fontSize: 14, whiteSpace: 'pre-wrap' }}>{route.optimizationNotes}</p>
        </div>
      )}

      {/* Messages panel */}
      {showMessages && id && (
        <div style={{ marginBottom: 24 }}>
          <MessagePanel routeId={id} onClose={() => setShowMessages(false)} />
        </div>
      )}

      {/* Risk summary banner */}
      {(() => {
        const summary = riskScores.length > 0 ? riskSummary(riskScores) : null;
        return summary ? (
          <div style={{
            background: alpha(C.orange, 0.07), border: `1px solid ${alpha(C.orange, 0.25)}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>&#9888;</span>
            <span style={{ fontSize: 13, color: C.orange, fontWeight: 600 }}>
              {summary}
            </span>
          </div>
        ) : null;
      })()}

      {/* Order list */}
      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 16 }}>Stops ({route.orders?.length || 0})</h3>
        {(route.orders || []).length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14, textAlign: 'center', padding: 24 }}>No stops assigned</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(route.orders || []).map((order, i) => {
              const risk = riskScores.find(r => r.orderId === order.id);
              return (
                <div key={order.id} className="route-detail-stop" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  background: C.bg3, borderRadius: 8,
                }}>
                  <span style={{ color: C.accent, fontWeight: 600, fontSize: 16, width: 28, textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{order.recipientName}</div>
                    <div style={{ color: C.dim, fontSize: 12 }}>{order.deliveryAddress.street}, {order.deliveryAddress.city}</div>
                  </div>
                  {risk && <RiskBadge score={risk.score} factors={risk.factors} />}
                  <Badge color={order.status === 'delivered' ? 'green' : order.status === 'failed' ? 'red' : 'blue'}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                  <span style={{ color: C.dim, fontSize: 12 }}>{order.packageCount} pkg</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
