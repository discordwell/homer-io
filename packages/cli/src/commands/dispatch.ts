import type { Command } from 'commander';
import { getApi } from '../api.js';
import { success, error, info, output, printTable } from '../output.js';

export function registerDispatchCommands(program: Command): void {
  const dispatch = program
    .command('dispatch')
    .description('Dispatch operations');

  dispatch
    .command('auto')
    .description('Run auto-dispatch to assign orders to routes')
    .option('--confirm', 'Confirm and execute dispatch')
    .option('--json', 'Output as JSON')
    .action(async (opts: { confirm?: boolean; json?: boolean }) => {
      try {
        const api = getApi();
        info('Running auto-dispatch...');
        const body: Record<string, unknown> = {};
        if (opts.confirm) body.confirm = true;

        const result = await api.post<Record<string, unknown>>('/api/dispatch/auto-dispatch', body);
        if (opts.json) {
          output(result, true);
        } else {
          if (opts.confirm) {
            success('Auto-dispatch executed.');
          } else {
            info('Auto-dispatch preview (use --confirm to execute):');
          }
          output(result, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  dispatch
    .command('status')
    .description('Show current dispatch status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching dispatch status...');

        // Fetch orders and routes in parallel
        const [ordersData, routesData] = await Promise.all([
          api.get<Record<string, unknown>[]>('/api/orders?status=pending'),
          api.get<Record<string, unknown>[]>('/api/routes?status=active'),
        ]);

        const unassignedOrders = Array.isArray(ordersData) ? ordersData : [];
        const activeRoutes = Array.isArray(routesData) ? routesData : [];

        const summary = {
          unassignedOrders: unassignedOrders.length,
          activeRoutes: activeRoutes.length,
        };

        if (opts.json) {
          output(summary, true);
        } else {
          printTable(
            ['Metric', 'Count'],
            [
              ['Unassigned Orders', String(summary.unassignedOrders)],
              ['Active Routes', String(summary.activeRoutes)],
            ],
          );
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
