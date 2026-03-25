import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult, registerTool } from '../util.js';

export function registerDispatchTools(server: McpServer): void {
  registerTool(
    server,
    'homer_dispatch_auto',
    'Run auto-dispatch to assign pending orders to routes and drivers. Use confirm="true" to execute, "false" for a dry-run preview.',
    {
      confirm: z.string().describe('Set to "true" to execute dispatch; "false" for a dry-run preview'),
    },
    async (args) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const body: Record<string, unknown> = {};
        if (args.confirm === 'true') body.confirm = true;

        const dispatchResult = await api.post<Record<string, unknown>>('/api/dispatch/auto-dispatch', body);
        return textResult(dispatchResult);
      } catch (err) {
        return errorResult(`Failed to run auto-dispatch: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  registerTool(
    server,
    'homer_dispatch_status',
    'Get current dispatch status including unassigned order count and active route count',
    undefined,
    async () => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const [ordersData, routesData] = await Promise.all([
          api.get<Record<string, unknown>[]>('/api/orders?status=pending'),
          api.get<Record<string, unknown>[]>('/api/routes?status=active'),
        ]);

        const unassignedOrders = Array.isArray(ordersData) ? ordersData : [];
        const activeRoutes = Array.isArray(routesData) ? routesData : [];

        return textResult({
          unassignedOrders: unassignedOrders.length,
          activeRoutes: activeRoutes.length,
        });
      } catch (err) {
        return errorResult(`Failed to get dispatch status: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
