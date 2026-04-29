import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { WebhookEndpointForm } from './WebhookEndpointForm.js';
import { WebhookDeliveryLog } from './WebhookDeliveryLog.js';
import { C, F, alpha, primaryBtnStyle } from '../../theme.js';

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  description: string | null;
  failureCount: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function healthColor(failureCount: number): string {
  if (failureCount === 0) return C.green;
  if (failureCount < 5) return C.yellow;
  return C.red;
}

function healthLabel(failureCount: number): string {
  if (failureCount === 0) return 'Healthy';
  if (failureCount < 5) return 'Degraded';
  return 'Failing';
}

export function WebhooksTab() {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deliveryLogEndpointId, setDeliveryLogEndpointId] = useState<string | null>(null);

  async function fetchEndpoints() {
    try {
      const data = await api.get<WebhookEndpoint[]>('/webhooks');
      setEndpoints(data);
    } catch {
      // empty state will show
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchEndpoints();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(data: { url: string; events: string[]; description?: string; isActive?: boolean }) {
    const result = await api.post<WebhookEndpoint>('/webhooks', data);
    await fetchEndpoints();
    return result;
  }

  async function handleUpdate(data: { url: string; events: string[]; description?: string; isActive?: boolean }) {
    if (!editEndpoint) throw new Error('No endpoint to update');
    const result = await api.put<WebhookEndpoint>(`/webhooks/${editEndpoint.id}`, data);
    await fetchEndpoints();
    setEditEndpoint(null);
    return result;
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/webhooks/${deleteId}`);
      toast('Webhook endpoint deleted', 'success');
      await fetchEndpoints();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
    setDeleteId(null);
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      await api.post(`/webhooks/${id}/test`);
      toast('Test webhook sent', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send test', 'error');
    }
    setTestingId(null);
  }

  const columns: Column<WebhookEndpoint>[] = [
    {
      key: 'health', header: '', width: 36,
      render: (ep) => (
        <div
          title={healthLabel(ep.failureCount)}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: ep.isActive ? healthColor(ep.failureCount) : C.dim,
            boxShadow: ep.isActive && ep.failureCount === 0
              ? `0 0 6px ${alpha(C.green, 0.38)}`
              : undefined,
          }}
        />
      ),
    },
    {
      key: 'url', header: 'URL',
      render: (ep) => (
        <div>
          <span style={{ fontFamily: F.mono, fontSize: 13, color: C.text, wordBreak: 'break-all' }}>
            {ep.url}
          </span>
          {ep.description && (
            <span style={{ display: 'block', color: C.dim, fontSize: 12, marginTop: 2 }}>
              {ep.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'events', header: 'Events', width: 180,
      render: (ep) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ep.events.slice(0, 2).map(e => (
            <Badge key={e} color="blue">{e.split('.').pop()}</Badge>
          ))}
          {ep.events.length > 2 && (
            <Badge color="dim">+{ep.events.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'isActive', header: 'Status', width: 90,
      render: (ep) => (
        <Badge color={ep.isActive ? 'green' : 'dim'}>
          {ep.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'failureCount', header: 'Health', width: 90,
      render: (ep) => {
        const color = healthColor(ep.failureCount);
        return (
          <span style={{ color, fontSize: 13, fontWeight: 600 }}>
            {healthLabel(ep.failureCount)}
          </span>
        );
      },
    },
    {
      key: 'lastSuccessAt', header: 'Last Success', width: 110,
      render: (ep) => (
        <span style={{ color: C.dim, fontSize: 13 }}>
          {ep.lastSuccessAt ? timeAgo(ep.lastSuccessAt) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', width: 200,
      render: (ep) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setDeliveryLogEndpointId(ep.id); }}
            style={actionBtnStyle}
          >
            Log
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(ep.id); }}
            disabled={testingId === ep.id}
            style={{ ...actionBtnStyle, opacity: testingId === ep.id ? 0.5 : 1 }}
          >
            {testingId === ep.id ? 'Sending...' : 'Test'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditEndpoint(ep); setFormOpen(true); }}
            style={actionBtnStyle}
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteId(ep.id); }}
            style={{ ...actionBtnStyle, color: C.red }}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  if (loading && endpoints.length === 0) return <LoadingSpinner />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: C.dim, fontSize: 14 }}>
          {endpoints.length} webhook endpoint{endpoints.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => { setEditEndpoint(null); setFormOpen(true); }}
          style={primaryBtnStyle}
        >
          + Add Endpoint
        </button>
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={endpoints} />
      </div>

      {/* Delivery Log */}
      {deliveryLogEndpointId && (
        <WebhookDeliveryLog
          endpointId={deliveryLogEndpointId}
          onClose={() => setDeliveryLogEndpointId(null)}
        />
      )}

      {/* Create/Edit Form */}
      <WebhookEndpointForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEndpoint(null); }}
        onSave={editEndpoint ? handleUpdate : handleCreate}
        endpoint={editEndpoint}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Webhook Endpoint"
        message="Are you sure you want to delete this webhook endpoint? All delivery history will also be removed. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
  fontSize: 13, fontFamily: F.body, padding: '2px 4px',
};
