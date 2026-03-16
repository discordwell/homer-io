import type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';

const BASE_URL = 'https://onfleet.com/api/v2';
const RATE_LIMIT_MS = 50;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function basicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;
}

export class OnfleetConnector implements MigrationConnector {
  platform = 'onfleet';

  async validateCredentials(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/organization`, {
      headers: { Authorization: basicAuth(apiKey) },
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  }

  async fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
    const allOrders: ExternalMigrationOrder[] = [];
    const auth = basicAuth(apiKey);
    let lastId: string | undefined;

    while (true) {
      const params = new URLSearchParams();
      if (dateStart) params.set('from', String(dateStart.getTime()));
      if (dateEnd) params.set('to', String(dateEnd.getTime()));
      if (lastId) params.set('lastId', lastId);

      const url = `${BASE_URL}/tasks/all?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`Onfleet API error: ${res.status}`);
      const data = await res.json() as { tasks?: any[]; lastId?: string };
      const tasks = data.tasks ?? (Array.isArray(data) ? data : []);
      if (!tasks.length) break;

      for (const t of tasks) {
        const dest = t.destination || {};
        const addr = dest.address || {};
        const loc = dest.location || [];
        const recip = t.recipients?.[0] || {};
        allOrders.push({
          externalId: t.id || t.shortId,
          recipientName: recip.name || 'Unknown',
          recipientPhone: recip.phone || null,
          recipientEmail: null,
          deliveryAddress: {
            street: addr.street || addr.number ? `${addr.number || ''} ${addr.street || ''}`.trim() : '',
            city: addr.city || '',
            state: addr.state || '',
            zip: addr.postalCode || '',
            country: addr.country || 'US',
            lng: loc[0] || undefined,
            lat: loc[1] || undefined,
          },
          packageCount: t.quantity || 1,
          weight: null,
          notes: t.notes || null,
          createdAt: t.timeCreated ? new Date(t.timeCreated).toISOString() : new Date().toISOString(),
          rawData: t,
        });
      }

      lastId = data.lastId;
      if (!lastId || tasks.length < 64) break;
      await sleep(RATE_LIMIT_MS);
    }

    return allOrders;
  }

  async fetchDrivers(apiKey: string): Promise<ExternalDriver[]> {
    const res = await fetch(`${BASE_URL}/workers`, {
      headers: { Authorization: basicAuth(apiKey) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Onfleet API error: ${res.status}`);
    const workers = await res.json() as any[];

    return workers.map((w: any) => ({
      externalId: w.id,
      name: w.name || 'Unknown',
      email: w.email || null,
      phone: w.phone || null,
      rawData: w,
    }));
  }

  async fetchVehicles(apiKey: string): Promise<ExternalVehicle[]> {
    const res = await fetch(`${BASE_URL}/vehicles`, {
      headers: { Authorization: basicAuth(apiKey) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return [];
    const vehicles = await res.json() as any[];

    return vehicles.map((v: any) => ({
      externalId: v.id,
      name: v.description || v.type || 'Vehicle',
      type: v.type || 'van',
      licensePlate: v.licensePlate || null,
      rawData: v,
    }));
  }

  async getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }> {
    const auth = basicAuth(apiKey);
    const [tasksRes, workersRes, vehiclesRes] = await Promise.all([
      fetch(`${BASE_URL}/tasks/all`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) }),
      fetch(`${BASE_URL}/workers`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) }),
      fetch(`${BASE_URL}/vehicles`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(30_000) }),
    ]);

    let orders: number | undefined;
    let drivers: number | undefined;
    let vehicles: number | undefined;

    if (tasksRes.ok) {
      const d = await tasksRes.json() as { tasks?: any[] } | any[];
      const tasks = Array.isArray(d) ? d : d.tasks ?? [];
      orders = tasks.length;
    }
    if (workersRes.ok) {
      const d = await workersRes.json() as any[];
      drivers = d.length;
    }
    if (vehiclesRes.ok) {
      const d = await vehiclesRes.json() as any[];
      vehicles = d.length;
    }

    return { orders, drivers, vehicles };
  }
}
