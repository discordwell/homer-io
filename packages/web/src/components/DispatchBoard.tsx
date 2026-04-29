import { useEffect, useState, useCallback, useRef, memo } from 'react';
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

/** Stable column id used for kanban navigation (both drag + keyboard). */
export const UNASSIGNED_COL_ID = '__unassigned__';

/**
 * Pure keyboard reducer for the kanban pick-up / move / drop pattern.
 * Given the current picked-up order and focused column plus a key event,
 * returns the next state and any side-effect hint. Exported so that behavior
 * can be pinned by unit tests without a DOM test env.
 */
export type KanbanKbdState = {
  pickedUpOrderId: string | null;
  focusedColId: string | null;
};
export type KanbanKbdEffect =
  | { kind: 'none' }
  | { kind: 'pickup'; orderId: string }
  | { kind: 'drop'; orderId: string; targetColId: string }
  | { kind: 'cancel' }
  | { kind: 'invalid-drop' };

// eslint-disable-next-line react-refresh/only-export-components -- pure reducer co-located with its consumer + test
export function kanbanKeyReducer(
  state: KanbanKbdState,
  key: string,
  ctx: {
    orderId: string;
    /** column ids in display order, including UNASSIGNED_COL_ID at index 0 */
    allColIds: string[];
    /** driver column ids only (valid drop targets) */
    driverColIds: string[];
    /** whether the current order originates in the unassigned pool */
    isUnassigned: boolean;
  },
): { next: KanbanKbdState; effect: KanbanKbdEffect } {
  const { pickedUpOrderId, focusedColId } = state;
  const { orderId, allColIds, driverColIds, isUnassigned } = ctx;

  if (key === 'Enter' || key === ' ') {
    if (pickedUpOrderId === orderId) {
      // Attempt drop
      const target = focusedColId;
      if (target && target !== UNASSIGNED_COL_ID) {
        return {
          next: { pickedUpOrderId: null, focusedColId },
          effect: { kind: 'drop', orderId, targetColId: target },
        };
      }
      return {
        next: { pickedUpOrderId: null, focusedColId },
        effect: { kind: 'invalid-drop' },
      };
    }
    if (!pickedUpOrderId && isUnassigned) {
      const initialFocus = driverColIds[0] ?? UNASSIGNED_COL_ID;
      return {
        next: { pickedUpOrderId: orderId, focusedColId: initialFocus },
        effect: { kind: 'pickup', orderId },
      };
    }
    return { next: state, effect: { kind: 'none' } };
  }

  if (key === 'Escape' && pickedUpOrderId) {
    return { next: { pickedUpOrderId: null, focusedColId }, effect: { kind: 'cancel' } };
  }

  if ((key === 'ArrowRight' || key === 'ArrowLeft') && pickedUpOrderId) {
    const currentIdx = focusedColId ? allColIds.indexOf(focusedColId) : 0;
    const delta = key === 'ArrowRight' ? 1 : -1;
    const nextIdx = Math.min(allColIds.length - 1, Math.max(0, currentIdx + delta));
    const nextId = allColIds[nextIdx] ?? UNASSIGNED_COL_ID;
    return { next: { pickedUpOrderId, focusedColId: nextId }, effect: { kind: 'none' } };
  }

  return { next: state, effect: { kind: 'none' } };
}

type DispatchColumnProps = {
  colId: string;
  column: ColumnData | null; // null = unassigned column
  unassigned: Order[] | null; // non-null for the unassigned column only
  isOver: boolean;
  pickedUpOrderId: string | null;
  focusedColId: string | null;
  onDragStart: (order: Order) => void;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, colId: string) => void;
  onCardKeyDown: (e: React.KeyboardEvent, order: Order) => void;
  onCardFocus: (order: Order) => void;
};

/**
 * Memoized kanban column. Pure function of its props — columns whose data
 * didn't change will skip re-renders when sibling columns update.
 */
