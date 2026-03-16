import type { NLOpsTool, ToolContext } from './types.js';

// ============================================================
// Mutation tools — risk: 'mutate' or 'destructive'
// All require user confirmation before execution
// ============================================================

export const assignOrderToRoute: NLOpsTool = {
  name: 'assign_order_to_route',
  description: 'Assign one or more orders to an existing route. Orders must be in "received" status.',
  inputSchema: {
    type: 'object',
    properties: {
      orderIds: { type: 'array', items: { type: 'string' }, description: 'Order UUIDs to assign' },
      routeId: { type: 'string', description: 'Target route UUID' },
    },
    required: ['orderIds', 'routeId'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { batchAssignToRoute } = await import('../../../modules/orders/service.js');
    return batchAssignToRoute(ctx.tenantId, input.orderIds as string[], input.routeId as string);
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const { getRoute } = await import('../../../modules/routes/service.js');
    const [route, ...orderResults] = await Promise.all([
      getRoute(ctx.tenantId, input.routeId as string),
      ...(input.orderIds as string[]).slice(0, 5).map((id) => getOrder(ctx.tenantId, id).catch(() => null)),
    ]);
    return {
      action: 'Assign orders to route',
      route: { id: route.id, name: route.name, currentStops: route.totalStops },
      orders: orderResults.filter(Boolean).map((o: any) => ({
        id: o.id, recipient: o.recipientName, status: o.status,
      })),
      totalOrders: (input.orderIds as string[]).length,
    };
  },
};

export const updateOrderStatus: NLOpsTool = {
  name: 'update_order_status',
  description: 'Update the status of an order. Valid transitions: received→assigned, assigned→in_transit, in_transit→delivered/failed.',
  inputSchema: {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'Order UUID' },
      status: { type: 'string', enum: ['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'], description: 'New status' },
      failureReason: { type: 'string', description: 'Required if status is "failed"' },
    },
    required: ['orderId', 'status'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { updateOrderStatus: updateFn } = await import('../../../modules/orders/service.js');
    return updateFn(ctx.tenantId, input.orderId as string, {
      status: input.status as any,
      failureReason: input.failureReason as string | undefined,
    });
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const order = await getOrder(ctx.tenantId, input.orderId as string);
    return {
      action: `Change order status: ${order.status} → ${input.status}`,
      order: { id: order.id, recipient: order.recipientName, currentStatus: order.status },
      newStatus: input.status,
    };
  },
};

export const changeDriverStatus: NLOpsTool = {
  name: 'change_driver_status',
  description: 'Set a driver\'s availability status: available, on_break, or offline.',
  inputSchema: {
    type: 'object',
    properties: {
      driverId: { type: 'string', description: 'Driver UUID' },
      status: { type: 'string', enum: ['available', 'on_break', 'offline'], description: 'New status' },
    },
    required: ['driverId', 'status'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { updateDriver } = await import('../../../modules/fleet/service.js');
    return updateDriver(ctx.tenantId, input.driverId as string, { status: input.status } as any);
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getDriver } = await import('../../../modules/fleet/service.js');
    const driver = await getDriver(ctx.tenantId, input.driverId as string);
    return {
      action: `Change driver status: ${(driver as any).status} → ${input.status}`,
      driver: { id: (driver as any).id, name: (driver as any).name, currentStatus: (driver as any).status },
      newStatus: input.status,
    };
  },
};

export const createRoute: NLOpsTool = {
  name: 'create_route',
  description: 'Create a new delivery route, optionally assigning a driver, vehicle, and orders.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Route name' },
      driverId: { type: 'string', description: 'Driver UUID to assign' },
      vehicleId: { type: 'string', description: 'Vehicle UUID to assign' },
      orderIds: { type: 'array', items: { type: 'string' }, description: 'Order UUIDs to include' },
    },
    required: ['name'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { createRoute: createFn } = await import('../../../modules/routes/service.js');
    return createFn(ctx.tenantId, {
      name: input.name as string,
      driverId: input.driverId as string | undefined,
      vehicleId: input.vehicleId as string | undefined,
      orderIds: input.orderIds as string[] | undefined,
    });
  },
  async preview(input: Record<string, unknown>) {
    return {
      action: 'Create new route',
      name: input.name,
      driverId: input.driverId || 'unassigned',
      orderCount: (input.orderIds as string[] | undefined)?.length || 0,
    };
  },
};

