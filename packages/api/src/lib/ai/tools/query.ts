import { z } from 'zod';
import { eq } from 'drizzle-orm';
import type { NLOpsTool, ToolContext } from './types.js';
import { db } from '../../db/index.js';
import { drivers } from '../../db/schema/drivers.js';

// ============================================================
// Query tools — risk: 'read', no confirmation needed
//
// Each tool declares two schemas:
//   - `inputSchema` — JSON Schema for the LLM (Anthropic/OpenAI tool_use prompt).
//   - `zodSchema`   — runtime validation (enforced by the registry wrapper in
//                     `tools/index.ts` before `execute()` is called).
// This is deliberate duplication: we don't have `zod-to-json-schema` as a dep,
// and the JSON Schemas are tuned for LLM prompt quality. Keep both in sync.
// ============================================================

// --- Shared primitives ---

const paginationShape = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(50).optional(),
};

const rangeEnum = z.enum(['7d', '30d', '90d']).optional();

// ---------- get_operational_summary ----------

const emptyInputSchema = z.object({}).strict();
type EmptyInput = z.infer<typeof emptyInputSchema>;

export const getOperationalSummary: NLOpsTool<EmptyInput> = {
  name: 'get_operational_summary',
  description: 'Get a snapshot of today\'s fleet operations: active routes, driver statuses, pending orders, recent alerts. Call this first to orient yourself.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  zodSchema: emptyInputSchema,
  riskLevel: 'read',
  requiredRole: 'driver',
  async execute(_input, ctx: ToolContext) {
    const { getDashboardStats } = await import('../../../modules/dashboard/service.js');
    const { getActiveDriverLocations } = await import('../../../modules/tracking/service.js');
    const { listRoutes } = await import('../../../modules/routes/service.js');
    const { listOrders } = await import('../../../modules/orders/service.js');

    const [stats, _driverLocations, todayRoutes, pendingOrders] = await Promise.all([
      getDashboardStats(ctx.tenantId),
      getActiveDriverLocations(ctx.tenantId).catch(() => []),
      listRoutes(ctx.tenantId, { page: 1, limit: 100 }, undefined),
      listOrders(ctx.tenantId, { page: 1, limit: 5 }, 'received'),
    ]);

    const routesByStatus = { draft: 0, planned: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const r of todayRoutes.items) {
      const s = (r as { status: string }).status as keyof typeof routesByStatus;
      if (s in routesByStatus) routesByStatus[s]++;
    }

    const allDrivers = await db
      .select({ status: drivers.status })
      .from(drivers)
      .where(eq(drivers.tenantId, ctx.tenantId)); // tenant-scoped WHERE per ToolContext contract

    const driversByStatus = {
      available: allDrivers.filter((d) => d.status === 'available').length,
      on_route: allDrivers.filter((d) => d.status === 'on_route').length,
      on_break: allDrivers.filter((d) => d.status === 'on_break').length,
      offline: allDrivers.filter((d) => d.status === 'offline').length,
    };

    const urgentOrders = pendingOrders.items.filter((o: { priority?: string }) => o.priority === 'urgent');

    return {
      today: new Date().toISOString().slice(0, 10),
      stats,
      routes: { total: todayRoutes.total, showing: todayRoutes.items.length, byStatus: routesByStatus },
      drivers: driversByStatus,
      pendingOrders: { total: pendingOrders.total, showing: pendingOrders.items.length, urgentCount: urgentOrders.length },
    };
  },
};

// ---------- search_orders ----------

const searchOrdersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  ...paginationShape,
}).strict();
type SearchOrdersInput = z.infer<typeof searchOrdersSchema>;

export const searchOrders: NLOpsTool<SearchOrdersInput> = {
  name: 'search_orders',
  description: 'Search orders by customer name, status, date range. Returns paginated results with order details.',
  inputSchema: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Search by recipient name, external ID, or address' },
      status: { type: 'string', enum: ['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'], description: 'Filter by order status' },
      dateFrom: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      dateTo: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      page: { type: 'number', description: 'Page number (default 1)' },
      limit: { type: 'number', description: 'Results per page (default 20, max 50)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: searchOrdersSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { listOrders } = await import('../../../modules/orders/service.js');
    return listOrders(
      ctx.tenantId,
      { page: input.page ?? 1, limit: Math.min(input.limit ?? 20, 50) },
      input.status,
      input.search,
      input.dateFrom,
      input.dateTo,
    );
  },
};

// ---------- get_order_details ----------

const getOrderDetailsSchema = z.object({
  orderId: z.string().min(1),
}).strict();
type GetOrderDetailsInput = z.infer<typeof getOrderDetailsSchema>;

