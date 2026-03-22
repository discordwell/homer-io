import type { Command } from 'commander';
import { getApi } from '../api.js';
import { error, info, output } from '../output.js';

export function registerSettingsCommands(program: Command): void {
  const settings = program
    .command('settings')
    .description('Organization settings');

  settings
    .command('get')
    .description('Get organization settings')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching settings...');
        const data = await api.get<Record<string, unknown>>('/api/settings/organization');
        output(data, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  settings
    .command('industry')
    .description('Show industry and enabled features')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching industry settings...');
        const data = await api.get<Record<string, unknown>>('/api/settings/organization');

        // Extract industry-relevant fields
        const industryInfo: Record<string, unknown> = {};
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if ('industry' in obj) industryInfo.industry = obj.industry;
          if ('features' in obj) industryInfo.features = obj.features;
          if ('enabledFeatures' in obj) industryInfo.enabledFeatures = obj.enabledFeatures;
          if ('industryType' in obj) industryInfo.industryType = obj.industryType;

          // If we didn't find specific keys, return the full settings
          if (Object.keys(industryInfo).length === 0) {
            output(data, !!opts.json);
            return;
          }
        }

        output(industryInfo, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