export const reassignOrders: NLOpsTool = {
  name: 'reassign_orders',
  description: 'Move orders from one route/driver to another. This unassigns orders from the source and creates or assigns them to a target route. Use this when a driver calls in sick or needs load balancing.',
  inputSchema: {
    type: 'object',
    properties: {
      orderIds: { type: 'array', items: { type: 'string' }, description: 'Order UUIDs to reassign' },
      fromRouteId: { type: 'string', description: 'Source route UUID (orders will be unassigned from here)' },
      toRouteId: { type: 'string', description: 'Target route UUID (if existing route)' },
      toDriverId: { type: 'string', description: 'Target driver UUID (creates new route if toRouteId not given)' },
      newRouteName: { type: 'string', description: 'Name for new route (if creating one)' },
    },
    required: ['orderIds', 'fromRouteId'],
    additionalProperties: false,
  },
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { batchUpdateStatus, batchAssignToRoute } = await import('../../../modules/orders/service.js');
    const { createRoute: createFn } = await import('../../../modules/routes/service.js');
    const { logActivity } = await import('../../activity.js');
    const orderIds = input.orderIds as string[];

    // (finding #6) Wrap in try/catch — if target assignment fails, roll back the unassign
    let targetRouteId = input.toRouteId as string | undefined;

    // Step 1: Unassign from source route (reset to received)
    await batchUpdateStatus(ctx.tenantId, orderIds, 'received');

    try {
      // Step 2: Assign to target
      if (!targetRouteId && input.toDriverId) {
        const route = await createFn(ctx.tenantId, {
          name: (input.newRouteName as string) || `Reassigned: ${new Date().toLocaleDateString()}`,
          driverId: input.toDriverId as string,
          orderIds,
        });
        targetRouteId = route.id;
      } else if (targetRouteId) {
        await batchAssignToRoute(ctx.tenantId, orderIds, targetRouteId);
      }
    } catch (err) {
      // Rollback: re-assign orders back to source route
      try {
        await batchAssignToRoute(ctx.tenantId, orderIds, input.fromRouteId as string);
      } catch {
        // Best-effort rollback
      }
      throw err;
    }

    await logActivity({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'orders_reassigned',
      entityType: 'route',
      entityId: input.fromRouteId as string,
      metadata: { orderIds, targetRouteId, orderCount: orderIds.length },
    });

    return {
      success: true,
      ordersReassigned: orderIds.length,
      fromRouteId: input.fromRouteId,
      toRouteId: targetRouteId,
    };
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const { getOrder } = await import('../../../modules/orders/service.js');

    const fromRoute = await getRoute(ctx.tenantId, input.fromRouteId as string);
    const orderIds = input.orderIds as string[];
    const sampleOrders = await Promise.all(
      orderIds.slice(0, 5).map((id) => getOrder(ctx.tenantId, id).catch(() => null)),
    );

    let target = 'new route';
    if (input.toRouteId) {
      const toRoute = await getRoute(ctx.tenantId, input.toRouteId as string);
      target = `route "${toRoute.name}"`;
    }

    return {
      action: 'Reassign orders',
      from: { routeId: fromRoute.id, routeName: fromRoute.name, driverId: fromRoute.driverId },
      to: target,
      orders: sampleOrders.filter(Boolean).map((o: any) => ({
        id: o.id, recipient: o.recipientName,
      })),
      totalOrders: orderIds.length,
    };
  },
};

export const optimizeRoute: NLOpsTool = {
  name: 'optimize_route',
  description: 'Reorder stops on a route for optimal travel distance using AI. The route must have at least 2 stops.',
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route UUID to optimize' },
    },
    required: ['routeId'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { optimizeRoute: optimizeFn } = await import('../../../modules/routes/service.js');
    return optimizeFn(ctx.tenantId, input.routeId as string);
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId as string);
    return {
      action: 'Optimize route stop order',
      route: { id: route.id, name: route.name, stops: route.orders.length },
    };
  },
};

