import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoutesStore } from '../stores/routes.js';
import { RouteMap } from '../components/RouteMap.js';
import { Badge } from '../components/Badge.js';
import { Bar } from '../components/Bar.js';
import { KPICard } from '../components/KPICard.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';

const statusColors: Record<string, string> = {
  draft: 'dim', planned: 'blue', in_progress: 'yellow', completed: 'green', cancelled: 'red',
};

export function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRoute, fetchRoute, optimizeRoute } = useRoutesStore();
  const { toast } = useToast();
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    if (id) fetchRoute(id);
  }, [id]);

  if (!currentRoute) return <LoadingSpinner />;

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard/routes')}
            style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 18 }}>←</button>
          <div>
            <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>{route.name}</h2>
            <Badge color={statusColors[route.status]}>{route.status.replace('_', ' ')}</Badge>
          </div>
        </div>
        <button onClick={handleOptimize} disabled={optimizing || (route.orders?.length || 0) < 2}
          style={primaryBtnStyle}>
          {optimizing ? 'Optimizing...' : '🤖 AI Optimize'}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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

      {/* Order list */}
      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 16 }}>Stops ({route.orders?.length || 0})</h3>
        {(route.orders || []).length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14, textAlign: 'center', padding: 24 }}>No stops assigned</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(route.orders || []).map((order, i) => (
              <div key={order.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                background: C.bg3, borderRadius: 8,
              }}>
                <span style={{ color: C.accent, fontWeight: 600, fontSize: 16, width: 28, textAlign: 'center' }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{order.recipientName}</div>
                  <div style={{ color: C.dim, fontSize: 12 }}>{order.deliveryAddress.street}, {order.deliveryAddress.city}</div>
                </div>
                <Badge color={order.status === 'delivered' ? 'green' : order.status === 'failed' ? 'red' : 'blue'}>
                  {order.status.replace('_', ' ')}
                </Badge>
                <span style={{ color: C.dim, fontSize: 12 }}>{order.packageCount} pkg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};
