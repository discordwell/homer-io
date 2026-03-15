import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { C, F } from '../../theme.js';

interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  httpStatus: number | null;
  responseBody: string | null;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
}

interface DeliveryListResponse {
  data: WebhookDelivery[];
  page: number;
  totalPages: number;
  total: number;
}

interface WebhookDeliveryLogProps {
  endpointId: string;
  onClose: () => void;
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

const statusColors: Record<string, string> = {
  pending: 'yellow',
  success: 'green',
  failed: 'red',
};

export function WebhookDeliveryLog({ endpointId, onClose }: WebhookDeliveryLogProps) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchDeliveries(p: number) {
    setLoading(true);
    try {
      const result = await api.get<DeliveryListResponse>(
        `/webhooks/${endpointId}/deliveries?page=${p}&limit=15`,
      );
      setDeliveries(result.data);
      setPage(result.page);
      setTotalPages(result.totalPages);
    } catch {
      // silently fail — empty state will show
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeliveries(1);
  }, [endpointId]);

  function handlePageChange(newPage: number) {
    fetchDeliveries(newPage);
  }

  const columns: Column<WebhookDelivery>[] = [
    {
      key: 'createdAt', header: 'Time', width: 120,
      render: (d) => (
        <span style={{ color: C.dim, fontSize: 13, fontFamily: F.mono }}>{timeAgo(d.createdAt)}</span>
      ),
    },
    {
      key: 'event', header: 'Event',
      render: (d) => (
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.text }}>{d.event}</span>
      ),
    },
    {
      key: 'status', header: 'Status', width: 100,
      render: (d) => (
        <Badge color={statusColors[d.status] || 'dim'}>{d.status}</Badge>
      ),
    },
    {
      key: 'httpStatus', header: 'HTTP', width: 70,
      render: (d) => (
        <span style={{
          fontFamily: F.mono, fontSize: 13,
          color: d.httpStatus && d.httpStatus >= 200 && d.httpStatus < 300 ? C.green : d.httpStatus ? C.red : C.dim,
        }}>
          {d.httpStatus || '--'}
        </span>
      ),
    },
    {
      key: 'attempts', header: 'Attempts', width: 80,
      render: (d) => (
        <span style={{ color: C.dim, fontSize: 13 }}>{d.attempts}/5</span>
      ),
    },
    {
      key: 'responseBody', header: 'Response', width: 200,
      render: (d) => (
        <span style={{
          color: C.dim, fontSize: 12, fontFamily: F.mono,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'block', maxWidth: 200,
        }}>
          {d.responseBody || '--'}
        </span>
      ),
    },
    {
      key: 'expand', header: '', width: 40,
      render: (d) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpandedId(expandedId === d.id ? null : d.id);
          }}
          style={{
            background: 'none', border: 'none', color: C.accent,
            cursor: 'pointer', fontSize: 16, padding: '2px 4px',
            fontFamily: F.body, transform: expandedId === d.id ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          v
        </button>
      ),
    },
  ];

  if (loading && deliveries.length === 0) return <LoadingSpinner />;

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 20, marginTop: 16,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0, color: C.text }}>
          Delivery History
        </h3>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.dim,
          cursor: 'pointer', fontSize: 13, fontFamily: F.body,
          padding: '4px 8px',
        }}>
          Close
        </button>
      </div>

      <DataTable
        columns={columns}
        data={deliveries}
        pagination={totalPages > 1 ? { page, totalPages, onPageChange: handlePageChange } : undefined}
      />

      {/* Expanded row details */}
      {expandedId && (() => {
        const delivery = deliveries.find(d => d.id === expandedId);
        if (!delivery) return null;
        return (
          <div style={{
            background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
            padding: 16, marginTop: 12,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <span style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
                  Delivery ID
                </span>
                <span style={{ color: C.text, fontSize: 13, fontFamily: F.mono }}>{delivery.id}</span>
              </div>
              <div>
                <span style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>
                  Next Retry
                </span>
                <span style={{ color: C.text, fontSize: 13, fontFamily: F.mono }}>
                  {delivery.nextRetryAt ? timeAgo(delivery.nextRetryAt) : 'N/A'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                Payload
              </span>
              <pre style={{
                background: C.bg2, borderRadius: 6, padding: 12,
                border: `1px solid ${C.border}`, color: C.text,
                fontFamily: F.mono, fontSize: 12, margin: 0,
                overflow: 'auto', maxHeight: 200,
              }}>
                {JSON.stringify(delivery.payload, null, 2)}
              </pre>
            </div>

            {delivery.responseBody && (
              <div>
                <span style={{ color: C.dim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
                  Response Body
                </span>
                <pre style={{
                  background: C.bg2, borderRadius: 6, padding: 12,
                  border: `1px solid ${C.border}`,
                  color: delivery.status === 'success' ? C.green : C.red,
                  fontFamily: F.mono, fontSize: 12, margin: 0,
                  overflow: 'auto', maxHeight: 200,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {delivery.responseBody}
                </pre>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
