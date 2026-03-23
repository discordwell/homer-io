import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult } from '../util.js';

export function registerRouteTools(server: McpServer): void {
  server.tool(
    'homer_routes_list',
    'List delivery routes with optional status filter',
    {
      status: z.string().optional().describe('Filter by status (e.g. draft, active, completed)'),
    },
    async ({ status }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const qs = params.toString();
        const path = `/api/routes${qs ? '?' + qs : ''}`;

        const data = await api.get<Record<string, unknown>[] | { routes: Record<string, unknown>[] }>(path);
        const list = Array.isArray(data) ? data : (data as { routes: Record<string, unknown>[] }).routes || [];

        return textResult({ total: list.length, routes: list });
      } catch (err) {
        return errorResult(`Failed to list routes: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_routes_create',
    'Create a new delivery route',
    {
      name: z.string().describe('Route name'),
      driverId: z.string().optional().describe('Driver ID to assign'),
      orderIds: z.array(z.string()).optional().describe('Array of order IDs to include in the route'),
    },
    async ({ name, driverId, orderIds }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const body: Record<string, unknown> = { name };
        if (driverId) body.driverId = driverId;
        if (orderIds && orderIds.length > 0) body.orderIds = orderIds;

        const route = await api.post<Record<string, unknown>>('/api/routes', body);
        return textResult(route);
      } catch (err) {
        return errorResult(`Failed to create route: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_routes_optimize',
    'Optimize the stop order of a route for shortest distance/time',
    {
      routeId: z.string().describe('The route ID to optimize'),
    },
    async ({ routeId }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const optimized = await api.post<Record<string, unknown>>(`/api/routes/${routeId}/optimize`);
        return textResult(optimized);
      } catch (err) {
        return errorResult(`Failed to optimize route: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
