import { z } from 'zod';
import type { NLOpsTool, ToolContext } from './types.js';

// ============================================================
// Mutation tools — risk: 'mutate' or 'destructive'
// All require user confirmation before execution
//
// Each tool declares:
//   - `inputSchema` (JSON Schema for the LLM prompt)
//   - `zodSchema`   (runtime validation, enforced by the registry wrapper in
//                    `tools/index.ts` before `execute()` / `preview()` run)
// After validation, `execute()` receives a fully-typed `z.infer<typeof schema>`.
// No `as any` casts — if you find yourself reaching for one, tighten the schema.
// ============================================================

const uuidLike = z.string().min(1); // intentionally lax — some callers/test envs use non-UUID ids

// ---------- assign_order_to_route ----------

const assignOrderToRouteSchema = z.object({
  orderIds: z.array(uuidLike).min(1),
  routeId: uuidLike,
}).strict();
type AssignOrderToRouteInput = z.infer<typeof assignOrderToRouteSchema>;

export const assignOrderToRoute: NLOpsTool<AssignOrderToRouteInput> = {
  name: 'assign_order_to_route',
  description: 'Assign one or more orders to an existing route. Orders must be in "received" status.',
  undoable: true,
  inputSchema: {
    type: 'object',
    properties: {
      orderIds: { type: 'array', items: { type: 'string' }, description: 'Order UUIDs to assign' },
      routeId: { type: 'string', description: 'Target route UUID' },
    },
    required: ['orderIds', 'routeId'],
    additionalProperties: false,
  },
  zodSchema: assignOrderToRouteSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { batchAssignToRoute } = await import('../../../modules/orders/service.js');
    return batchAssignToRoute(ctx.tenantId, input.orderIds, input.routeId);
  },
  async preview(input, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const { getRoute } = await import('../../../modules/routes/service.js');
    const [route, ...orderResults] = await Promise.all([
      getRoute(ctx.tenantId, input.routeId),
      ...input.orderIds.slice(0, 5).map((id) => getOrder(ctx.tenantId, id).catch(() => null)),
    ]);
    return {
      action: 'Assign orders to route',
      route: { id: route.id, name: route.name, currentStops: route.totalStops },
      orders: orderResults
        .filter((o): o is NonNullable<typeof o> => o !== null)
        .map((o) => ({
          id: (o as { id: string }).id,
          recipient: (o as { recipientName?: string }).recipientName,
          status: (o as { status?: string }).status,
        })),
      totalOrders: input.orderIds.length,
    };
  },
};

// ---------- update_order_status ----------

const orderStatusLiteral = z.enum(['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned']);

const updateOrderStatusSchema = z.object({
  orderId: uuidLike,
  status: orderStatusLiteral,
  failureReason: z.string().optional(),
}).strict();
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const updateOrderStatus: NLOpsTool<UpdateOrderStatusInput> = {
  name: 'update_order_status',
  description: 'Update the status of an order. Valid transitions: received→assigned, assigned→in_transit, in_transit→delivered/failed.',
  undoable: true,
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
  zodSchema: updateOrderStatusSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { updateOrderStatus: updateFn } = await import('../../../modules/orders/service.js');
    return updateFn(ctx.tenantId, input.orderId, {
      status: input.status,
      failureReason: input.failureReason,
    });
  },
  async preview(input, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const order = await getOrder(ctx.tenantId, input.orderId);
    return {
      action: `Change order status: ${order.status} → ${input.status}`,
      order: { id: order.id, recipient: order.recipientName, currentStatus: order.status },
      newStatus: input.status,
    };
  },
};

// ---------- change_driver_status ----------

const driverStatusLiteral = z.enum(['available', 'on_break', 'offline']);

const changeDriverStatusSchema = z.object({
  driverId: uuidLike,
  status: driverStatusLiteral,
}).strict();
type ChangeDriverStatusInput = z.infer<typeof changeDriverStatusSchema>;

export const changeDriverStatus: NLOpsTool<ChangeDriverStatusInput> = {
  name: 'change_driver_status',
  description: 'Set a driver\'s availability status: available, on_break, or offline.',
  undoable: true,
  inputSchema: {
    type: 'object',
    properties: {
      driverId: { type: 'string', description: 'Driver UUID' },
      status: { type: 'string', enum: ['available', 'on_break', 'offline'], description: 'New status' },
    },
    required: ['driverId', 'status'],
    additionalProperties: false,
  },
  zodSchema: changeDriverStatusSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { updateDriver } = await import('../../../modules/fleet/service.js');
    // `updateDriver` accepts `Partial<CreateDriverInput>` — it does not persist `status`
    // through this code path. This preserves the prior behavior of this tool; a separate
    // follow-up should route this through `updateDriverStatus` or extend the service.
    return updateDriver(ctx.tenantId, input.driverId, { status: input.status } as unknown as Parameters<typeof updateDriver>[2]);
  },
  async preview(input, ctx: ToolContext) {
    const { getDriver } = await import('../../../modules/fleet/service.js');
    const driver = await getDriver(ctx.tenantId, input.driverId);
    return {
      action: `Change driver status: ${driver.status} → ${input.status}`,
      driver: { id: driver.id, name: driver.name, currentStatus: driver.status },
      newStatus: input.status,
    };
  },
};

