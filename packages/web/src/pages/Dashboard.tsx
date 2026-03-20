import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { useDashboard } from '../hooks/useDashboard.js';
import { KPICard } from '../components/KPICard.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { IntelligenceWidget } from '../components/IntelligenceWidget.js';
import { C, F, alpha } from '../theme.js';

const statusColors: Record<string, string> = {
  received: 'blue', assigned: 'purple', in_transit: 'yellow', delivered: 'green', failed: 'red', returned: 'orange',
};

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

interface RecentOrder {
  id: string;
  recipientName: string;
  status: string;
  priority: string;
  packageCount: number;
  createdAt: string;
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { stats, loading, error } = useDashboard();

  if (loading) return <LoadingSpinner />;

  const recentOrderColumns: Column<RecentOrder>[] = [
    { key: 'recipientName', header: 'Recipient' },
    { key: 'packageCount', header: 'Pkgs', width: 60 },
    { key: 'priority', header: 'Priority', render: (o) => <Badge color={priorityColors[o.priority]}>{o.priority}</Badge> },
    { key: 'status', header: 'Status', render: (o) => <Badge color={statusColors[o.status]}>{o.status.replace('_', ' ')}</Badge> },
    { key: 'createdAt', header: 'Created', render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  const hasData = stats && (stats.totalVehicles > 0 || stats.ordersToday > 0);

  return (
    <div>
      <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>
        Welcome back, {user?.name?.split(' ')[0]}
      </h2>
      <p style={{ color: C.dim, marginBottom: 32 }}>Your logistics command center</p>

      {error && (
        <div style={{
          background: alpha(C.red, 0.1), border: `1px solid ${C.red}`,
          color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>{error}</div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KPICard icon="🗺️" label="Active Routes" value={stats?.activeRoutes ?? 0} color={C.accent} />
        <KPICard icon="📦" label="Orders Today" value={stats?.ordersToday ?? 0} color={C.green} />
        <KPICard icon="👤" label="Active Drivers" value={stats?.activeDrivers ?? 0} color={C.yellow} />
        <KPICard icon="✅" label="Delivery Rate" value={stats?.deliveryRate != null ? `${stats.deliveryRate}%` : '—'} color={C.purple}
          sub={stats?.totalVehicles ? `${stats.totalVehicles} vehicles in fleet` : undefined} />
      </div>

      {/* Intelligence Widget */}
      <div style={{ marginBottom: 32 }}>
        <IntelligenceWidget />
      </div>

      {/* Recent orders or empty state */}
      {hasData ? (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0 }}>Recent Orders</h3>
            <button onClick={() => navigate('/dashboard/orders')} style={{
              background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
              fontSize: 13, fontFamily: F.body,
            }}>View all →</button>
          </div>
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <DataTable columns={recentOrderColumns} data={stats.recentOrders} />
          ) : (
            <p style={{ color: C.dim, fontSize: 14, textAlign: 'center', padding: 24 }}>No recent orders</p>
          )}
        </div>
      ) : (
        <div style={{
          padding: 40, background: C.bg2, borderRadius: 12,
          border: `1px solid ${C.muted}`, textAlign: 'center',
        }}>
          <p style={{ fontSize: 16, marginBottom: 8, color: C.text }}>
            Get started with HOMER.io
          </p>
          <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>
            Set up your fleet, import orders, and create optimized routes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard/fleet/vehicles')} style={ctaBtnStyle}>
              🚛 Add Vehicle
            </button>
            <button onClick={() => navigate('/dashboard/orders')} style={ctaBtnStyle}>
              📦 Import Orders
            </button>
            <button onClick={() => navigate('/dashboard/routes/new')} style={ctaBtnStyle}>
              🗺️ Create Route
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ctaBtnStyle: React.CSSProperties = {
  padding: '12px 24px', borderRadius: 10, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.text, cursor: 'pointer',
  fontFamily: F.body, fontSize: 14, fontWeight: 500,
};
