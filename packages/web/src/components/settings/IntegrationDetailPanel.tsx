import { useState, useEffect } from 'react';
import { Modal } from '../Modal.js';
import { Badge } from '../Badge.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { useToast } from '../Toast.js';
import { useIntegrationsStore } from '../../stores/integrations.js';
import { C, F, alpha, primaryBtnStyle } from '../../theme.js';
import type { ConnectionResponse, IntegrationOrderResponse } from '@homer-io/shared';

interface IntegrationDetailPanelProps {
  open: boolean;
  onClose: () => void;
  connection: ConnectionResponse | null;
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

function syncStatusColor(status: string): string {
  switch (status) {
    case 'syncing': return C.green;
    case 'idle': return C.yellow;
    case 'error': return C.red;
    default: return C.dim;
  }
}

function syncStatusLabel(status: string): string {
  switch (status) {
    case 'syncing': return 'Syncing';
    case 'idle': return 'Idle';
    case 'error': return 'Error';
    default: return status;
  }
}

export function IntegrationDetailPanel({ open, onClose, connection }: IntegrationDetailPanelProps) {
  const { toast } = useToast();
  const { syncConnection, updateConnection, loadOrders } = useIntegrationsStore();

  const [syncing, setSyncing] = useState(false);
  const [orders, setOrders] = useState<IntegrationOrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [autoImport, setAutoImport] = useState(connection?.autoImport ?? true);

  // Sync `autoImport` from connection prop on connection.id change —
  // adjust state during render.
  const connectionId = connection?.id ?? null;
  const [seenConnId, setSeenConnId] = useState<string | null>(connectionId);
  if (seenConnId !== connectionId) {
    setSeenConnId(connectionId);
    if (connection) {
      setAutoImport(connection.autoImport);
      setOrdersLoading(true);
    }
  }

  useEffect(() => {
    if (!connection) return;
    void fetchOrders(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  // Caller is responsible for setting ordersLoading=true when needed; this
  // keeps the effect free of synchronous setState.
  async function fetchOrders(page: number) {
    if (!connection) return;
    try {
      const result = await loadOrders(connection.id, page, 10);
      setOrders(result.data);
      setOrdersPagination(result.pagination);
    } catch {
      // empty
    } finally {
      setOrdersLoading(false);
    }
  }

  async function handleSync() {
    if (!connection) return;
    setSyncing(true);
    try {
      const result = await syncConnection(connection.id);
      toast(`Synced: ${result.imported} imported, ${result.skipped} skipped, ${result.failed} failed`, 'success');
      setOrdersLoading(true);
      await fetchOrders(1);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleAutoImport() {
    if (!connection) return;
    const newValue = !autoImport;
    setAutoImport(newValue);
    try {
      await updateConnection(connection.id, { autoImport: newValue });
      toast(`Auto-import ${newValue ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      setAutoImport(!newValue);
      toast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  }

  if (!connection) return null;

  const statusColor = syncStatusColor(connection.syncStatus);

  return (
    <Modal open={open} onClose={onClose} title={`${connection.platform === 'shopify' ? 'Shopify' : 'WooCommerce'} Integration`} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Health & Status */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
        }}>
          <div style={statCardStyle}>
            <span style={statLabelStyle}>Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: statusColor,
                boxShadow: `0 0 6px ${alpha(statusColor, 0.38)}`,
              }} />
              <span style={{ color: statusColor, fontWeight: 600, fontSize: 15, fontFamily: F.body }}>
                {syncStatusLabel(connection.syncStatus)}
              </span>
            </div>
          </div>

          <div style={statCardStyle}>
            <span style={statLabelStyle}>Orders Imported</span>
            <span style={{ color: C.text, fontSize: 22, fontWeight: 700, fontFamily: F.display }}>
              {connection.orderCount}
            </span>
          </div>

          <div style={statCardStyle}>
            <span style={statLabelStyle}>Last Sync</span>
            <span style={{ color: C.text, fontSize: 15, fontFamily: F.body }}>
              {connection.lastSyncAt ? timeAgo(connection.lastSyncAt) : 'Never'}
            </span>
          </div>
        </div>

        {/* Error display */}
        {connection.lastSyncError && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 13, fontFamily: F.mono,
            background: alpha(C.red, 0.07), color: C.red, border: `1px solid ${alpha(C.red, 0.19)}`,
            wordBreak: 'break-word',
          }}>
            {connection.lastSyncError}
          </div>
        )}

        {/* Store info */}
        <div style={{
          padding: '12px 16px', borderRadius: 8, background: C.bg3,
          border: `1px solid ${C.border}`,
        }}>
          <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body }}>Store URL</span>
          <div style={{ color: C.text, fontSize: 14, fontFamily: F.mono, marginTop: 4 }}>
            {connection.storeUrl}
          </div>
        </div>

        {/* Sync controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleToggleAutoImport}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: autoImport ? C.accent : C.muted,
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: autoImport ? 21 : 3, transition: 'left 0.2s',
              }} />
            </button>
            <span style={{ color: C.text, fontSize: 14, fontFamily: F.body }}>
              Auto-import new orders
            </span>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ ...primaryBtnStyle, opacity: syncing ? 0.5 : 1 }}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Recent imported orders */}
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 15, color: C.text, margin: '0 0 12px' }}>
            Recent Imported Orders
          </h3>

          {ordersLoading ? (
            <LoadingSpinner size={24} />
          ) : orders.length === 0 ? (
            <div style={{ color: C.dim, fontSize: 14, fontFamily: F.body, textAlign: 'center', padding: 20 }}>
              No imported orders yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 8, background: C.bg3,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div>
                    <span style={{ color: C.text, fontFamily: F.mono, fontSize: 13 }}>
                      {order.externalOrderId}
                    </span>
                    <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body, marginLeft: 12 }}>
                      {timeAgo(order.createdAt)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {order.syncError && (
                      <span style={{ color: C.red, fontSize: 11, fontFamily: F.body, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.syncError}
                      </span>
                    )}
                    <Badge color={
                      order.syncStatus === 'synced' ? 'green' :
                      order.syncStatus === 'failed' ? 'red' :
                      order.syncStatus === 'skipped' ? 'dim' : 'yellow'
                    }>
                      {order.syncStatus}
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {ordersPagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => { setOrdersLoading(true); void fetchOrders(ordersPagination.page - 1); }}
                    disabled={ordersPagination.page <= 1}
                    style={{ ...paginationBtnStyle, opacity: ordersPagination.page <= 1 ? 0.3 : 1 }}
                  >
                    Prev
                  </button>
                  <span style={{ color: C.dim, fontSize: 13, fontFamily: F.body, padding: '4px 8px' }}>
                    {ordersPagination.page} / {ordersPagination.totalPages}
                  </span>
                  <button
                    onClick={() => { setOrdersLoading(true); void fetchOrders(ordersPagination.page + 1); }}
                    disabled={ordersPagination.page >= ordersPagination.totalPages}
                    style={{ ...paginationBtnStyle, opacity: ordersPagination.page >= ordersPagination.totalPages ? 0.3 : 1 }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{ color: C.dim, fontSize: 12, fontFamily: F.body, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          Connected {timeAgo(connection.createdAt)} | {ordersPagination.total} total imported orders
        </div>
      </div>
    </Modal>
  );
}

const statCardStyle: React.CSSProperties = {
  padding: '14px 16px', borderRadius: 10, background: C.bg3,
  border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6,
};

const statLabelStyle: React.CSSProperties = {
  color: C.dim, fontSize: 12, fontFamily: F.body, textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const paginationBtnStyle: React.CSSProperties = {
  background: 'none', border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer',
  fontSize: 12, fontFamily: F.body, padding: '4px 12px', borderRadius: 6,
};
