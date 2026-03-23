import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { safeGetApi, textResult, errorResult } from '../util.js';

export function registerAnalyticsTools(server: McpServer): void {
  server.tool(
    'homer_analytics_dashboard',
    'Get dashboard KPIs: orders today, active routes, delivery rate, and other key metrics',
    {},
    async () => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const stats = await api.get<Record<string, unknown>>('/api/dashboard/stats');
        return textResult(stats);
      } catch (err) {
        return errorResult(`Failed to get dashboard stats: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_analytics_overview',
    'Get analytics overview for a time period with trends and breakdowns',
    {
      period: z.string().optional().describe('Time period: 7d, 30d, or 90d (default 7d)'),
    },
    async ({ period }) => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const p = period || '7d';
        const data = await api.get<Record<string, unknown>>(
          `/api/analytics/overview?period=${encodeURIComponent(p)}`,
        );
        return textResult(data);
      } catch (err) {
        return errorResult(`Failed to get analytics overview: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
