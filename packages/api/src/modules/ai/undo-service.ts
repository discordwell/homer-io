import { getSnapshot, deleteSnapshot, type MutationSnapshot } from '../../lib/ai/undo.js';
import { logActivity } from '../../lib/activity.js';

export interface UndoResult {
  success: boolean;
  undone: string;
  error?: string;
}

/**
 * Undo a previously confirmed AI mutation by restoring from snapshot.
 */
export async function undoMutation(
  tenantId: string,
  userId: string,
  snapshotId: string,
): Promise<UndoResult> {
  const snapshot = await getSnapshot(tenantId, snapshotId);
  if (!snapshot) {
    return { success: false, undone: '', error: 'Undo expired or not found. Actions can only be undone within 15 minutes.' };
  }

  if (snapshot.tenantId !== tenantId) {
    return { success: false, undone: '', error: 'Permission denied.' };
  }

  try {
    await executeUndo(snapshot);
  } catch (err) {
    return {
      success: false,
      undone: snapshot.toolName,
      error: `Failed to undo: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }

  await deleteSnapshot(tenantId, snapshotId);

  await logActivity({
    tenantId,
    userId,
    action: 'ai_mutation_undone',
    entityType: 'ai',
    entityId: snapshotId,
    metadata: { toolName: snapshot.toolName, summary: snapshot.summary },
  });

  return { success: true, undone: snapshot.summary };
}

async function executeUndo(snapshot: MutationSnapshot): Promise<void> {
  const before = snapshot.beforeState as Record<string, unknown>;

  switch (snapshot.toolName) {
    case 'update_order_status': {
      const { updateOrderStatus } = await import('../orders/service.js');
      const order = before.order as Record<string, unknown>;
      await updateOrderStatus(snapshot.tenantId, order.id as string, {
        status: order.currentStatus as any,
      });
      break;
    }

    case 'change_driver_status': {
      const { updateDriver } = await import('../fleet/service.js');
      const driver = before.driver as Record<string, unknown>;
      await updateDriver(snapshot.tenantId, driver.id as string, {
        status: driver.currentStatus,
      } as any);
      break;
    }

    case 'assign_order_to_route': {
      const { batchUpdateStatus } = await import('../orders/service.js');
      const orders = before.orders as Array<Record<string, unknown>>;
      const orderIds = orders.map((o) => o.id as string);
      // Unassign by resetting to received
      await batchUpdateStatus(snapshot.tenantId, orderIds, 'received');
      break;
    }

    case 'create_route': {
      const { transitionRouteStatus } = await import('../routes/service.js');
      const input = snapshot.toolInput;
      // The execute result would have the route ID, but we stored input + preview.
      // We need to find the route. The toolInput has the name, and the result had the ID.
      // Since preview for create_route doesn't have an ID (it's a preview before creation),
      // we need a different approach: search for the most recent route with this name.
      const { listRoutes } = await import('../routes/service.js');
      const routes = await listRoutes(snapshot.tenantId, { page: 1, limit: 5 });
      const match = routes.items.find(
        (r: any) => r.name === input.name && r.status !== 'cancelled',
      );
      if (match) {
        await transitionRouteStatus(snapshot.tenantId, (match as any).id, 'cancelled', snapshot.userId);
      }
      break;
    }

    case 'reassign_orders': {
      const { batchUpdateStatus, batchAssignToRoute } = await import('../orders/service.js');
      const orderIds = snapshot.toolInput.orderIds as string[];
      const fromRouteId = snapshot.toolInput.fromRouteId as string;
      // Reset orders to received, then reassign back to original route
      await batchUpdateStatus(snapshot.tenantId, orderIds, 'received');
      await batchAssignToRoute(snapshot.tenantId, orderIds, fromRouteId);
      break;
    }

    case 'transition_route_status': {
      const { transitionRouteStatus } = await import('../routes/service.js');
      const route = before.route as Record<string, unknown>;
      const previousStatus = route.currentStatus as string;
      // Try to transition back — this may fail if the reverse transition isn't valid
      await transitionRouteStatus(
        snapshot.tenantId,
        route.id as string,
        previousStatus as any,
        snapshot.userId,
      );
      break;
    }

    default:
      throw new Error(`Undo not supported for tool: ${snapshot.toolName}`);
  }
}
