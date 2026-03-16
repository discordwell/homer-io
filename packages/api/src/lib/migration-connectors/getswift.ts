import type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';

const BASE_URL = 'https://app.getswift.co/api/v2';
const RATE_LIMIT_MS = 100;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export class GetSwiftConnector implements MigrationConnector {
  platform = 'getswift';

  async validateCredentials(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/drivers`, {
      headers: { 'api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  }

  async fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
    const allOrders: ExternalMigrationOrder[] = [];
    let page = 1;

    while (true) {
      const params = new URLSearchParams({ page: String(page), pageSize: '100' });
      if (dateStart) params.set('fromDate', dateStart.toISOString());
      if (dateEnd) params.set('toDate', dateEnd.toISOString());

      const res = await fetch(`${BASE_URL}/deliveries?${params.toString()}`, {
        headers: { 'api-key': apiKey },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`GetSwift API error: ${res.status}`);
      const data = await res.json() as { data?: any[]; totalPages?: number } | any[];
      const items = Array.isArray(data) ? data : data.data ?? [];
      if (!items.length) break;

      for (const d of items) {
        const dropoff = d.dropoffDetail || d.delivery || {};
        allOrders.push({
          externalId: d.id || d.reference || String(allOrders.length),
          recipientName: dropoff.name || d.customerName || 'Unknown',
          recipientPhone: dropoff.phone || d.customerPhone || null,
          recipientEmail: dropoff.email || d.customerEmail || null,
          deliveryAddress: {
            street: dropoff.address || '',
            city: dropoff.city || '',
            state: dropoff.state || '',
            zip: dropoff.postcode || dropoff.zip || '',
            country: dropoff.country || 'US',
            lat: dropoff.latitude ? Number(dropoff.latitude) : undefined,
            lng: dropoff.longitude ? Number(dropoff.longitude) : undefined,
          },
          packageCount: d.itemCount || 1,
          weight: d.weight ? Number(d.weight) : null,
          notes: d.instructions || d.notes || null,
          createdAt: d.created || d.createdDate || new Date().toISOString(),
          rawData: d,
        });
      }

      const totalPages = Array.isArray(data) ? 1 : (data.totalPages ?? 1);
      if (page >= totalPages) break;
      page++;
      await sleep(RATE_LIMIT_MS);
    }

    return allOrders;
  }

  async fetchDrivers(apiKey: string): Promise<ExternalDriver[]> {
    const res = await fetch(`${BASE_URL}/drivers`, {
      headers: { 'api-key': apiKey },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`GetSwift API error: ${res.status}`);
    const data = await res.json() as any[];

    return (data || []).map((d: any) => ({
      externalId: d.id || d.driverId,
      name: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown',
      email: d.email || null,
      phone: d.phone || null,
      rawData: d,
    }));
  }

  async fetchVehicles(_apiKey: string): Promise<ExternalVehicle[]> {
    return [];
  }

  async getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }> {
    const [deliveriesRes, driversRes] = await Promise.all([
      fetch(`${BASE_URL}/deliveries?page=1&pageSize=1`, { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(30_000) }),
      fetch(`${BASE_URL}/drivers`, { headers: { 'api-key': apiKey }, signal: AbortSignal.timeout(30_000) }),
    ]);

    let orders: number | undefined;
    let drivers: number | undefined;
    if (deliveriesRes.ok) {
      const d = await deliveriesRes.json() as { totalCount?: number; data?: any[] } | any[];
      orders = Array.isArray(d) ? d.length : d.totalCount;
    }
    if (driversRes.ok) {
      const d = await driversRes.json() as any[];
      drivers = d.length;
    }
    return { orders, drivers };
  }
}