export const getOrderDetails: NLOpsTool<GetOrderDetailsInput> = {
  name: 'get_order_details',
  description: 'Get full details for a specific order by ID, including delivery address, status, route assignment, and timestamps.',
  inputSchema: {
    type: 'object',
    properties: {
      orderId: { type: 'string', description: 'The order UUID' },
    },
    required: ['orderId'],
    additionalProperties: false,
  },
  zodSchema: getOrderDetailsSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    return getOrder(ctx.tenantId, input.orderId);
  },
};

// ---------- get_route_details ----------

const getRouteDetailsSchema = z.object({
  routeId: z.string().min(1),
}).strict();
type GetRouteDetailsInput = z.infer<typeof getRouteDetailsSchema>;

export const getRouteDetails: NLOpsTool<GetRouteDetailsInput> = {
  name: 'get_route_details',
  description: 'Get a route with all its assigned orders/stops, driver, vehicle, status, and progress. Use this to see what\'s on a specific route.',
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'The route UUID' },
    },
    required: ['routeId'],
    additionalProperties: false,
  },
  zodSchema: getRouteDetailsSchema,
  riskLevel: 'read',
  requiredRole: 'driver',
  async execute(input, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    return getRoute(ctx.tenantId, input.routeId);
  },
};

// ---------- list_routes ----------

const listRoutesSchema = z.object({
  status: z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled']).optional(),
  ...paginationShape,
}).strict();
type ListRoutesInput = z.infer<typeof listRoutesSchema>;

export const listRoutes: NLOpsTool<ListRoutesInput> = {
  name: 'list_routes',
  description: 'List routes, optionally filtered by status (draft, planned, in_progress, completed, cancelled). Returns route name, driver, stop count, and progress.',
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'planned', 'in_progress', 'completed', 'cancelled'], description: 'Filter by route status' },
      page: { type: 'number', description: 'Page number (default 1)' },
      limit: { type: 'number', description: 'Results per page (default 20, max 50)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: listRoutesSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { listRoutes: listRoutesFn } = await import('../../../modules/routes/service.js');
    return listRoutesFn(
      ctx.tenantId,
      { page: input.page ?? 1, limit: Math.min(input.limit ?? 20, 50) },
      input.status,
    );
  },
};

// ---------- find_driver ----------

const findDriverSchema = z.object({
  search: z.string().min(1),
}).strict();
type FindDriverInput = z.infer<typeof findDriverSchema>;

export const findDriver: NLOpsTool<FindDriverInput> = {
  name: 'find_driver',
  description: 'Search for a driver by name. Returns driver profile, status, current vehicle, and current route if any. Use this when the user mentions a driver by name.',
  inputSchema: {
    type: 'object',
    properties: {
      search: { type: 'string', description: 'Driver name or partial name to search for' },
    },
    required: ['search'],
    additionalProperties: false,
  },
  zodSchema: findDriverSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { listDrivers } = await import('../../../modules/fleet/service.js');
    return listDrivers(ctx.tenantId, { page: 1, limit: 10 }, undefined, input.search);
  },
};

// ---------- get_available_drivers ----------

export const getAvailableDrivers: NLOpsTool<EmptyInput> = {
  name: 'get_available_drivers',
  description: 'List all drivers currently marked as "available" (not on a route, not on break, not offline). Includes their vehicles and locations.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  zodSchema: emptyInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(_input, ctx: ToolContext) {
    const { listDrivers } = await import('../../../modules/fleet/service.js');
    return listDrivers(ctx.tenantId, { page: 1, limit: 100 }, 'available');
  },
};

// ---------- get_driver_performance ----------

const rangeInputSchema = z.object({
  range: rangeEnum,
}).strict();
type RangeInput = z.infer<typeof rangeInputSchema>;

export const getDriverPerformance: NLOpsTool<RangeInput> = {
  name: 'get_driver_performance',
  description: 'Get performance metrics for all drivers: deliveries completed, on-time rate, average stops per route. Supports time ranges: 7d, 30d, 90d.',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range (default 7d)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: rangeInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getDriverPerformance: getPerf } = await import('../../../modules/analytics/service.js');
    return getPerf(ctx.tenantId, input.range ?? '7d');
  },
};

// ---------- get_analytics ----------

export const getAnalytics: NLOpsTool<RangeInput> = {
  name: 'get_analytics',
  description: 'Get fleet KPIs: total orders, deliveries, on-time rate, average route time, failed delivery rate. Supports time ranges: 7d, 30d, 90d.',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range (default 7d)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: rangeInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getAnalyticsOverview } = await import('../../../modules/analytics/service.js');
    return getAnalyticsOverview(ctx.tenantId, input.range ?? '7d');
  },
};

// ---------- get_address_intelligence ----------

const getAddressIntelligenceInputSchema = z.object({
  addressHash: z.string().min(1),
}).strict();
type GetAddressIntelligenceInput = z.infer<typeof getAddressIntelligenceInputSchema>;

