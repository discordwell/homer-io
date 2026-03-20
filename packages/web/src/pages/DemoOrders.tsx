import { useState } from 'react';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { useToast } from '../components/Toast.js';
import { C, F } from '../theme.js';
import { DEMO_ORDERS, type DemoOrder } from '../data/demo-data.js';

const statusColors: Record<string, string> = {
  received: 'blue', assigned: 'purple', in_transit: 'yellow', delivered: 'green', failed: 'red', returned: 'orange',
};

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

export function DemoOrdersPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');

  const filteredOrders = statusFilter
    ? DEMO_ORDERS.filter(o => o.status === statusFilter)
    : DEMO_ORDERS;

  const columns: Column<DemoOrder>[] = [
    { key: 'externalId', header: 'Order ID', width: 100 },
    { key: 'recipientName', header: 'Recipient' },
    {
      key: 'deliveryAddress', header: 'Address',
      render: (o) => `${o.deliveryAddress.street}, ${o.deliveryAddress.city}`,
    },
    { key: 'packageCount', header: 'Pkgs', width: 60 },
    { key: 'priority', header: 'Priority', render: (o) => <Badge color={priorityColors[o.priority]}>{o.priority}</Badge> },
    { key: 'status', header: 'Status', render: (o) => <Badge color={statusColors[o.status]}>{o.status.replace('_', ' ')}</Badge> },
    { key: 'createdAt', header: 'Created', render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  const handleDemoAction = () => {
    toast('This action is disabled in demo mode. Sign up to get started!', 'info');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, margin: 0 }}>Orders</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDemoAction} style={{
            padding: '10px 20px', borderRadius: 8, background: C.bg3,
            border: `1px solid ${C.muted}`, color: C.dim, cursor: 'pointer',
            fontFamily: F.body, fontSize: 14,
          }}>
            Import CSV
          </button>
          <button onClick={handleDemoAction} style={{
            padding: '10px 20px', borderRadius: 8, background: C.accent,
            border: 'none', color: '#000', cursor: 'pointer',
            fontFamily: F.body, fontWeight: 600, fontSize: 14,
          }}>
            + New Order
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'received', 'assigned', 'in_transit', 'delivered', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13,
              fontFamily: F.body, cursor: 'pointer',
              background: statusFilter === status ? C.accent : C.bg3,
              color: statusFilter === status ? '#000' : C.dim,
              border: statusFilter === status ? 'none' : `1px solid ${C.muted}`,
              fontWeight: statusFilter === status ? 600 : 400,
            }}
          >
            {status === '' ? 'All' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
        <DataTable columns={columns} data={filteredOrders} />
        <div style={{ padding: 12, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          Showing {filteredOrders.length} of {DEMO_ORDERS.length} sample orders
        </div>
      </div>
    </div>
  );
}
