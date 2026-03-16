import type { MigrationConnector, ExternalMigrationOrder, ExternalDriver, ExternalVehicle } from './connector.js';

const BASE_URL = 'https://api.getcircuit.com/public/v0.2b';
const RATE_LIMIT_MS = 100;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export class CircuitConnector implements MigrationConnector {
  platform = 'circuit';

  private headers(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  }

  async validateCredentials(apiKey: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/plans`, {
      headers: this.headers(apiKey),
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok;
  }

  async fetchOrders(apiKey: string, dateStart?: Date, dateEnd?: Date): Promise<ExternalMigrationOrder[]> {
    const allOrders: ExternalMigrationOrder[] = [];
    const hdrs = this.headers(apiKey);

    // Fetch plans first
    const plansRes = await fetch(`${BASE_URL}/plans`, {
      headers: hdrs,
      signal: AbortSignal.timeout(30_000),
    });
    if (!plansRes.ok) throw new Error(`Circuit API error: ${plansRes.status}`);
    const plansData = await plansRes.json() as { plans?: any[] };
    const plans = plansData.plans || [];

    // Filter plans by date range if provided
    const filteredPlans = plans.filter((p: any) => {
      if (!dateStart && !dateEnd) return true;
      const planDate = p.date ? new Date(p.date) : null;
      if (!planDate) return true;
      if (dateStart && planDate < dateStart) return false;
      if (dateEnd && planDate > dateEnd) return false;
      return true;
    });

    // Fetch stops for each plan
    for (const plan of filteredPlans) {
      const stopsRes = await fetch(`${BASE_URL}/plans/${plan.id}/stops`, {
        headers: hdrs,
        signal: AbortSignal.timeout(30_000),
      });
      if (!stopsRes.ok) continue;
      const stopsData = await stopsRes.json() as { stops?: any[] };

      for (const s of stopsData.stops || []) {
        const addr = s.address || {};
        allOrders.push({
          externalId: s.id || `circuit-${plan.id}-${allOrders.length}`,
          recipientName: s.recipient?.name || s.notes || 'Unknown',
          recipientPhone: s.recipient?.phone || null,
          recipientEmail: s.recipient?.email || null,
          deliveryAddress: {
            street: addr.addressLineOne || addr.addressLine1 || '',
            city: addr.city || '',
            state: addr.state || '',
            zip: addr.zip || addr.postalCode || '',
            country: addr.country || 'US',
            lat: addr.latitude ? Number(addr.latitude) : undefined,
            lng: addr.longitude ? Number(addr.longitude) : undefined,
          },
          packageCount: s.packages || s.packageCount || 1,
          weight: null,
          notes: s.notes || s.orderInfo?.note || null,
          createdAt: plan.date || new Date().toISOString(),
          rawData: s,
        });
      }
      await sleep(RATE_LIMIT_MS);
    }

    return allOrders;
  }

  async fetchDrivers(apiKey: string): Promise<ExternalDriver[]> {
    const res = await fetch(`${BASE_URL}/team/drivers`, {
      headers: this.headers(apiKey),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Circuit API error: ${res.status}`);
    const data = await res.json() as { drivers?: any[] };

    return (data.drivers || []).map((d: any) => ({
      externalId: d.id,
      name: d.name || d.email || 'Unknown',
      email: d.email || null,
      phone: d.phone || null,
      rawData: d,
    }));
  }

  async fetchVehicles(_apiKey: string): Promise<ExternalVehicle[]> {
    return [];
  }

  async getCounts(apiKey: string): Promise<{ orders?: number; drivers?: number; vehicles?: number }> {
    const hdrs = this.headers(apiKey);
    const [plansRes, driversRes] = await Promise.all([
      fetch(`${BASE_URL}/plans`, { headers: hdrs, signal: AbortSignal.timeout(30_000) }),
      fetch(`${BASE_URL}/team/drivers`, { headers: hdrs, signal: AbortSignal.timeout(30_000) }),
    ]);

    let orders: number | undefined;
    let drivers: number | undefined;
    if (plansRes.ok) {
      const d = await plansRes.json() as { plans?: any[] };
      // Estimate: count stops across recent plans
      orders = (d.plans || []).reduce((sum: number, p: any) => sum + (p.stopCount || 0), 0);
    }
    if (driversRes.ok) {
      const d = await driversRes.json() as { drivers?: any[] };
      drivers = d.drivers?.length;
    }
    return { orders, drivers };
  }
}
