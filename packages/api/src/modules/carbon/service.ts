import { eq, and, sql, gte } from 'drizzle-orm';
import { fuelConsumption, co2PerLiter } from '@homer-io/shared';
import type { CarbonOverview, CarbonByDriver } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { routes } from '../../lib/db/schema/routes.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';

type VehicleType = keyof typeof fuelConsumption;
type FuelType = keyof typeof co2PerLiter;

function rangeToDays(range: '7d' | '30d' | '90d'): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
  }
}

function cutoffDate(range: '7d' | '30d' | '90d'): Date {
  const d = new Date();
  d.setDate(d.getDate() - rangeToDays(range));
  return d;
}

/**
 * Calculate CO2 emissions in kg for a given route.
 * Formula: (distance/100) x fuelConsumption[vehicleType][fuelType] x co2PerLiter[fuelType]
 */
export function calculateRouteCarbonKg(
  totalDistanceKm: number,
  vehicleType: string,
  fuelType: string,
): number {
  const vType = vehicleType as VehicleType;
  const fType = fuelType as FuelType;

  const consumption = fuelConsumption[vType]?.[fType] ?? 0;
  const co2Factor = co2PerLiter[fType] ?? 0;

  const co2Kg = (totalDistanceKm / 100) * consumption * co2Factor;
  return Math.round(co2Kg * 100) / 100;
}

/**
 * Get carbon overview across all completed routes for a tenant within a date range.
 */
export async function getCarbonOverview(
  tenantId: string,
  range: '7d' | '30d' | '90d',
): Promise<CarbonOverview> {
  const cutoff = cutoffDate(range);

  // Get all completed routes with vehicle info
  const completedRoutes = await db
    .select({
      totalDistance: routes.totalDistance,
      vehicleType: vehicles.type,
      fuelType: vehicles.fuelType,
    })
    .from(routes)
    .leftJoin(vehicles, eq(routes.vehicleId, vehicles.id))
    .where(
      and(
        eq(routes.tenantId, tenantId),
        eq(routes.status, 'completed'),
        gte(routes.createdAt, cutoff),
      ),
    );

  let totalCo2Kg = 0;
  let totalDistanceKm = 0;
  let evSavingsKg = 0;
  let greenCount = 0;

  for (const route of completedRoutes) {
    const distance = route.totalDistance ? Number(route.totalDistance) : 0;
    const vType = route.vehicleType ?? 'car';
    const fType = route.fuelType ?? 'gasoline';

    totalDistanceKm += distance;

    const co2 = calculateRouteCarbonKg(distance, vType, fType);
    totalCo2Kg += co2;

    // Track green deliveries (zero emission) and EV savings
    if (co2 === 0) {
      greenCount++;
      // Only count EV savings for electric vehicles (not human-powered bikes/cargo_bikes)
      if (fType === 'electric' && vType !== 'bike' && vType !== 'cargo_bike') {
        const gasolineEquivalent = calculateRouteCarbonKg(distance, vType, 'gasoline');
        evSavingsKg += gasolineEquivalent;
      }
    }
  }

  const routeCount = completedRoutes.length;

  return {
    totalCo2Kg: Math.round(totalCo2Kg * 100) / 100,
    totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    routeCount,
    evSavingsKg: Math.round(evSavingsKg * 100) / 100,
    greenDeliveryPercent: routeCount > 0
      ? Math.round((greenCount / routeCount) * 100 * 10) / 10
      : 0,
    avgCo2PerRouteKg: routeCount > 0
      ? Math.round((totalCo2Kg / routeCount) * 100) / 100
      : 0,
  };
}

/**
 * Get per-driver carbon breakdown within a date range.
 */
export async function getCarbonByDriver(
  tenantId: string,
  range: '7d' | '30d' | '90d',
): Promise<CarbonByDriver[]> {
  const cutoff = cutoffDate(range);

  // Get completed routes grouped by driver with vehicle info
  const routeData = await db
    .select({
      driverId: routes.driverId,
      driverName: drivers.name,
      totalDistance: routes.totalDistance,
      vehicleType: vehicles.type,
      fuelType: vehicles.fuelType,
    })
    .from(routes)
    .innerJoin(drivers, eq(routes.driverId, drivers.id))
    .leftJoin(vehicles, eq(routes.vehicleId, vehicles.id))
    .where(
      and(
        eq(routes.tenantId, tenantId),
        eq(routes.status, 'completed'),
        sql`${routes.driverId} IS NOT NULL`,
        gte(routes.createdAt, cutoff),
      ),
    );

  // Aggregate per driver
  const driverMap = new Map<string, {
    driverName: string;
    totalCo2Kg: number;
    totalDistanceKm: number;
    routeCount: number;
  }>();

  for (const row of routeData) {
    if (!row.driverId) continue;

    const distance = row.totalDistance ? Number(row.totalDistance) : 0;
    const co2 = calculateRouteCarbonKg(
      distance,
      row.vehicleType ?? 'car',
      row.fuelType ?? 'gasoline',
    );

    const existing = driverMap.get(row.driverId);
    if (existing) {
      existing.totalCo2Kg += co2;
      existing.totalDistanceKm += distance;
      existing.routeCount += 1;
    } else {
      driverMap.set(row.driverId, {
        driverName: row.driverName,
        totalCo2Kg: co2,
        totalDistanceKm: distance,
        routeCount: 1,
      });
    }
  }

  return Array.from(driverMap.entries())
    .map(([driverId, data]) => ({
      driverId,
      driverName: data.driverName,
      totalCo2Kg: Math.round(data.totalCo2Kg * 100) / 100,
      totalDistanceKm: Math.round(data.totalDistanceKm * 100) / 100,
      routeCount: data.routeCount,
    }))
    .sort((a, b) => b.totalCo2Kg - a.totalCo2Kg);
}
