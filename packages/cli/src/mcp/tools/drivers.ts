import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult } from '../util.js';

export function registerDriverTools(server: McpServer): void {
  server.tool(
    'homer_drivers_list',
    'List fleet drivers with optional status filter',
    {
      status: z.string().optional().describe('Filter by status (e.g. available, busy, offline)'),
    },
    async ({ status }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const params = new URLSearchParams();
        if (status) params.set('status', status);
        const qs = params.toString();
        const path = `/api/fleet/drivers${qs ? '?' + qs : ''}`;

        const data = await api.get<Record<string, unknown>[] | { drivers: Record<string, unknown>[] }>(path);
        const list = Array.isArray(data) ? data : (data as { drivers: Record<string, unknown>[] }).drivers || [];

        return textResult({ total: list.length, drivers: list });
      } catch (err) {
        return errorResult(`Failed to list drivers: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_drivers_available',
    'List drivers currently available for delivery assignments',
    {},
    async () => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const data = await api.get<Record<string, unknown>[] | { drivers: Record<string, unknown>[] }>(
          '/api/fleet/drivers?status=available',
        );
        const list = Array.isArray(data) ? data : (data as { drivers: Record<string, unknown>[] }).drivers || [];

        return textResult({ total: list.length, drivers: list });
      } catch (err) {
        return errorResult(`Failed to list available drivers: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
