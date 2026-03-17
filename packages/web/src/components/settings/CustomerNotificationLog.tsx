import { useEffect } from 'react';
import { useCustomerNotificationsStore } from '../../stores/customer-notifications.js';
import { DataTable, type Column } from '../DataTable.js';
import { Badge } from '../Badge.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { C, F } from '../../theme.js';
import type { NotificationLogEntry } from '../../stores/customer-notifications.js';

const statusColors: Record<string, string> = {
  queued: 'yellow',
  sent: 'green',
  delivered: 'green',
  failed: 'red',
};

const triggerLabels: Record<string, string> = {
  order_assigned: 'Order Assigned',
  driver_en_route: 'Driver En Route',
  delivery_approaching: 'Approaching',
  delivered: 'Delivered',
  failed: 'Failed',
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  onBack?: () => void;
}

export function CustomerNotificationLog({ onBack }: Props) {
  const { log, logPagination, logLoading, fetchLog } = useCustomerNotificationsStore();

  useEffect(() => {
    fetchLog(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: Column<NotificationLogEntry>[] = [
    {
      key: 'createdAt', header: 'Time',
      render: (entry) => (
        <span style={{ color: C.dim, fontSize: 13, whiteSpace: 'nowrap' }}>
          {formatTime(entry.createdAt)}
        </span>
      ),
    },
    {
      key: 'orderId', header: 'Order',
      render: (entry) => (
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.text }}>
          {entry.orderId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'channel', header: 'Channel',
      render: (entry) => (
        <span style={{ color: C.text, fontSize: 13, textTransform: 'uppercase', fontWeight: 600 }}>
          {entry.channel}
        </span>
      ),
    },
    {
      key: 'trigger', header: 'Trigger',
      render: (entry) => (
        <span style={{ color: C.dim, fontSize: 13 }}>
          {triggerLabels[entry.trigger] || entry.trigger}
        </span>
      ),
    },
    {
      key: 'recipient', header: 'Recipient',
      render: (entry) => (
        <span style={{ color: C.text, fontSize: 13 }}>
          {entry.recipient}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (entry) => (
        <Badge color={statusColors[entry.status] || 'dim'}>
          {entry.status}
        </Badge>
      ),
    },
    {
      key: 'providerId', header: 'Provider ID',
      render: (entry) => (
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dim }}>
          {entry.providerId || '-'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={backBtnStyle}>
            &larr; Back
          </button>
        )}
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 18, margin: 0, color: C.text }}>
            Customer Notification Log
          </h3>
          <p style={{ color: C.dim, fontSize: 13, margin: '4px 0 0' }}>
            {logPagination.total} notification{logPagination.total !== 1 ? 's' : ''} sent
          </p>
        </div>
      </div>

      {logLoading && log.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <DataTable
            columns={columns}
            data={log}
            pagination={{
              page: logPagination.page,
              totalPages: logPagination.totalPages,
              onPageChange: (page) => fetchLog(page),
            }}
          />
        </div>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: C.bg3, border: `1px solid ${C.muted}`, color: C.dim,
  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
  fontSize: 14, fontFamily: F.body,
};
