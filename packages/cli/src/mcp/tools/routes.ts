import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult, registerTool } from '../util.js';

export function registerRouteTools(server: McpServer): void {
  registerTool(
    server,
    'homer_routes_list',
    'List delivery routes with optional status filter',
    {
      status: z.string().optional().describe('Filter by status (e.g. draft, active, completed)'),
    },
    async (args) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const params = new URLSearchParams();
        if (args.status) params.set('status', args.status);
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

  registerTool(
    server,
    'homer_routes_create',
    'Create a new delivery route',
    {
      name: z.string().describe('Route name'),
      driverId: z.string().optional().describe('Driver ID to assign'),
      orderIds: z.string().optional().describe('Comma-separated order IDs to include in the route'),
    },
    async (args) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const body: Record<string, unknown> = { name: args.name };
        if (args.driverId) body.driverId = args.driverId;
        if (args.orderIds) body.orderIds = args.orderIds.split(',').map(s => s.trim());

        const route = await api.post<Record<string, unknown>>('/api/routes', body);
        return textResult(route);
      } catch (err) {
        return errorResult(`Failed to create route: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  registerTool(
    server,
    'homer_routes_optimize',
    'Optimize the stop order of a route for shortest distance/time',
    {
      routeId: z.string().describe('The route ID to optimize'),
    },
    async (args) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const optimized = await api.post<Record<string, unknown>>(`/api/routes/${args.routeId}/optimize`);
        return textResult(optimized);
      } catch (err) {
        return errorResult(`Failed to optimize route: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
