import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { routes } from '../../lib/db/schema/routes.js';
import { orders } from '../../lib/db/schema/orders.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { findDriverByUserId } from '../tracking/service.js';
import { NotFoundError } from '../../lib/errors.js';
import { logActivity } from '../../lib/activity.js';

/**
 * Get the current in-progress route for a driver, with ordered stops.
 */
export async function getCurrentRoute(tenantId: string, userId: string) {
  const driverId = await findDriverByUserId(tenantId, userId);
  if (!driverId) throw new NotFoundError('No driver profile linked to this user');

  const [route] = await db
    .select()
    .from(routes)
    .where(
      and(
        eq(routes.tenantId, tenantId),
        eq(routes.driverId, driverId),
        eq(routes.status, 'in_progress'),
      ),
    )
    .limit(1);

  if (!route) return null;

  // Fetch ordered stops (orders on this route)
  const stops = await db
    .select()
    .from(orders)
    .where(and(eq(orders.routeId, route.id), eq(orders.tenantId, tenantId)))
    .orderBy(orders.stopSequence);

  // HIPAA-safe display: strip PHI from notes for pharmacy tenants
  const [tenant] = await db.select({ industry: tenants.industry })
    .from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  const sanitizedStops = tenant?.industry === 'pharmacy'
    ? stops.map(stop => ({
        ...stop,
        notes: stop.hipaaSafeNotes || 'Prescription delivery', // Replace PHI notes with safe version
      }))
    : stops;

  return { ...route, orders: sanitizedStops };
}

/**
 * Get upcoming planned routes for a driver.
 */
export async function getUpcomingRoutes(tenantId: string, userId: string) {
  const driverId = await findDriverByUserId(tenantId, userId);
  if (!driverId) throw new NotFoundError('No driver profile linked to this user');

  const planned = await db
    .select()
    .from(routes)
    .where(
      and(
        eq(routes.tenantId, tenantId),
        eq(routes.driverId, driverId),
        eq(routes.status, 'planned'),
      ),
    )
    .orderBy(routes.plannedStartAt);

  return planned;
}

/**
 * Update the driver's availability status.
 */
export async function updateDriverStatus(
  tenantId: string,
  userId: string,
  status: 'available' | 'offline' | 'on_break',
) {
  const driverId = await findDriverByUserId(tenantId, userId);
  if (!driverId) throw new NotFoundError('No driver profile linked to this user');

  await db
    .update(drivers)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(drivers.id, driverId), eq(drivers.tenantId, tenantId)));

  logActivity({ tenantId, action: 'driver_status_updated', entityType: 'driver', metadata: { newStatus: status } });

  return { success: true, status };
}

/**
 * Get driver profile details for the current user.
 */
export async function getDriverProfile(tenantId: string, userId: string) {
  const [driver] = await db
    .select()
    .from(drivers)
    .where(and(eq(drivers.tenantId, tenantId), eq(drivers.userId, userId)))
    .limit(1);

  if (!driver) throw new NotFoundError('No driver profile linked to this user');
  return driver;
}
