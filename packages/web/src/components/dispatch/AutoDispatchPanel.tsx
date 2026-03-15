import { useState, useEffect } from 'react';
import { C, F } from '../../theme.js';
import { api } from '../../api/client.js';
import { DispatchPreview } from './DispatchPreview.js';

interface DispatchRoute {
  id: string;
  name: string;
  driverName: string;
  totalStops: number;
  estimatedDistance?: number;
  reasoning?: string;
  status: string;
}

interface DispatchResult {
  routes: DispatchRoute[];
  unassignedOrderIds: string[];
  totalOrders: number;
  totalDrivers: number;
  message?: string;
}

interface Stats {
  unassignedOrders: number;
  availableDrivers: number;
}

export function AutoDispatchPanel() {
  const [stats, setStats] = useState<Stats>({ unassignedOrders: 0, availableDrivers: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [maxOrdersPerRoute, setMaxOrdersPerRoute] = useState(50);
  const [prioritizeUrgent, setPrioritizeUrgent] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      // Fetch unassigned orders count and available drivers count
      const [ordersRes, driversRes] = await Promise.all([
        api.get<{ items: unknown[]; total: number }>('/orders?page=1&limit=1&status=received&unassigned=true'),
        api.get<{ items: unknown[]; total: number }>('/fleet/drivers?page=1&limit=1&status=available'),
      ]);
      setStats({
        unassignedOrders: ordersRes.total ?? 0,
        availableDrivers: driversRes.total ?? 0,
      });
    } catch {
      // Stats are informational — silently fall back
      setStats({ unassignedOrders: 0, availableDrivers: 0 });
    } finally {
      setLoadingStats(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post<DispatchResult>('/dispatch/auto-dispatch', {
        maxOrdersPerRoute,
        prioritizeUrgent,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-dispatch failed');
    } finally {
      setRunning(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
    fetchStats();
  }

  function handleConfirmed() {
    // Refresh stats after confirmation
    fetchStats();
  }

  // If we have results, show the preview
  if (result) {
    return (
      <DispatchPreview
        routes={result.routes}
        unassignedOrderIds={result.unassignedOrderIds}
        totalOrders={result.totalOrders}
        totalDrivers={result.totalDrivers}
        message={result.message}
        onConfirmed={handleConfirmed}
        onReset={handleReset}
      />
    );
  }

  return (
    <div style={panelStyle}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${C.accent}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
        }}>
          &#9881;
        </div>
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 16, color: C.text, margin: 0 }}>
            AI Auto-Dispatch
          </h3>
          <p style={{ color: C.dim, fontSize: 12, margin: '2px 0 0' }}>
            Automatically assign orders to drivers using AI
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: F.mono, color: C.text }}>
            {loadingStats ? '-' : stats.unassignedOrders}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Unassigned Orders</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: F.mono, color: C.text }}>
            {loadingStats ? '-' : stats.availableDrivers}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Available Drivers</div>
        </div>
      </div>

      {/* Config */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Max orders per route</label>
          <input
            type="number"
            min={1}
            max={200}
            value={maxOrdersPerRoute}
            onChange={(e) => setMaxOrdersPerRoute(Math.max(1, Math.min(200, parseInt(e.target.value) || 50)))}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={prioritizeUrgent}
              onChange={(e) => setPrioritizeUrgent(e.target.checked)}
              style={{ marginRight: 8, accentColor: C.accent }}
            />
            Prioritize urgent orders
          </label>
        </div>
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

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || loadingStats || stats.unassignedOrders === 0 || stats.availableDrivers === 0}
        style={{
          ...runBtnStyle,
          opacity: running || loadingStats || stats.unassignedOrders === 0 || stats.availableDrivers === 0 ? 0.5 : 1,
          cursor: running || loadingStats || stats.unassignedOrders === 0 || stats.availableDrivers === 0
            ? 'not-allowed' : 'pointer',
        }}
      >
        {running ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={spinnerStyle} />
            Running AI Dispatch...
          </span>
        ) : (
          'Run Auto-Dispatch'
        )}
      </button>

      {/* Info when disabled */}
      {!loadingStats && (stats.unassignedOrders === 0 || stats.availableDrivers === 0) && (
        <p style={{ color: C.dim, fontSize: 12, marginTop: 10, textAlign: 'center' }}>
          {stats.unassignedOrders === 0 && stats.availableDrivers === 0
            ? 'No unassigned orders or available drivers.'
            : stats.unassignedOrders === 0
              ? 'No unassigned orders to dispatch.'
              : 'No available drivers to assign.'}
        </p>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: C.bg2,
  border: `1px solid ${C.muted}`,
  borderRadius: 12,
  padding: 20,
};

const statCardStyle: React.CSSProperties = {
  flex: 1,
  background: C.bg3,
  borderRadius: 8,
  padding: '12px 14px',
  textAlign: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: C.dim,
  marginBottom: 6,
  fontFamily: F.body,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${C.muted}`,
  background: C.bg3,
  color: C.text,
  fontSize: 14,
  fontFamily: F.mono,
  outline: 'none',
  boxSizing: 'border-box',
};

const runBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 20px',
  borderRadius: 8,
  background: C.accent,
  border: 'none',
  color: '#fff',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
  boxShadow: C.accentGlow,
};

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 14,
  height: 14,
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
