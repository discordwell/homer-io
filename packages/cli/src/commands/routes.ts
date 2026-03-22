import type { Command } from 'commander';
import { getApi } from '../api.js';
import { success, error, info, output, printTable } from '../output.js';

interface Route {
  id: string;
  name: string;
  status: string;
  driverId?: string;
  orderCount?: number;
  [key: string]: unknown;
}

export function registerRouteCommands(program: Command): void {
  const routes = program
    .command('routes')
    .description('Manage delivery routes');

  routes
    .command('list')
    .description('List routes')
    .option('--status <status>', 'Filter by status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; json?: boolean }) => {
      try {
        const api = getApi();
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        const qs = params.toString();
        const path = `/api/routes${qs ? '?' + qs : ''}`;
        info('Fetching routes...');
        const data = await api.get<Route[] | { routes: Route[] }>(path);
        const list = Array.isArray(data) ? data : (data as { routes: Route[] }).routes || [];

        if (opts.json) {
          output(list, true);
        } else {
          if (list.length === 0) {
            info('No routes found.');
            return;
          }
          const headers = ['ID', 'Name', 'Status', 'Driver', 'Orders'];
          const rows = list.map((r: Route) => [
            String(r.id ?? ''),
            String(r.name ?? ''),
            String(r.status ?? ''),
            String(r.driverId ?? '-'),
            String(r.orderCount ?? ''),
          ]);
          printTable(headers, rows);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  routes
    .command('get')
    .description('Get route details')
    .argument('<id>', 'Route ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const api = getApi();
        const route = await api.get<Route>(`/api/routes/${id}`);
        output(route, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  routes
    .command('create')
    .description('Create a new route')
    .requiredOption('--name <name>', 'Route name')
    .option('--driver <id>', 'Assign driver by ID')
    .option('--orders <ids>', 'Comma-separated order IDs')
    .option('--json', 'Output as JSON')
    .action(async (opts: { name: string; driver?: string; orders?: string; json?: boolean }) => {
      try {
        const api = getApi();
        const body: Record<string, unknown> = { name: opts.name };
        if (opts.driver) body.driverId = opts.driver;
        if (opts.orders) body.orderIds = opts.orders.split(',').map(s => s.trim());

        info('Creating route...');
        const route = await api.post<Route>('/api/routes', body);
        if (opts.json) {
          output(route, true);
        } else {
          success(`Route created: ${route.id ?? 'OK'}`);
          output(route, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  routes
    .command('optimize')
    .description('Optimize route order')
    .argument('<id>', 'Route ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info(`Optimizing route ${id}...`);
        const result = await api.post<Record<string, unknown>>(`/api/routes/${id}/optimize`);
        if (opts.json) {
          output(result, true);
        } else {
          success('Route optimized.');
          output(result, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  routes
    .command('assign')
    .description('Assign orders to a route')
    .argument('<id>', 'Route ID')
    .requiredOption('--orders <ids>', 'Comma-separated order IDs')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { orders: string; json?: boolean }) => {
      try {
        const api = getApi();
        const orderIds = opts.orders.split(',').map(s => s.trim());
        info(`Assigning ${orderIds.length} order(s) to route ${id}...`);
        const result = await api.post<Record<string, unknown>>('/api/orders/batch/assign', {
          routeId: id,
          orderIds,
        });
        if (opts.json) {
          output(result, true);
        } else {
          success('Orders assigned.');
          output(result, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
