import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getApi } from '../api.js';
import { success, error, info, output, printTable } from '../output.js';

interface Order {
  id: string;
  status: string;
  recipientName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  notes?: string;
  giftMessage?: string;
  senderName?: string;
  [key: string]: unknown;
}

export function registerOrderCommands(program: Command): void {
  const orders = program
    .command('orders')
    .description('Manage delivery orders');

  orders
    .command('list')
    .description('List orders')
    .option('--status <status>', 'Filter by status')
    .option('--limit <n>', 'Max results', '50')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; limit: string; json?: boolean }) => {
      try {
        const api = getApi();
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        if (opts.limit) params.set('limit', opts.limit);
        const qs = params.toString();
        const path = `/api/orders${qs ? '?' + qs : ''}`;
        info('Fetching orders...');
        const data = await api.get<Order[] | { orders: Order[] }>(path);
        const list = Array.isArray(data) ? data : (data as { orders: Order[] }).orders || [];

        if (opts.json) {
          output(list, true);
        } else {
          if (list.length === 0) {
            info('No orders found.');
            return;
          }
          const headers = ['ID', 'Status', 'Recipient', 'City', 'State'];
          const rows = list.map((o: Order) => [
            String(o.id ?? ''),
            String(o.status ?? ''),
            String(o.recipientName ?? ''),
            String(o.city ?? ''),
            String(o.state ?? ''),
          ]);
          printTable(headers, rows);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  orders
    .command('get')
    .description('Get order details')
    .argument('<id>', 'Order ID')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        const api = getApi();
        const order = await api.get<Order>(`/api/orders/${id}`);
        output(order, !!opts.json);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  orders
    .command('create')
    .description('Create a new order')
    .requiredOption('--recipient <name>', 'Recipient name')
    .requiredOption('--street <street>', 'Street address')
    .requiredOption('--city <city>', 'City')
    .requiredOption('--state <st>', 'State')
    .requiredOption('--zip <zip>', 'ZIP code')
    .option('--phone <ph>', 'Phone number')
    .option('--notes <n>', 'Delivery notes')
    .option('--gift-message <msg>', 'Gift message')
    .option('--sender <name>', 'Sender name')
    .option('--json', 'Output as JSON')
    .action(async (opts: {
      recipient: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      phone?: string;
      notes?: string;
      giftMessage?: string;
      sender?: string;
      json?: boolean;
    }) => {
      try {
        const api = getApi();
        const body: Record<string, unknown> = {
          recipientName: opts.recipient,
          street: opts.street,
          city: opts.city,
          state: opts.state,
          zip: opts.zip,
        };
        if (opts.phone) body.phone = opts.phone;
        if (opts.notes) body.notes = opts.notes;
        if (opts.giftMessage) body.giftMessage = opts.giftMessage;
        if (opts.sender) body.senderName = opts.sender;

        info('Creating order...');
        const order = await api.post<Order>('/api/orders', body);
        if (opts.json) {
          output(order, true);
        } else {
          success(`Order created: ${(order as Order).id ?? 'OK'}`);
          output(order, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  orders
    .command('import')
    .description('Import orders from a CSV file')
    .argument('<file>', 'Path to CSV file')
    .option('--json', 'Output as JSON')
    .action(async (file: string, opts: { json?: boolean }) => {
      try {
        const api = getApi();
        info(`Reading ${file}...`);
        const csv = readFileSync(file, 'utf-8');
        info('Uploading CSV...');
        const result = await api.post<Record<string, unknown>>(
          '/api/orders/import/csv',
          csv,
          'text/csv',
        );
        if (opts.json) {
          output(result, true);
        } else {
          success('Import complete.');
          output(result, false);
        }
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  orders
    .command('count')
    .description('Count orders')
    .option('--status <status>', 'Filter by status')
    .action(async (opts: { status?: string }) => {
      try {
        const api = getApi();
        const params = new URLSearchParams();
        if (opts.status) params.set('status', opts.status);
        const qs = params.toString();
        const path = `/api/orders${qs ? '?' + qs : ''}`;
        info('Counting orders...');
        const data = await api.get<Order[] | { orders: Order[] }>(path);
        const list = Array.isArray(data) ? data : (data as { orders: Order[] }).orders || [];
        console.log(list.length);
      } catch (err) {
        error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
