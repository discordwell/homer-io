import type { NLOpsTool, ToolContext } from './types.js';

// ============================================================
// Query tools — risk: 'read', no confirmation needed
// ============================================================

export const getOperationalSummary: NLOpsTool = {
  name: 'get_operational_summary',
  description: 'Get a snapshot of today\'s fleet operations: active routes, driver statuses, pending orders, recent alerts. Call this first to orient yourself.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  riskLevel: 'read',
  requiredRole: 'driver',
  async execute(_input: Record<string, unknown>, ctx: ToolContext) {
    const { getDashboardStats } = await import('../../../modules/dashboard/service.js');
    const { getActiveDriverLocations } = await import('../../../modules/tracking/service.js');
    const { listRoutes } = await import('../../../modules/routes/service.js');
    const { listOrders } = await import('../../../modules/orders/service.js');

    const [stats, driverLocations, todayRoutes, pendingOrders] = await Promise.all([
      getDashboardStats(ctx.tenantId),
      getActiveDriverLocations(ctx.tenantId).catch(() => []),
      listRoutes(ctx.tenantId, { page: 1, limit: 100 }, undefined),
      listOrders(ctx.tenantId, { page: 1, limit: 5 }, 'received'),
    ]);

    const routesByStatus = { draft: 0, planned: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const r of todayRoutes.items) {
      const s = (r as any).status as keyof typeof routesByStatus;
      if (s in routesByStatus) routesByStatus[s]++;
    }

    const driversByStatus = { available: 0, on_route: 0, on_break: 0, offline: 0 };
    for (const d of driverLocations) {
      const s = (d as any).driverStatus as keyof typeof driversByStatus;
      if (s in driversByStatus) driversByStatus[s]++;
    }

    const urgentOrders = pendingOrders.items.filter((o: any) => o.priority === 'urgent');

    return {
      today: new Date().toISOString().slice(0, 10),
      stats,
      routes: { total: todayRoutes.total, byStatus: routesByStatus },
      drivers: driversByStatus,
      pendingOrders: { total: pendingOrders.total, urgentCount: urgentOrders.length },
    };
  },
};

export const searchOrders: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { listOrders } = await import('../../../modules/orders/service.js');
    return listOrders(
      ctx.tenantId,
      { page: Number(input.page) || 1, limit: Math.min(Number(input.limit) || 20, 50) },
      input.status as string | undefined,
      input.search as string | undefined,
      input.dateFrom as string | undefined,
      input.dateTo as string | undefined,
    );
  },
};

export const getOrderDetails: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getOrder } = await import('../../../modules/orders/service.js');
    return getOrder(ctx.tenantId, input.orderId as string);
  },
};

export const getRouteDetails: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'driver',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRoute } = await import('../../../modules/routes/service.js');
    return getRoute(ctx.tenantId, input.routeId as string);
  },
};

export const listRoutes: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { listRoutes: listRoutesFn } = await import('../../../modules/routes/service.js');
    return listRoutesFn(
      ctx.tenantId,
      { page: Number(input.page) || 1, limit: Math.min(Number(input.limit) || 20, 50) },
      input.status as string | undefined,
    );
  },
};

export const findDriver: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { listDrivers } = await import('../../../modules/fleet/service.js');
    return listDrivers(ctx.tenantId, { page: 1, limit: 10 }, undefined, input.search as string);
  },
};

export const getAvailableDrivers: NLOpsTool = {
  name: 'get_available_drivers',
  description: 'List all drivers currently marked as "available" (not on a route, not on break, not offline). Includes their vehicles and locations.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(_input: Record<string, unknown>, ctx: ToolContext) {
    const { listDrivers } = await import('../../../modules/fleet/service.js');
    return listDrivers(ctx.tenantId, { page: 1, limit: 100 }, 'available');
  },
};

export const getDriverPerformance: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getDriverPerformance: getPerf } = await import('../../../modules/analytics/service.js');
    return getPerf(ctx.tenantId, (input.range as '7d' | '30d' | '90d') || '7d');
  },
};

export const getAnalytics: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getAnalyticsOverview } = await import('../../../modules/analytics/service.js');
    return getAnalyticsOverview(ctx.tenantId, (input.range as '7d' | '30d' | '90d') || '7d');
  },
};

export const getAddressIntelligenceTool: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getAddressIntelligence } = await import('../../../modules/intelligence/service.js');
    return getAddressIntelligence(ctx.tenantId, input.addressHash as string);
  },
};

export const getIntelligenceInsightsTool: NLOpsTool = {
  name: 'get_intelligence_insights',
  description: 'Get dashboard-level intelligence insights: top failure addresses, most-learned addresses, delivery tracking stats, and overall learning metrics.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(_input: Record<string, unknown>, ctx: ToolContext) {
    const { getInsights } = await import('../../../modules/intelligence/service.js');
    return getInsights(ctx.tenantId);
  },
};

export const getRouteRiskTool: NLOpsTool = {
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
  riskLevel: 'read',
  requiredRole: 'dispatcher',
  async execute(input: Record<string, unknown>, ctx: ToolContext) {
    const { getRouteRisk } = await import('../../../modules/intelligence/service.js');
    return getRouteRisk(ctx.tenantId, input.routeId as string);
  },
};

export const queryTools: NLOpsTool[] = [
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
];
