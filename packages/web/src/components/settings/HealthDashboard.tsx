import { useCallback, useState } from 'react';
import { api } from '../../api/client.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { usePollingWithBackoff } from '../../hooks/usePollingWithBackoff.js';
import { C, F } from '../../theme.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  database: { latencyMs: number; status: string };
  redis: { latencyMs: number; status: string };
  queues: Record<string, number>;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  uptime: number;
  version: string;
  timestamp: string;
}

const statusColor: Record<string, string> = {
  healthy: C.green,
  degraded: C.yellow,
  down: C.red,
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function HealthDashboard() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const data = await api.get<HealthStatus>('/admin/health');
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health status');
      // Rethrow so the polling hook backs off on consecutive failures.
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll with exponential backoff on error (30s → 60s → 120s → 240s → 300s cap).
  usePollingWithBackoff(fetchHealth);

  if (loading && !health) return <LoadingSpinner />;

  if (error && !health) {
    return (
      <div style={{ color: C.red, fontSize: 14, padding: 32, textAlign: 'center' }}>
        {error}
      </div>
    );
  }

  if (!health) return null;

  const overallColor = statusColor[health.status] || C.dim;
  const queueEntries = Object.entries(health.queues);
  const totalQueueDepth = queueEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div>
      {/* Overall Status */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: overallColor,
              boxShadow: `0 0 8px ${overallColor}60`,
            }} />
            <h3 style={{ fontFamily: F.display, fontSize: 20, color: C.text, margin: 0 }}>
              System {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
            </h3>
          </div>
          <span style={{ color: C.dim, fontSize: 12, fontFamily: F.mono }}>
            v{health.version}
          </span>
        </div>

        {/* Service Cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatusCard
            label="Database"
            status={health.database.status}
            detail={`${health.database.latencyMs >= 0 ? health.database.latencyMs + 'ms' : 'N/A'}`}
          />
          <StatusCard
            label="Redis"
            status={health.redis.status}
            detail={`${health.redis.latencyMs >= 0 ? health.redis.latencyMs + 'ms' : 'N/A'}`}
          />
          <StatusCard
            label="Memory"
            status="healthy"
            detail={`${health.memory.heapUsed}/${health.memory.heapTotal} MB`}
          />
          <StatusCard
            label="Uptime"
            status="healthy"
            detail={formatUptime(health.uptime)}
          />
          <StatusCard
            label="Queues"
            status={totalQueueDepth > 100 ? 'degraded' : 'healthy'}
            detail={`${totalQueueDepth} pending`}
          />
          <StatusCard
            label="Version"
            status="healthy"
            detail={health.version}
          />
        </div>
      </div>

      {/* Queue Depths */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: '0 0 16px' }}>
          Queue Depths
        </h3>

        {queueEntries.length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14 }}>No queue data available.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {queueEntries.map(([name, depth]) => (
              <div key={name} style={{
                background: C.bg3,
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{
                  color: C.dim,
                  fontSize: 12,
                  fontFamily: F.mono,
                  textTransform: 'none',
                }}>
                  {name}
                </span>
                <span style={{
                  fontFamily: F.display,
                  fontSize: 18,
                  fontWeight: 700,
                  color: depth > 50 ? C.yellow : depth > 100 ? C.red : C.text,
                }}>
                  {depth}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, color: C.dim, fontSize: 12 }}>
          Last updated: {new Date(health.timestamp).toLocaleTimeString()} (auto-refreshes every 30s)
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, status, detail }: { label: string; status: string; detail: string }) {
  const color = statusColor[status] || C.dim;
  return (
    <div style={{
      flex: '1 1 140px',
      background: C.bg3,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{
        color: C.dim, fontSize: 12, fontFamily: F.body, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}60`,
        }} />
        <span style={{ fontFamily: F.display, fontSize: 18, color: C.text, fontWeight: 700 }}>
          {detail}
        </span>
      </div>
    </div>
  );
}
