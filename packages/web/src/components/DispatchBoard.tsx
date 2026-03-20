import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { Badge } from './Badge.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { useToast } from './Toast.js';
import { C, F, alpha } from '../theme.js';

interface Order {
  id: string;
  recipientName: string;
  deliveryAddress: { street: string; city: string };
  priority: string;
  status: string;
  packageCount: number;
}

interface Driver {
  id: string;
  name: string;
  status: string;
}

interface Route {
  id: string;
  name: string;
  driverId: string | null;
  status: string;
  totalStops: number;
}

interface ColumnData {
  driver: Driver | null;
  route: Route | null;
  orders: Order[];
}

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

export function DispatchBoard() {
  const { toast } = useToast();
  const [unassigned, setUnassigned] = useState<Order[]>([]);
  const [driverColumns, setDriverColumns] = useState<ColumnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, driversRes, routesRes] = await Promise.all([
        api.get<{ items: Order[]; total: number }>('/orders?page=1&limit=200&status=received'),
        api.get<{ items: Driver[] }>('/fleet/drivers?page=1&limit=50'),
        api.get<{ items: Route[] }>('/routes?page=1&limit=50&status=draft'),
      ]);

      setUnassigned(ordersRes.items);

      // Build columns per driver
      const cols: ColumnData[] = driversRes.items
        .filter((d) => d.status !== 'offline')
        .map((driver) => {
          const driverRoute = routesRes.items.find((r) => r.driverId === driver.id) || null;
          return { driver, route: driverRoute, orders: [] };
        });

      // Fetch assigned orders per route
      for (const col of cols) {
        if (col.route) {
          try {
            const routeDetail = await api.get<{ orders?: Order[] }>(`/routes/${col.route.id}`);
            col.orders = routeDetail.orders || [];
          } catch {
            // skip
          }
        }
      }

      setDriverColumns(cols);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load dispatch data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleDragStart(order: Order) {
    setDraggedOrder(order);
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault();
    setDragOverColumn(columnId);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: React.DragEvent, column: ColumnData) {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedOrder || !column.driver) return;

    try {
      let routeId = column.route?.id;

      // Create a route if the driver doesn't have one
      if (!routeId) {
        const newRoute = await api.post<{ id: string }>('/routes', {
          name: `${column.driver.name} - ${new Date().toLocaleDateString()}`,
          driverId: column.driver.id,
          orderIds: [draggedOrder.id],
        });
        routeId = newRoute.id;
      } else {
        // Assign to existing route
        await api.post('/orders/batch/assign', {
          orderIds: [draggedOrder.id],
          routeId,
        });
      }

      toast(`Assigned "${draggedOrder.recipientName}" to ${column.driver.name}`, 'success');
      setDraggedOrder(null);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error');
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 16, WebkitOverflowScrolling: 'touch' }}>
      <div className="dispatch-board-columns" style={{ display: 'flex', gap: 16, minWidth: 'max-content' }}>
        {/* Unassigned column */}
        <div style={columnStyle}>
          <div style={columnHeaderStyle}>
            <h4 style={{ margin: 0, fontFamily: F.display, fontSize: 14, color: C.text }}>
              Unassigned
            </h4>
            <span style={{ fontSize: 12, color: C.dim }}>{unassigned.length}</span>
          </div>
          <div style={columnBodyStyle}>
            {unassigned.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: C.dim, fontSize: 13 }}>
                No unassigned orders
              </div>
            ) : (
              unassigned.map((order) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={() => handleDragStart(order)}
                  style={orderCardStyle}
                >
                  <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                    {order.recipientName}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
                    {order.deliveryAddress.street}, {order.deliveryAddress.city}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge color={priorityColors[order.priority]}>{order.priority}</Badge>
                    <span style={{ fontSize: 11, color: C.dim }}>{order.packageCount} pkg</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Driver columns */}
        {driverColumns.map((col) => {
          const colId = col.driver?.id || 'none';
          const isOver = dragOverColumn === colId;
          return (
            <div
              key={colId}
              style={{
                ...columnStyle,
                borderColor: isOver ? C.accent : C.border,
                background: isOver ? alpha(C.accent, 0.03) : C.bg2,
              }}
              onDragOver={(e) => handleDragOver(e, colId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col)}
            >
              <div style={columnHeaderStyle}>
                <div>
                  <h4 style={{ margin: 0, fontFamily: F.display, fontSize: 14, color: C.text }}>
                    {col.driver?.name || 'Unknown'}
                  </h4>
                  <div style={{ fontSize: 11, color: C.dim }}>
                    {col.driver?.status || 'offline'}
                    {col.route && ` - ${col.route.name}`}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: C.dim }}>{col.orders.length}</span>
              </div>
              <div style={columnBodyStyle}>
                {col.orders.length === 0 ? (
                  <div style={{
                    padding: 24, textAlign: 'center', color: C.dim, fontSize: 12,
                    border: `2px dashed ${C.muted}`, borderRadius: 8, margin: 8,
                  }}>
                    Drop orders here
                  </div>
                ) : (
                  col.orders.map((order) => (
                    <div key={order.id} style={orderCardStyle}>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                        {order.recipientName}
                      </div>
                      <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
                        {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                      </div>
                      <Badge color={order.status === 'delivered' ? 'green' : order.status === 'failed' ? 'red' : 'blue'}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const columnStyle: React.CSSProperties = {
  flexShrink: 0,
  background: C.bg2, borderRadius: 12,
  border: `1px solid ${C.border}`,
  display: 'flex', flexDirection: 'column',
  transition: 'border-color 0.15s, background 0.15s',
};

const columnHeaderStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 14px', borderBottom: `1px solid ${C.border}`,
};

const columnBodyStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', maxHeight: 500,
  display: 'flex', flexDirection: 'column', gap: 6, padding: 8,
};

const orderCardStyle: React.CSSProperties = {
  padding: '10px 12px', background: C.bg3, borderRadius: 8,
  cursor: 'grab', border: `1px solid ${C.border}`,
  transition: 'transform 0.1s',
};
