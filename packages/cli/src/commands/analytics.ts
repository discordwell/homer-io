import type { Command } from 'commander';
import { getApi } from '../api.js';
import { error, info, output } from '../output.js';

export function registerAnalyticsCommands(program: Command): void {
  const analytics = program
    .command('analytics')
    .description('View analytics and reports');

  analytics
    .command('today')
    .description("Show today's stats")
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching today\'s stats...');
        const stats = await api.get<Record<string, unknown>>('/api/dashboard/stats');
        output(stats, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  analytics
    .command('overview')
    .description('Show analytics overview for a period')
    .option('--period <period>', 'Time period: 7d, 30d, or 90d', '7d')
    .option('--json', 'Output as JSON')
    .action(async (opts: { period: string; json?: boolean }) => {
      try {
        const api = getApi();
        info(`Fetching analytics for ${opts.period}...`);
        const data = await api.get<Record<string, unknown>>(
          `/api/analytics/overview?period=${encodeURIComponent(opts.period)}`,
        );
        output(data, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
