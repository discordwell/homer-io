import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';
import { DEMO_ROUTES, type DemoRoute } from '../data/demo-data.js';

const statusColors: Record<string, string> = {
  draft: 'dim', planned: 'blue', in_progress: 'yellow', completed: 'green', cancelled: 'red',
};

export function DemoRoutesPage() {
  const { toast } = useToast();

  const columns: Column<DemoRoute>[] = [
    { key: 'name', header: 'Route Name' },
    { key: 'status', header: 'Status', render: (r) => <Badge color={statusColors[r.status]}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'driverName', header: 'Driver', render: (r) => r.driverName || <span style={{ color: C.dim }}>Unassigned</span> },
    { key: 'vehicleName', header: 'Vehicle', render: (r) => r.vehicleName || <span style={{ color: C.dim }}>-</span> },
    {
      key: 'totalStops', header: 'Progress',
      render: (r) => (
        <span>
          {r.completedStops}/{r.totalStops} stops
          {r.totalStops > 0 && (
            <span style={{ color: C.dim, marginLeft: 6, fontSize: 12 }}>
              ({Math.round((r.completedStops / r.totalStops) * 100)}%)
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'totalDistance', header: 'Distance',
      render: (r) => r.totalDistance ? `${r.totalDistance} mi` : <span style={{ color: C.dim }}>-</span>,
    },
    { key: 'plannedStartAt', header: 'Planned Start', render: (r) => new Date(r.plannedStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  ];

  const handleDemoAction = () => {
    toast('This action is disabled in demo mode. Sign up to get started!', 'info');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, margin: 0 }}>Routes</h2>
        <button onClick={handleDemoAction} style={{
          padding: '10px 20px', borderRadius: 8, background: C.accent,
          border: 'none', color: '#000', cursor: 'pointer',
          fontFamily: F.body, fontWeight: 600, fontSize: 14,
        }}>
          + New Route
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={DEMO_ROUTES} />
        <div style={{ padding: 12, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          Showing {DEMO_ROUTES.length} sample routes
        </div>
      </div>
    </div>
  );
}