export const DispatchColumn = memo(function DispatchColumn({
  colId,
  column,
  unassigned,
  isOver,
  pickedUpOrderId,
  focusedColId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onCardKeyDown,
  onCardFocus,
}: DispatchColumnProps) {
  const isUnassigned = unassigned !== null;
  const orders = isUnassigned ? unassigned : column?.orders ?? [];
  const title = isUnassigned ? 'Unassigned' : column?.driver?.name ?? 'Unknown';
  const subtitle = isUnassigned
    ? undefined
    : `${column?.driver?.status ?? 'offline'}${column?.route ? ` - ${column.route.name}` : ''}`;
  const isKeyboardTarget = focusedColId === colId && pickedUpOrderId !== null;

  return (
    <div
      role="region"
      aria-label={isUnassigned ? 'Unassigned orders' : `Driver ${title} column`}
      data-column-id={colId}
      style={{
        ...columnStyle,
        borderColor: isOver || isKeyboardTarget ? C.accent : C.border,
        background: isOver || isKeyboardTarget ? alpha(C.accent, 0.03) : C.bg2,
      }}
      onDragOver={isUnassigned ? undefined : (e) => onDragOver(e, colId)}
      onDragLeave={isUnassigned ? undefined : onDragLeave}
      onDrop={isUnassigned ? undefined : (e) => onDrop(e, colId)}
    >
      <div style={columnHeaderStyle}>
        <div>
          <h4 style={{ margin: 0, fontFamily: F.display, fontSize: 14, color: C.text }}>
            {title}
          </h4>
          {subtitle && (
            <div style={{ fontSize: 11, color: C.dim }}>{subtitle}</div>
          )}
        </div>
        <span style={{ fontSize: 12, color: C.dim }}>{orders.length}</span>
      </div>
      <div style={columnBodyStyle}>
        {orders.length === 0 ? (
          isUnassigned ? (
            <div style={{ padding: 16, textAlign: 'center', color: C.dim, fontSize: 13 }}>
              No unassigned orders
            </div>
          ) : (
            <div style={{
              padding: 24, textAlign: 'center', color: C.dim, fontSize: 12,
              border: `2px dashed ${C.muted}`, borderRadius: 8, margin: 8,
            }}>
              Drop orders here
            </div>
          )
        ) : (
          orders.map((order) => {
            const isPicked = pickedUpOrderId === order.id;
            return (
              <div
                key={order.id}
                role="article"
                tabIndex={0}
                aria-label={`Order for ${order.recipientName}${isPicked ? ' (picked up; use arrow keys to move, Enter to drop, Escape to cancel)' : ''}`}
                aria-grabbed={isPicked}
                data-order-id={order.id}
                draggable={isUnassigned}
                onDragStart={isUnassigned ? () => onDragStart(order) : undefined}
                onKeyDown={(e) => onCardKeyDown(e, order)}
                onFocus={() => onCardFocus(order)}
                style={{
                  ...orderCardStyle,
                  outline: isPicked ? `2px solid ${C.accent}` : undefined,
                  boxShadow: isPicked ? `0 0 0 4px ${alpha(C.accent, 0.12)}` : undefined,
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                  {order.recipientName}
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
                  {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                </div>
                {isUnassigned ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge color={priorityColors[order.priority]}>{order.priority}</Badge>
                    <span style={{ fontSize: 11, color: C.dim }}>{order.packageCount} pkg</span>
                  </div>
                ) : (
                  <Badge color={order.status === 'delivered' ? 'green' : order.status === 'failed' ? 'red' : 'blue'}>
                    {order.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export function DispatchBoard() {
  const { toast } = useToast();
  const [unassigned, setUnassigned] = useState<Order[]>([]);
  const [driverColumns, setDriverColumns] = useState<ColumnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  // Keyboard-driven kanban state: "pick up" a card with Enter/Space, move
  // focus across columns with ArrowLeft/ArrowRight, drop with Enter.
  const [pickedUpOrder, setPickedUpOrder] = useState<Order | null>(null);
  const [focusedColId, setFocusedColId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string>('');
  const boardRef = useRef<HTMLDivElement>(null);

  // Caller is responsible for setting loading=true; the mount-time effect
  // relies on the initial state already being true.
  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchData();
    })();
    return () => { cancelled = true; };
  }, [fetchData]);

  const handleDragStart = useCallback((order: Order) => {
    setDraggedOrder(order);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const commitAssignment = useCallback(async (order: Order, targetColId: string) => {
    const targetCol = driverColumns.find((c) => c.driver?.id === targetColId);
    if (!targetCol || !targetCol.driver) return;

    try {
      let routeId = targetCol.route?.id;
      if (!routeId) {
        const newRoute = await api.post<{ id: string }>('/routes', {
          name: `${targetCol.driver.name} - ${new Date().toLocaleDateString()}`,
          driverId: targetCol.driver.id,
          orderIds: [order.id],
        });
        routeId = newRoute.id;
      } else {
        await api.post('/orders/batch/assign', {
          orderIds: [order.id],
          routeId,
        });
      }

      toast(`Assigned "${order.recipientName}" to ${targetCol.driver.name}`, 'success');
      setLoading(true);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Assignment failed', 'error');
    }
  }, [driverColumns, fetchData, toast]);

  const handleDrop = useCallback(async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedOrder) return;
    const order = draggedOrder;
    setDraggedOrder(null);
    await commitAssignment(order, colId);
  }, [draggedOrder, commitAssignment]);

  /**
   * Keyboard interaction for kanban:
   *   - Enter/Space on a focused card: pick it up (or drop it if already picked up).
   *   - ArrowRight / ArrowLeft (while picked up): move the "drop target" column.
   *   - Escape: cancel pickup.
   * We intentionally keep this minimal — full WAI-ARIA narration would need a
   * proper DnD library. See finding M9.
   */
  const allDriverColIds = driverColumns.map((c) => c.driver?.id || 'none');
  const allColIds = [UNASSIGNED_COL_ID, ...allDriverColIds];

  const handleCardFocus = useCallback((order: Order) => {
    // Update focused column to the column that owns this card, but only when
    // nothing is currently picked up — during pickup the user explicitly
    // drives focusedColId with arrows.
    if (pickedUpOrder) return;
    const owningCol = driverColumns.find((c) => c.orders.some((o) => o.id === order.id));
    setFocusedColId(owningCol?.driver?.id ?? UNASSIGNED_COL_ID);
  }, [pickedUpOrder, driverColumns]);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, order: Order) => {
    const handled = ['Enter', ' ', 'Escape', 'ArrowRight', 'ArrowLeft'].includes(e.key);
    if (!handled) return;
    const isUnassigned = unassigned.some((o) => o.id === order.id);
    const { next, effect } = kanbanKeyReducer(
      { pickedUpOrderId: pickedUpOrder?.id ?? null, focusedColId },
      e.key,
      { orderId: order.id, allColIds, driverColIds: allDriverColIds, isUnassigned },
    );

    if (effect.kind !== 'none') e.preventDefault();

    // Apply state transitions
    if (next.pickedUpOrderId !== (pickedUpOrder?.id ?? null)) {
      setPickedUpOrder(next.pickedUpOrderId ? order : null);
    }
    if (next.focusedColId !== focusedColId) {
      setFocusedColId(next.focusedColId);
    }

    // Apply side effects
    switch (effect.kind) {
      case 'pickup':
        setLiveMessage(`Picked up ${order.recipientName}. Use arrow keys to choose a driver, Enter to drop, Escape to cancel.`);
        break;
      case 'drop':
        commitAssignment(order, effect.targetColId);
        setLiveMessage(`Dropped ${order.recipientName} on selected driver`);
        break;
      case 'cancel':
        setLiveMessage('Cancelled');
        break;
      case 'invalid-drop':
        setLiveMessage('Cannot drop on unassigned column; press Escape to cancel');
        break;
      default:
        break;
    }
  }, [pickedUpOrder, focusedColId, allDriverColIds, allColIds, unassigned, commitAssignment]);

  if (loading) return <LoadingSpinner />;

  return (
    <div ref={boardRef} style={{ overflowX: 'auto', paddingBottom: 16, WebkitOverflowScrolling: 'touch' }}>
      {/* aria-live region for kanban keyboard announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
          overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
        }}
      >
        {liveMessage}
      </div>
      <div className="dispatch-board-columns" style={{ display: 'flex', gap: 16, minWidth: 'max-content' }}>
        {/* Unassigned column */}
        <DispatchColumn
          colId={UNASSIGNED_COL_ID}
          column={null}
          unassigned={unassigned}
          isOver={false}
          pickedUpOrderId={pickedUpOrder?.id ?? null}
          focusedColId={focusedColId}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onCardKeyDown={handleCardKeyDown}
          onCardFocus={handleCardFocus}
        />

        {/* Driver columns */}
        {driverColumns.map((col) => {
          const colId = col.driver?.id || 'none';
          return (
            <DispatchColumn
              key={colId}
              colId={colId}
              column={col}
              unassigned={null}
              isOver={dragOverColumn === colId}
              pickedUpOrderId={pickedUpOrder?.id ?? null}
              focusedColId={focusedColId}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onCardKeyDown={handleCardKeyDown}
              onCardFocus={handleCardFocus}
            />
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
