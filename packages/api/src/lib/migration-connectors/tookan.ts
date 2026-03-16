import type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';

const BASE_URL = 'https://api.tookanapp.com/v2';
const RATE_LIMIT_MS = 100;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export class TookanConnector implements MigrationConnector {
  platform = 'tookan';

  async validateCredentials(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/get_all_team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { status: number };
    return data.status === 200;
  }

  async fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
    const allOrders: ExternalMigrationOrder[] = [];
    let page = 0;
    const startDate = dateStart ? dateStart.toISOString().split('T')[0] : undefined;
    const endDate = dateEnd ? dateEnd.toISOString().split('T')[0] : undefined;

    while (true) {
      const body: Record<string, unknown> = {
        api_key: apiKey,
        job_type: 0, // all types
        job_status: '0,1,2,3,4,5,6,7,8,9',
        requested_page: page,
      };
      if (startDate) body.start_date = startDate;
      if (endDate) body.end_date = endDate;

      const res = await fetch(`${BASE_URL}/get_all_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Tookan API error: ${res.status}`);
      const data = await res.json() as { status: number; data: any[]; total_page_count?: number };
      if (data.status !== 200 || !data.data?.length) break;

      for (const t of data.data) {
        allOrders.push({
          externalId: String(t.job_id || t.order_id),
          recipientName: t.customer_username || t.customer_email || 'Unknown',
          recipientPhone: t.customer_phone || null,
          recipientEmail: t.customer_email || null,
          deliveryAddress: {
            street: t.job_address || '',
            city: t.job_city || '',
            state: t.job_state || '',
            zip: t.job_zipcode || '',
            country: t.job_country || 'US',
            lat: t.job_latitude ? Number(t.job_latitude) : undefined,
            lng: t.job_longitude ? Number(t.job_longitude) : undefined,
          },
          packageCount: t.no_of_packages ? parseInt(t.no_of_packages) || 1 : 1,
          weight: null,
          notes: t.job_description || null,
          createdAt: t.creation_datetime || new Date().toISOString(),
          rawData: t,
        });
      }

      const totalPages = data.total_page_count ?? 1;
      page++;
      if (page >= totalPages) break;
      await sleep(RATE_LIMIT_MS);
    }

    return allOrders;
  }

  async fetchDrivers(apiKey: string): Promise<ExternalDriver[]> {
    const res = await fetch(`${BASE_URL}/get_available_agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Tookan API error: ${res.status}`);
    const data = await res.json() as { status: number; data: any[] };
    if (data.status !== 200 || !data.data) return [];

    return data.data.map((a: any) => ({
      externalId: String(a.fleet_id),
      name: a.username || a.fleet_name || 'Unknown',
      email: a.email || null,
      phone: a.phone || null,
      rawData: a,
    }));
  }

  async fetchVehicles(_apiKey: string): Promise<ExternalVehicle[]> {
    return [];
  }

  async getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }> {
    const [ordersRes, driversRes] = await Promise.all([
      fetch(`${BASE_URL}/get_all_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, job_type: 0, job_status: '0,1,2,3,4,5,6,7,8,9', requested_page: 0 }),
        signal: AbortSignal.timeout(30_000),
      }),
      fetch(`${BASE_URL}/get_available_agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
        signal: AbortSignal.timeout(30_000),
      }),
    ]);

    let orders: number | undefined;
    let drivers: number | undefined;
    if (ordersRes.ok) {
      const d = await ordersRes.json() as { total_task_count?: number };
      orders = d.total_task_count;
    }
    if (driversRes.ok) {
      const d = await driversRes.json() as { data?: any[] };
      drivers = d.data?.length;
    }
    return { orders, drivers };
  }
}
