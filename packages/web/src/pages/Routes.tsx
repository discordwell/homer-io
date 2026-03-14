import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoutesStore } from '../stores/routes.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { Pill } from '../components/Pill.js';
import { Bar } from '../components/Bar.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';

const statusColors: Record<string, string> = {
  draft: 'dim', planned: 'blue', in_progress: 'yellow', completed: 'green', cancelled: 'red',
};

export function RoutesPage() {
  const { routes, page, totalPages, loading, statusFilter, fetchRoutes, deleteRoute, setStatusFilter } = useRoutesStore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchRoutes(); }, [statusFilter]);

  const columns: Column<typeof routes[0]>[] = [
    { key: 'name', header: 'Route Name' },
    { key: 'status', header: 'Status', render: (r) => <Badge color={statusColors[r.status]}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'totalStops', header: 'Stops', width: 70 },
    {
      key: 'progress', header: 'Progress', width: 150,
      render: (r) => {
        const pct = r.totalStops > 0 ? (r.completedStops / r.totalStops) * 100 : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bar val={pct} color={pct === 100 ? C.green : C.accent} />
            <span style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }}>{r.completedStops}/{r.totalStops}</span>
          </div>
        );
      },
    },
    {
      key: 'createdAt', header: 'Created', width: 100,
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions', header: '', width: 50,
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
          style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 13, fontFamily: F.body }}>Del</button>
      ),
    },
  ];

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteRoute(deleteId);
      toast('Route deleted', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    }
    setDeleteId(null);
  }

  if (loading && routes.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Routes</h2>
          <p style={{ color: C.dim, fontSize: 14 }}>Plan and manage delivery routes</p>
        </div>
        <button onClick={() => navigate('/dashboard/routes/new')} style={primaryBtnStyle}>+ Create Route</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <Pill active={!statusFilter} onClick={() => setStatusFilter('')}>All</Pill>
        {['draft', 'planned', 'in_progress', 'completed', 'cancelled'].map(s => (
          <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}>
            {s.replace('_', ' ')}
          </Pill>
        ))}
      </div>

      {routes.length === 0 ? (
        <EmptyState icon="🗺️" title="No routes yet" description="Create your first delivery route."
          action={<button onClick={() => navigate('/dashboard/routes/new')} style={primaryBtnStyle}>+ Create Route</button>} />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <DataTable columns={columns} data={routes}
            onRowClick={(r) => navigate(`/dashboard/routes/${r.id}`)}
            pagination={{ page, totalPages, onPageChange: fetchRoutes }} />
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        title="Delete Route" message="Are you sure? Orders will be unassigned." />
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body, fontWeight: 600, fontSize: 14,
};