export const triggerAutoDispatch: NLOpsTool = {
  name: 'auto_dispatch',
  description: 'Automatically generate routes for all unassigned orders, distributing them among available drivers using AI. Creates draft routes that need confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      maxOrdersPerRoute: { type: 'number', description: 'Maximum orders per route (default 50)' },
      prioritizeUrgent: { type: 'boolean', description: 'Assign urgent orders first (default true)' },
    },
    required: [],
    additionalProperties: false,
  },
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { autoDispatch } = await import('../../../modules/dispatch/service.js');
    return autoDispatch(ctx.tenantId, {
      maxOrdersPerRoute: Number(input.maxOrdersPerRoute) || 50,
      prioritizeUrgent: input.prioritizeUrgent !== false,
    }, ctx.userId);
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { listOrders } = await import('../../../modules/orders/service.js');
    const { listDrivers } = await import('../../../modules/fleet/service.js');
    const [orders, drivers] = await Promise.all([
      listOrders(ctx.tenantId, { page: 1, limit: 1 }, 'received'),
      listDrivers(ctx.tenantId, { page: 1, limit: 1 }, 'available'),
    ]);
    return {
      action: 'Auto-dispatch all unassigned orders',
      unassignedOrders: orders.total,
      availableDrivers: drivers.total,
      maxOrdersPerRoute: input.maxOrdersPerRoute || 50,
      prioritizeUrgent: input.prioritizeUrgent !== false,
    };
  },
};

export const cancelRoute: NLOpsTool = {
  name: 'cancel_route',
  description: 'Cancel a route and unassign all its orders back to "received" status. Cannot cancel completed routes.',
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route UUID to cancel' },
    },
    required: ['routeId'],
    additionalProperties: false,
  },
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { transitionRouteStatus } = await import('../../../modules/routes/service.js');
    return transitionRouteStatus(ctx.tenantId, input.routeId as string, 'cancelled', ctx.userId);
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId as string);
    return {
      action: 'Cancel route',
      route: { id: route.id, name: route.name, status: route.status, stops: route.orders.length },
      warning: `${route.orders.length} orders will be unassigned`,
    };
  },
};

export const transitionRoute: NLOpsTool = {
  name: 'transition_route_status',
  description: 'Change a route\'s status. Valid transitions: draft→planned, planned→in_progress, in_progress→completed. Use cancel_route for cancellation.',
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route UUID' },
      newStatus: { type: 'string', enum: ['planned', 'in_progress', 'completed'], description: 'Target status' },
    },
    required: ['routeId', 'newStatus'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { transitionRouteStatus } = await import('../../../modules/routes/service.js');
    return transitionRouteStatus(
      ctx.tenantId,
      input.routeId as string,
      input.newStatus as 'planned' | 'in_progress' | 'completed',
      ctx.userId,
    );
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId as string);
    return {
      action: `Transition route: ${route.status} → ${input.newStatus}`,
      route: { id: route.id, name: route.name, currentStatus: route.status },
      newStatus: input.newStatus,
    };
  },
};

export const sendCustomerNotification: NLOpsTool = {
  name: 'send_customer_notification',
  description: 'Trigger a customer notification (SMS/email) for a specific order. The template must be configured in notification settings.',
  inputSchema: {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'Order UUID' },
      trigger: { type: 'string', enum: ['order_confirmed', 'driver_en_route', 'delivered', 'failed'], description: 'Notification trigger type' },
    },
    required: ['orderId', 'trigger'],
    additionalProperties: false,
  },
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { enqueueCustomerNotification } = await import('../../../modules/customer-notifications/service.js');
    await enqueueCustomerNotification(ctx.tenantId, input.orderId as string, input.trigger as string);
    return { success: true, message: `Notification "${input.trigger}" queued for order ${input.orderId}` };
  },
  async preview(input: Record<string, unknown>, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const order = await getOrder(ctx.tenantId, input.orderId as string);
    // (finding #11) Mask PII — don't leak full phone/email to LLM context
    const maskPhone = order.recipientPhone ? order.recipientPhone.replace(/.(?=.{4})/g, '*') : null;
    const maskEmail = order.recipientEmail ? order.recipientEmail.replace(/(.{2}).*@/, '$1***@') : null;
    return {
      action: `Send "${input.trigger}" notification`,
      order: { id: order.id, recipient: order.recipientName, phone: maskPhone, email: maskEmail },
      trigger: input.trigger,
    };
  },
};

export const mutationTools: NLOpsTool[] = [
  assignOrderToRoute,
  updateOrderStatus,
  changeDriverStatus,
  createRoute,
  reassignOrders,
  optimizeRoute,
  triggerAutoDispatch,
  cancelRoute,
  transitionRoute,
  sendCustomerNotification,
];
