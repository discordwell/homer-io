import type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';

const BASE_URL = 'https://api.optimoroute.com/v1';
const RATE_LIMIT_MS = 100;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export class OptimoRouteConnector implements MigrationConnector {
  platform = 'optimoroute';

  async validateCredentials(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/get_drivers?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  }

  async fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
    const allOrders: ExternalMigrationOrder[] = [];
    const start = dateStart || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const end = dateEnd || new Date();

    // OptimoRoute requires fetching day-by-day
    const current = new Date(start);
    while (current <= end) {
      const dateStr = formatDate(current);
      const res = await fetch(
        `${BASE_URL}/get_orders?key=${encodeURIComponent(apiKey)}&date=${dateStr}`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!res.ok) throw new Error(`OptimoRoute API error: ${res.status}`);
      const data = await res.json() as { orders?: any[] };

      for (const o of data.orders || []) {
        const loc = o.location || {};
        allOrders.push({
          externalId: o.orderNo || o.id || `opto-${dateStr}-${allOrders.length}`,
          recipientName: loc.locationName || o.orderNo || 'Unknown',
          recipientPhone: loc.phone || null,
          recipientEmail: loc.email || null,
          deliveryAddress: {
            street: loc.address || '',
            city: loc.city || '',
            state: loc.state || '',
            zip: loc.zip || '',
            country: loc.country || 'US',
            lat: loc.latitude ? Number(loc.latitude) : undefined,
            lng: loc.longitude ? Number(loc.longitude) : undefined,
          },
          packageCount: o.quantity || 1,
          weight: o.weight ? Number(o.weight) : null,
          notes: o.notes || null,
          createdAt: `${dateStr}T00:00:00Z`,
          rawData: o,
        });
      }

      current.setDate(current.getDate() + 1);
      await sleep(RATE_LIMIT_MS);
    }

    return allOrders;
  }

  async fetchDrivers(apiKey: string): Promise<ExternalDriver[]> {
    const res = await fetch(`${BASE_URL}/get_drivers?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`OptimoRoute API error: ${res.status}`);
    const data = await res.json() as { drivers?: any[] };

    return (data.drivers || []).map((d: any) => ({
      externalId: d.id || d.externalId || d.name,
      name: d.name || 'Unknown',
      email: d.email || null,
      phone: d.phone || null,
      rawData: d,
    }));
  }

  async fetchVehicles(_apiKey: string): Promise<ExternalVehicle[]> {
    return [];
  }

  async getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }> {
    // Fetch today's orders as a sample count + all drivers
    const today = formatDate(new Date());
    const [ordersRes, driversRes] = await Promise.all([
      fetch(`${BASE_URL}/get_orders?key=${encodeURIComponent(apiKey)}&date=${today}`, { signal: AbortSignal.timeout(30_000) }),
      fetch(`${BASE_URL}/get_drivers?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(30_000) }),
    ]);

    let orders: number | undefined;
    let drivers: number | undefined;
    if (ordersRes.ok) {
      const d = await ordersRes.json() as { orders?: any[] };
      orders = d.orders?.length;
    }
    if (driversRes.ok) {
      const d = await driversRes.json() as { drivers?: any[] };
      drivers = d.drivers?.length;
    }
    return { orders, drivers };
  }
}