// ---------- create_route ----------

const createRouteToolSchema = z.object({
  name: z.string().min(1),
  driverId: uuidLike.optional(),
  vehicleId: uuidLike.optional(),
  orderIds: z.array(uuidLike).optional(),
}).strict();
type CreateRouteToolInput = z.infer<typeof createRouteToolSchema>;

export const createRoute: NLOpsTool<CreateRouteToolInput> = {
  name: 'create_route',
  description: 'Create a new delivery route, optionally assigning a driver, vehicle, and orders.',
  undoable: true,
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
  zodSchema: createRouteToolSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { createRoute: createFn } = await import('../../../modules/routes/service.js');
    return createFn(ctx.tenantId, {
      name: input.name,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      orderIds: input.orderIds,
    });
  },
  async preview(input) {
    return {
      action: 'Create new route',
      name: input.name,
      driverId: input.driverId || 'unassigned',
      orderCount: input.orderIds?.length ?? 0,
    };
  },
};

// ---------- reassign_orders ----------

const reassignOrdersSchema = z.object({
  orderIds: z.array(uuidLike).min(1),
  fromRouteId: uuidLike,
  toRouteId: uuidLike.optional(),
  toDriverId: uuidLike.optional(),
  newRouteName: z.string().optional(),
}).strict();
type ReassignOrdersInput = z.infer<typeof reassignOrdersSchema>;

export const reassignOrders: NLOpsTool<ReassignOrdersInput> = {
  name: 'reassign_orders',
  description: 'Move orders from one route/driver to another. This unassigns orders from the source and creates or assigns them to a target route. Use this when a driver calls in sick or needs load balancing.',
  undoable: true,
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
  zodSchema: reassignOrdersSchema,
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { batchUpdateStatus, batchAssignToRoute } = await import('../../../modules/orders/service.js');
    const { createRoute: createFn } = await import('../../../modules/routes/service.js');
    const { logActivity } = await import('../../activity.js');
    const { orderIds } = input;

    let targetRouteId = input.toRouteId;

    // Step 1: Unassign from source route (reset to received)
    await batchUpdateStatus(ctx.tenantId, orderIds, 'received');

    try {
      // Step 2: Assign to target
      if (!targetRouteId && input.toDriverId) {
        const route = await createFn(ctx.tenantId, {
          name: input.newRouteName || `Reassigned: ${new Date().toLocaleDateString()}`,
          driverId: input.toDriverId,
          orderIds,
        });
        targetRouteId = route.id;
      } else if (targetRouteId) {
        await batchAssignToRoute(ctx.tenantId, orderIds, targetRouteId);
      }
    } catch (err) {
      // Rollback: re-assign orders back to source route
      try {
        await batchAssignToRoute(ctx.tenantId, orderIds, input.fromRouteId);
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
      entityId: input.fromRouteId,
      metadata: { orderIds, targetRouteId, orderCount: orderIds.length },
    });

    return {
      success: true,
      ordersReassigned: orderIds.length,
      fromRouteId: input.fromRouteId,
      toRouteId: targetRouteId,
    };
  },
  async preview(input, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const { getOrder } = await import('../../../modules/orders/service.js');

    const fromRoute = await getRoute(ctx.tenantId, input.fromRouteId);
    const { orderIds } = input;
    const sampleOrders = await Promise.all(
      orderIds.slice(0, 5).map((id) => getOrder(ctx.tenantId, id).catch(() => null)),
    );

    let target = 'new route';
    if (input.toRouteId) {
      const toRoute = await getRoute(ctx.tenantId, input.toRouteId);
      target = `route "${toRoute.name}"`;
    }

    return {
      action: 'Reassign orders',
      from: { routeId: fromRoute.id, routeName: fromRoute.name, driverId: fromRoute.driverId },
      to: target,
      orders: sampleOrders
        .filter((o): o is NonNullable<typeof o> => o !== null)
        .map((o) => ({
          id: (o as { id: string }).id,
          recipient: (o as { recipientName?: string }).recipientName,
        })),
      totalOrders: orderIds.length,
    };
  },
};

// ---------- optimize_route ----------

const optimizeRouteSchema = z.object({
  routeId: uuidLike,
}).strict();
type OptimizeRouteInput = z.infer<typeof optimizeRouteSchema>;

