import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { safeGetApi, textResult, errorResult } from '../util.js';

export function registerSettingsTools(server: McpServer): void {
  server.tool(
    'homer_settings_get',
    'Get organization settings including name, timezone, address, and configuration',
    {},
    async () => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const settings = await api.get<Record<string, unknown>>('/api/settings/organization');
        return textResult(settings);
      } catch (err) {
        return errorResult(`Failed to get settings: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );

  server.tool(
    'homer_settings_industry',
    'Get the organization industry type and list of enabled features',
    {},
    async () => {
      const result = safeGetApi();
      if ('error' in result) return errorResult(result.error);
      const { api } = result;

      try {
        const data = await api.get<Record<string, unknown>>('/api/settings/organization');

        // Extract industry-relevant fields
        const industryInfo: Record<string, unknown> = {};
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if ('industry' in obj) industryInfo.industry = obj.industry;
          if ('features' in obj) industryInfo.features = obj.features;
          if ('enabledFeatures' in obj) industryInfo.enabledFeatures = obj.enabledFeatures;
          if ('industryType' in obj) industryInfo.industryType = obj.industryType;

          // If no specific industry keys found, return full settings
          if (Object.keys(industryInfo).length === 0) {
            return textResult(data);
          }
        }

        return textResult(industryInfo);
      } catch (err) {
        return errorResult(`Failed to get industry settings: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  );
}
