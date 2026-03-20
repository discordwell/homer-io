import { useNavigate } from 'react-router-dom';
import { KPICard } from '../components/KPICard.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { C, F } from '../theme.js';
import { DEMO_DASHBOARD_STATS, type DemoRecentOrder } from '../data/demo-data.js';

const statusColors: Record<string, string> = {
  received: 'blue', assigned: 'purple', in_transit: 'yellow', delivered: 'green', failed: 'red', returned: 'orange',
};

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

export function DemoDashboardPage() {
  const navigate = useNavigate();
  const stats = DEMO_DASHBOARD_STATS;

  const recentOrderColumns: Column<DemoRecentOrder>[] = [
    { key: 'recipientName', header: 'Recipient' },
    { key: 'packageCount', header: 'Pkgs', width: 60 },
    { key: 'priority', header: 'Priority', render: (o) => <Badge color={priorityColors[o.priority]}>{o.priority}</Badge> },
    { key: 'status', header: 'Status', render: (o) => <Badge color={statusColors[o.status]}>{o.status.replace('_', ' ')}</Badge> },
    { key: 'createdAt', header: 'Created', render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>
        Welcome to HOMER
      </h2>
      <p style={{ color: C.dim, marginBottom: 32 }}>Explore the logistics command center with sample data</p>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <KPICard icon="&#x1F5FA;&#xFE0F;" label="Active Routes" value={stats.activeRoutes} color={C.accent} />
        <KPICard icon="&#x1F4E6;" label="Orders Today" value={stats.ordersToday} color={C.green} />
        <KPICard icon="&#x1F464;" label="Active Drivers" value={stats.activeDrivers} color={C.yellow} />
        <KPICard icon="&#x2705;" label="Delivery Rate" value={`${stats.deliveryRate}%`} color={C.purple}
          sub={`${stats.totalVehicles} vehicles in fleet`} />
      </div>

      {/* Recent orders */}
      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0 }}>Recent Orders</h3>
          <button onClick={() => navigate('/demo/orders')} style={{
            background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
            fontSize: 13, fontFamily: F.body,
          }}>View all &rarr;</button>
        </div>
        <DataTable columns={recentOrderColumns} data={stats.recentOrders} />
      </div>
    </div>
  );
}