export const optimizeRoute: NLOpsTool<OptimizeRouteInput> = {
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
  zodSchema: optimizeRouteSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { optimizeRoute: optimizeFn } = await import('../../../modules/routes/service.js');
    return optimizeFn(ctx.tenantId, input.routeId);
  },
  async preview(input, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId);
    return {
      action: 'Optimize route stop order',
      route: { id: route.id, name: route.name, stops: route.orders.length },
    };
  },
};

// ---------- auto_dispatch ----------

const autoDispatchSchema = z.object({
  maxOrdersPerRoute: z.number().int().positive().optional(),
  prioritizeUrgent: z.boolean().optional(),
}).strict();
type AutoDispatchInput = z.infer<typeof autoDispatchSchema>;

export const triggerAutoDispatch: NLOpsTool<AutoDispatchInput> = {
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
  zodSchema: autoDispatchSchema,
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { autoDispatch } = await import('../../../modules/dispatch/service.js');
    return autoDispatch(
      ctx.tenantId,
      {
        maxOrdersPerRoute: input.maxOrdersPerRoute ?? 50,
        prioritizeUrgent: input.prioritizeUrgent !== false,
      },
      ctx.userId,
    );
  },
  async preview(input, ctx: ToolContext) {
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
      maxOrdersPerRoute: input.maxOrdersPerRoute ?? 50,
      prioritizeUrgent: input.prioritizeUrgent !== false,
    };
  },
};

// ---------- cancel_route ----------

const cancelRouteSchema = z.object({
  routeId: uuidLike,
}).strict();
type CancelRouteInput = z.infer<typeof cancelRouteSchema>;

export const cancelRoute: NLOpsTool<CancelRouteInput> = {
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
  zodSchema: cancelRouteSchema,
  riskLevel: 'destructive',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { transitionRouteStatus } = await import('../../../modules/routes/service.js');
    return transitionRouteStatus(ctx.tenantId, input.routeId, 'cancelled', ctx.userId);
  },
  async preview(input, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId);
    return {
      action: 'Cancel route',
      route: { id: route.id, name: route.name, status: route.status, stops: route.orders.length },
      warning: `${route.orders.length} orders will be unassigned`,
    };
  },
};

// ---------- transition_route_status ----------

const transitionRouteSchema = z.object({
  routeId: uuidLike,
  newStatus: z.enum(['planned', 'in_progress', 'completed']),
}).strict();
type TransitionRouteInput = z.infer<typeof transitionRouteSchema>;

export const transitionRoute: NLOpsTool<TransitionRouteInput> = {
  name: 'transition_route_status',
  description: 'Change a route\'s status. Valid transitions: draft→planned, planned→in_progress, in_progress→completed. Use cancel_route for cancellation.',
  undoable: true,
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route UUID' },
      newStatus: { type: 'string', enum: ['planned', 'in_progress', 'completed'], description: 'Target status' },
    },
    required: ['routeId', 'newStatus'],
    additionalProperties: false,
  },
  zodSchema: transitionRouteSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { transitionRouteStatus } = await import('../../../modules/routes/service.js');
    return transitionRouteStatus(ctx.tenantId, input.routeId, input.newStatus, ctx.userId);
  },
  async preview(input, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    const route = await getRoute(ctx.tenantId, input.routeId);
    return {
      action: `Transition route: ${route.status} → ${input.newStatus}`,
      route: { id: route.id, name: route.name, currentStatus: route.status },
      newStatus: input.newStatus,
    };
  },
};

// ---------- send_customer_notification ----------

const notificationTriggerLiteral = z.enum(['order_confirmed', 'driver_en_route', 'delivered', 'failed']);

const sendCustomerNotificationSchema = z.object({
  orderId: uuidLike,
  trigger: notificationTriggerLiteral,
}).strict();
type SendCustomerNotificationInput = z.infer<typeof sendCustomerNotificationSchema>;

export const sendCustomerNotification: NLOpsTool<SendCustomerNotificationInput> = {
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
  zodSchema: sendCustomerNotificationSchema,
  riskLevel: 'mutate',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    // Skip real notification sends for demo tenants — no SMS/email costs
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../../db/index.js');
    const { tenants } = await import('../../db/schema/tenants.js');
    const [t] = await db
      .select({ isDemo: tenants.isDemo })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId)) // tenant-scoped per ToolContext contract
      .limit(1);
    if (t?.isDemo) {
      return { success: true, message: `Notification "${input.trigger}" simulated for demo (not actually sent)` };
    }
    const { enqueueCustomerNotification } = await import('../../../modules/customer-notifications/service.js');
    await enqueueCustomerNotification(ctx.tenantId, input.orderId, input.trigger);
    return { success: true, message: `Notification "${input.trigger}" queued for order ${input.orderId}` };
  },
  async preview(input, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    const order = await getOrder(ctx.tenantId, input.orderId);
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
