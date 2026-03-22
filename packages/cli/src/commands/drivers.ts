import type { Command } from 'commander';
import { getApi } from '../api.js';
import { error, info, output, printTable } from '../output.js';

interface Driver {
  id: string;
  name: string;
  status: string;
  phone?: string;
  [key: string]: unknown;
}

export function registerDriverCommands(program: Command): void {
  const drivers = program
    .command('drivers')
    .description('Manage fleet drivers');

  drivers
    .command('list')
    .description('List all drivers')
    .option('--status <status>', 'Filter by status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; json?: boolean }) => {
      try {
        const api = getApi();
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        const qs = params.toString();
        const path = `/api/fleet/drivers${qs ? '?' + qs : ''}`;
        info('Fetching drivers...');
        const data = await api.get<Driver[] | { drivers: Driver[] }>(path);
        const list = Array.isArray(data) ? data : (data as { drivers: Driver[] }).drivers || [];

        if (opts.json) {
          output(list, true);
        } else {
          if (list.length === 0) {
            info('No drivers found.');
            return;
          }
          const headers = ['ID', 'Name', 'Status', 'Phone'];
          const rows = list.map((d: Driver) => [
            String(d.id ?? ''),
            String(d.name ?? ''),
            String(d.status ?? ''),
            String(d.phone ?? '-'),
          ]);
          printTable(headers, rows);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  drivers
    .command('available')
    .description('List available drivers')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info('Fetching available drivers...');
        const data = await api.get<Driver[] | { drivers: Driver[] }>('/api/fleet/drivers?status=available');
        const list = Array.isArray(data) ? data : (data as { drivers: Driver[] }).drivers || [];

        if (opts.json) {
          output(list, true);
        } else {
          if (list.length === 0) {
            info('No available drivers.');
            return;
          }
          const headers = ['ID', 'Name', 'Phone'];
          const rows = list.map((d: Driver) => [
            String(d.id ?? ''),
            String(d.name ?? ''),
            String(d.phone ?? '-'),
          ]);
          printTable(headers, rows);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
