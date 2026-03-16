import { useState, useEffect } from 'react';
import { DegradedRoutingBanner } from '../DegradedRoutingBanner.js';
import { RiskBadge } from '../RiskBadge.js';
import { C, F } from '../../theme.js';
import { api } from '../../api/client.js';

interface RiskScore {
  orderId: string;
  score: number;
  factors: Array<{ name: string; points: number; detail: string }>;
}

interface RouteRisk {
  routeId: string;
  maxScore: number;
  scores: RiskScore[];
}

interface DispatchRoute {
  id: string;
  name: string;
  driverName: string;
  totalStops: number;
  estimatedDistance?: number;
  reasoning?: string;
  status: string;
}

interface DispatchPreviewProps {
  routes: DispatchRoute[];
  unassignedOrderIds: string[];
  totalOrders: number;
  totalDrivers: number;
  message?: string;
  onConfirmed: () => void;
  onReset: () => void;
}

export function DispatchPreview({
  routes,
  unassignedOrderIds,
  totalOrders,
  totalDrivers,
  message,
  onConfirmed,
  onReset,
}: DispatchPreviewProps) {
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(
    new Set(routes.map(r => r.id))
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeRisks, setRouteRisks] = useState<Map<string, RouteRisk>>(new Map());

  const routeColors = [C.accent, C.green, C.yellow, C.purple, C.orange, C.red];

  // Fetch risk scores for each proposed route
  useEffect(() => {
    if (routes.length === 0) return;
    let cancelled = false;
    Promise.all(
      routes.map(async (r) => {
        try {
          const scores = await api.get<RiskScore[]>(`/intelligence/risk/${r.id}`);
          const maxScore = scores.length > 0 ? Math.max(...scores.map(s => s.score)) : 0;
          return { routeId: r.id, maxScore, scores } as RouteRisk;
        } catch {
          return null;
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, RouteRisk>();
      for (const r of results) {
        if (r) map.set(r.routeId, r);
      }
      setRouteRisks(map);
    });
    return () => { cancelled = true; };
  }, [routes]);

  const highRiskRouteCount = Array.from(routeRisks.values()).filter(r => r.maxScore >= 60).length;

  function toggleRoute(routeId: string) {
    setSelectedRouteIds(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedRouteIds(new Set(routes.map(r => r.id)));
  }

  function deselectAll() {
    setSelectedRouteIds(new Set());
  }

  async function handleConfirm() {
    if (selectedRouteIds.size === 0) return;
    setConfirming(true);
    setError(null);
    try {
      await api.post('/dispatch/auto-dispatch/confirm', {
        routeIds: Array.from(selectedRouteIds),
      });
      setConfirmed(true);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm dispatch');
    } finally {
      setConfirming(false);
    }
  }

  if (confirmed) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h3 style={{ fontFamily: F.display, fontSize: 20, color: C.green, marginBottom: 8 }}>
            Dispatch Confirmed
          </h3>
          <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>
            {selectedRouteIds.size} route{selectedRouteIds.size !== 1 ? 's' : ''} have been planned and assigned to drivers.
          </p>
          <button onClick={onReset} style={secondaryBtnStyle}>
            Run Another Dispatch
          </button>
        </div>
      </div>
    );
  }

  if (message && routes.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p style={{ color: C.yellow, fontSize: 14, marginBottom: 16 }}>{message}</p>
          <button onClick={onReset} style={secondaryBtnStyle}>Back</button>
        </div>
      </div>
    );
  }

  const isDegraded = routes.some(r => r.reasoning?.includes('approximate'));

  return (
    <div style={containerStyle}>
      {isDegraded && <DegradedRoutingBanner context="dispatch" />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: 0 }}>
            Dispatch Preview
          </h3>
          <p style={{ color: C.dim, fontSize: 13, margin: '4px 0 0' }}>
            {routes.length} route{routes.length !== 1 ? 's' : ''} proposed for {totalOrders} order{totalOrders !== 1 ? 's' : ''} across {totalDrivers} driver{totalDrivers !== 1 ? 's' : ''}
            {highRiskRouteCount > 0 && (
              <span style={{ color: C.yellow, marginLeft: 8 }}>
                &#9888; {highRiskRouteCount} high-risk route{highRiskRouteCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={selectAll} style={smallBtnStyle}>Select All</button>
          <button onClick={deselectAll} style={smallBtnStyle}>Deselect All</button>
        </div>
      </div>

      {/* Unassigned warning */}
      {unassignedOrderIds.length > 0 && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: `1px solid ${C.yellow}33`,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: C.yellow,
        }}>
          {unassignedOrderIds.length} order{unassignedOrderIds.length !== 1 ? 's' : ''} could not be assigned (insufficient drivers or capacity).
        </div>
      )}

      {/* Route cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {routes.map((route, idx) => {
          const color = routeColors[idx % routeColors.length];
          const selected = selectedRouteIds.has(route.id);
          return (
            <div
              key={route.id}
              onClick={() => toggleRoute(route.id)}
              style={{
                background: selected ? `${color}11` : C.bg3,
                border: `1px solid ${selected ? color : C.muted}`,
                borderRadius: 10,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Color dot */}
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 14, color: C.text }}>
                      {route.driverName}
                    </div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>
                        {route.totalStops} stop{route.totalStops !== 1 ? 's' : ''}
                        {route.estimatedDistance != null && ` \u00B7 ~${route.estimatedDistance.toFixed(1)} km`}
                      </span>
                      {routeRisks.get(route.id) && (
                        <RiskBadge score={routeRisks.get(route.id)!.maxScore} factors={routeRisks.get(route.id)!.scores.flatMap(s => s.factors)} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  border: `2px solid ${selected ? color : C.muted}`,
                  background: selected ? color : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 12,
                  color: '#fff',
                  fontWeight: 700,
                }}>
                  {selected ? '\u2713' : ''}
                </div>
              </div>

              {/* AI reasoning */}
              {route.reasoning && (
                <div style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: `1px solid ${C.muted}`,
                  fontSize: 12,
                  color: C.dim,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}>
                  AI: {route.reasoning}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248, 113, 113, 0.1)',
          border: `1px solid ${C.red}33`,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: C.red,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button onClick={onReset} style={secondaryBtnStyle} disabled={confirming}>
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedRouteIds.size === 0 || confirming}
          style={{
            ...primaryBtnStyle,
            opacity: selectedRouteIds.size === 0 || confirming ? 0.5 : 1,
            cursor: selectedRouteIds.size === 0 || confirming ? 'not-allowed' : 'pointer',
          }}
        >
          {confirming ? 'Confirming...' : `Confirm ${selectedRouteIds.size} Route${selectedRouteIds.size !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.muted}`,
  borderRadius: 12,
  padding: 20,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: C.green,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: 'transparent',
  border: `1px solid ${C.muted}`,
  color: C.dim,
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 500,
  fontSize: 14,
};

const smallBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 6,
  background: 'transparent',
  border: `1px solid ${C.muted}`,
  color: C.dim,
  cursor: 'pointer',
  fontFamily: F.body,
  fontSize: 12,
};