export const getAddressIntelligenceTool: NLOpsTool<GetAddressIntelligenceInput> = {
  name: 'get_address_intelligence',
  description: 'Look up delivery intelligence for an address. Returns learned service times, success/failure rates, hourly patterns, access instructions, parking notes, and failure reasons. Search by address hash.',
  inputSchema: {
    type: 'object',
    properties: {
      addressHash: { type: 'string', description: 'SHA-256 hash of normalized address' },
    },
    required: ['addressHash'],
    additionalProperties: false,
  },
  zodSchema: getAddressIntelligenceInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getAddressIntelligence } = await import('../../../modules/intelligence/service.js');
    return getAddressIntelligence(ctx.tenantId, input.addressHash);
  },
};

// ---------- get_intelligence_insights ----------

export const getIntelligenceInsightsTool: NLOpsTool<EmptyInput> = {
  name: 'get_intelligence_insights',
  description: 'Get dashboard-level intelligence insights: top failure addresses, most-learned addresses, delivery tracking stats, and overall learning metrics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  zodSchema: emptyInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(_input, ctx: ToolContext) {
    const { getInsights } = await import('../../../modules/intelligence/service.js');
    return getInsights(ctx.tenantId);
  },
};

// ---------- get_route_risk ----------

const getRouteRiskInputSchema = z.object({
  routeId: z.string().min(1),
}).strict();
type GetRouteRiskInput = z.infer<typeof getRouteRiskInputSchema>;

export const getRouteRiskTool: NLOpsTool<GetRouteRiskInput> = {
  name: 'get_route_risk',
  description: 'Get risk scores (0-100) for all stops on a route. Identifies high-risk deliveries based on address failure rate, delivery hour, time windows, and driver history.',
  inputSchema: {
    type: 'object',
    properties: {
      routeId: { type: 'string', description: 'Route UUID' },
    },
    required: ['routeId'],
    additionalProperties: false,
  },
  zodSchema: getRouteRiskInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getRouteRisk } = await import('../../../modules/intelligence/service.js');
    return getRouteRisk(ctx.tenantId, input.routeId);
  },
};

// ---------- get_analytics_deep ----------

export const getAnalyticsDeep: NLOpsTool<RangeInput> = {
  name: 'get_analytics_deep',
  description: 'Get comprehensive analytics: enriched overview with sparklines and period deltas, auto-generated insights, and delivery outcomes (failure breakdown + time-window compliance). Use this for broad analytics questions like "how are we doing?" or "give me a full status report".',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range (default 7d)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: rangeInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const range = input.range ?? '7d';
    const { getEnhancedOverview, generateInsights, getDeliveryOutcomes } = await import(
      '../../../modules/analytics/service.js'
    );
    const [overview, insights, outcomes] = await Promise.all([
      getEnhancedOverview(ctx.tenantId, range),
      generateInsights(ctx.tenantId, range),
      getDeliveryOutcomes(ctx.tenantId, range),
    ]);
    return { overview, insights, outcomes };
  },
};

// ---------- compare_periods ----------

export const comparePeriodsT: NLOpsTool<RangeInput> = {
  name: 'compare_periods',
  description: 'Compare analytics between current and previous period. Returns both period stats and percentage changes. Use for "compare this week to last week" or "how are we trending?" questions.',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range — compares this period vs the same length before it (default 7d)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: rangeInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { comparePeriods } = await import('../../../modules/analytics/service.js');
    return comparePeriods(ctx.tenantId, input.range ?? '7d');
  },
};

// ---------- get_delivery_outcomes ----------

export const getDeliveryOutcomesT: NLOpsTool<RangeInput> = {
  name: 'get_delivery_outcomes',
  description: 'Get delivery failure breakdown by category (not home, wrong address, etc.), daily status distribution, and time-window compliance rate. Use for "why are deliveries failing?" or "what are our failure reasons?" questions.',
  inputSchema: {
    type: 'object',
    properties: {
      range: { type: 'string', enum: ['7d', '30d', '90d'], description: 'Time range (default 7d)' },
    },
    required: [],
    additionalProperties: false,
  },
  zodSchema: rangeInputSchema,
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input, ctx: ToolContext) {
    const { getDeliveryOutcomes } = await import('../../../modules/analytics/service.js');
    return getDeliveryOutcomes(ctx.tenantId, input.range ?? '7d');
  },
};

// Collection type uses `any` TInput because each tool parameterises TInput on
// its own zodSchema. The registry wrapper validates before dispatch, so the
// erasure is safe at the boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const queryTools: NLOpsTool<any>[] = [
  getOperationalSummary,
  searchOrders,
  getOrderDetails,
  getRouteDetails,
  listRoutes,
  findDriver,
  getAvailableDrivers,
  getDriverPerformance,
  getAnalytics,
  getAddressIntelligenceTool,
  getIntelligenceInsightsTool,
  getRouteRiskTool,
  getAnalyticsDeep,
  comparePeriodsT,
  getDeliveryOutcomesT,
];
