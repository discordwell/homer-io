import { eq } from 'drizzle-orm';
import type { Industry } from '@homer-io/shared';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';
import { generateLocalAddresses, getNearestCity, type GeneratedAddress } from '../../lib/geocoding.js';
import { generateIndustryOrders, pickIndustryItem } from './industry-data.js';

// ---------------------------------------------------------------------------
// Bay Area locations (24 total, all within lat 37.2–38.0, lng -122.6 to -121.7)
// ---------------------------------------------------------------------------

export const BAY_AREA_LOCATIONS = [
  { name: '555 Market St, San Francisco', lat: 37.7900, lng: -122.4000 },
  { name: '1 Ferry Building, San Francisco', lat: 37.7956, lng: -122.3935 },
  { name: '900 North Point St, San Francisco', lat: 37.8060, lng: -122.4210 },
  { name: '3251 20th Ave, San Francisco', lat: 37.7290, lng: -122.4750 },
  { name: '2100 University Ave, Berkeley', lat: 37.8720, lng: -122.2680 },
  { name: '1955 Broadway, Oakland', lat: 37.8120, lng: -122.2690 },
  { name: '5959 Shellmound St, Emeryville', lat: 37.8390, lng: -122.2930 },
  { name: '1600 Saratoga Ave, San Jose', lat: 37.2800, lng: -121.9980 },
  { name: '355 Santana Row, San Jose', lat: 37.3210, lng: -121.9480 },
  { name: '100 El Camino Real, Palo Alto', lat: 37.4420, lng: -122.1630 },
  { name: '300 University Ave, Palo Alto', lat: 37.4480, lng: -122.1590 },
  { name: '1450 Burlingame Ave, Burlingame', lat: 37.5790, lng: -122.3440 },
  { name: '1 Hacker Way, Menlo Park', lat: 37.4850, lng: -122.1480 },
  { name: '2855 Stevens Creek Blvd, Santa Clara', lat: 37.3240, lng: -121.9690 },
  { name: '100 Broadway, Millbrae', lat: 37.5985, lng: -122.3870 },
  { name: '333 Main St, Redwood City', lat: 37.4860, lng: -122.2290 },
  { name: '1250 Fourth St, San Rafael', lat: 37.9720, lng: -122.5100 },
  { name: '80 E 4th Ave, San Mateo', lat: 37.5650, lng: -122.3240 },
  { name: '1001 Marina Village Pkwy, Alameda', lat: 37.7790, lng: -122.2480 },
  { name: '2700 Ygnacio Valley Rd, Walnut Creek', lat: 37.9020, lng: -122.0650 },
  { name: '1999 Harrison St, Oakland', lat: 37.8080, lng: -122.2630 },
  { name: '39 Mesa St, San Francisco', lat: 37.7610, lng: -122.4130 },
  { name: '699 Lewelling Blvd, San Leandro', lat: 37.7060, lng: -122.1250 },
  { name: '3000 El Cerrito Plaza, El Cerrito', lat: 37.9020, lng: -122.3000 },
];

// ---------------------------------------------------------------------------
// Demo vehicle definitions
// ---------------------------------------------------------------------------

const DEMO_VEHICLES = [
  { name: 'Van #1 — Sprinter', type: 'van' as const },
  { name: 'Van #2 — Transit', type: 'van' as const },
  { name: 'Sedan #1 — Civic', type: 'car' as const },
  { name: 'Cargo Bike #1', type: 'cargo_bike' as const },
];

export function generateDemoVehicles() {
  return DEMO_VEHICLES.map(v => ({ name: v.name, type: v.type }));
}

// ---------------------------------------------------------------------------
// Demo driver names
// ---------------------------------------------------------------------------

const DRIVER_NAME_POOL = [
  'Alex Rivera', 'Jordan Chen', 'Sam Okafor', 'Morgan Patel',
  'Casey Nguyen', 'Taylor Kim', 'Jamie Santos', 'Reese Washington',
  'Avery Lopez', 'Quinn Bergstrom',
];

export function generateDemoDriverNames(): string[] {
  // Pick 5 unique random names from the pool
  const shuffled = [...DRIVER_NAME_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Demo order generation
// ---------------------------------------------------------------------------

export const RECIPIENT_FIRST = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'James', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia',
  'Henry', 'Harper', 'Alexander', 'Evelyn', 'Daniel',
];

export const RECIPIENT_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
];

export function generateDemoOrders(locationOverrides?: GeneratedAddress[], industry?: Industry) {
  const count = 15 + Math.floor(Math.random() * 6); // 15–20
  const locs: Array<{ name: string; lat: number; lng: number; city?: string; state?: string; zip?: string }> = locationOverrides
    ? [...locationOverrides].sort(() => Math.random() - 0.5)
    : [...BAY_AREA_LOCATIONS].sort(() => Math.random() - 0.5);

  // When industry is provided, use the richer industry-aware generator
  if (industry) {
    return generateIndustryOrders(industry, count, locs);
  }

  // Fallback: generic orders (backward compat)
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const loc = locs[i % locs.length];
    const first = RECIPIENT_FIRST[Math.floor(Math.random() * RECIPIENT_FIRST.length)];
    const last = RECIPIENT_LAST[Math.floor(Math.random() * RECIPIENT_LAST.length)];

    const createdAt = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      6 + Math.floor(i / 5), (i * 7) % 60, 0, 0,
    ));

    const city = 'city' in loc ? (loc as GeneratedAddress).city : '';
    const state = 'state' in loc ? (loc as GeneratedAddress).state : 'CA';
    const zip = 'zip' in loc ? (loc as GeneratedAddress).zip : '';

    return {
      recipientName: `${first} ${last}`,
      deliveryAddress: { street: loc.name, city, state, zip },
      deliveryLat: loc.lat.toString(),
      deliveryLng: loc.lng.toString(),
      createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Main seed function — inserts vehicles, drivers, orders, routes
// ---------------------------------------------------------------------------

export interface SeedDemoOptions {
  lat?: number;
  lng?: number;
  industry?: Industry;
}

export async function seedDemoOrg(tenantId: string, options?: SeedDemoOptions): Promise<void> {
  const now = new Date();

  // Resolve locations: use generated local addresses if lat/lng provided
  let locationList: Array<{ name: string; lat: number; lng: number; city?: string; state?: string; zip?: string }>;
  let cityContext: { city: string; state: string };

  if (options?.lat != null && options?.lng != null) {
    const generated = await generateLocalAddresses(options.lat, options.lng, 24);
    locationList = generated;
    cityContext = { city: generated[0].city, state: generated[0].state };
  } else {
    locationList = BAY_AREA_LOCATIONS;
    cityContext = { city: 'San Francisco', state: 'CA' };
  }

  // --- Vehicles ---
  const vehicleData = generateDemoVehicles();
  const insertedVehicles = await db
    .insert(vehicles)
    .values(
      vehicleData.map(v => ({
        tenantId,
        name: v.name,
        type: v.type,
      })),
    )
    .returning({ id: vehicles.id });

  // --- Drivers ---
  const driverNames = generateDemoDriverNames();
  const driverStatuses = ['available', 'on_route', 'on_route', 'available', 'offline'] as const;
  const driverLocations = [...locationList].sort(() => Math.random() - 0.5).slice(0, 5);
  const insertedDrivers = await db
    .insert(drivers)
    .values(
      driverNames.map((name, i) => ({
        tenantId,
        name,
        email: `${name.toLowerCase().replace(' ', '.')}@demo.homer.io`,
        phone: `555-${String(2000 + i).slice(-4)}`,
        status: driverStatuses[i],
        currentVehicleId: i < insertedVehicles.length ? insertedVehicles[i].id : null,
        currentLat: String(driverLocations[i].lat + (Math.random() - 0.5) * 0.01),
        currentLng: String(driverLocations[i].lng + (Math.random() - 0.5) * 0.01),
        lastLocationAt: new Date(),
      })),
    )
    .returning({ id: drivers.id });

  // Set industry on tenant if provided
  const industry = options?.industry ?? 'courier';
  await db.update(tenants).set({ industry, updatedAt: new Date() }).where(eq(tenants.id, tenantId));

  // --- Orders ---
  const generatedAddresses = options?.lat != null ? locationList as GeneratedAddress[] : undefined;
  const orderData = generateDemoOrders(generatedAddresses, industry);
  const insertedOrders = await db
    .insert(orders)
    .values(
      orderData.map(o => {
        const base: Record<string, unknown> = {
          tenantId,
          recipientName: o.recipientName,
          deliveryAddress: o.deliveryAddress,
          deliveryLat: o.deliveryLat,
          deliveryLng: o.deliveryLng,
          status: 'received' as const,
          createdAt: o.createdAt,
        };
        if ('notes' in o && o.notes) base.notes = o.notes;
        if ('requiresSignature' in o) base.requiresSignature = o.requiresSignature;
        if ('requiresPhoto' in o) base.requiresPhoto = o.requiresPhoto;
        if ('serviceDurationMinutes' in o) base.serviceDurationMinutes = o.serviceDurationMinutes;
        if ('priority' in o) base.priority = o.priority;
        if ('packageCount' in o) base.packageCount = o.packageCount;
        if ('weight' in o && o.weight) base.weight = o.weight;
        if ('customFields' in o) base.customFields = o.customFields;
        if ('senderName' in o && o.senderName) base.senderName = o.senderName;
        if ('senderEmail' in o && o.senderEmail) base.senderEmail = o.senderEmail;
        if ('giftMessage' in o && o.giftMessage) base.giftMessage = o.giftMessage;
        if ('isGift' in o) base.isGift = o.isGift;
        // Pharmacy fields
        if ('isControlledSubstance' in o) base.isControlledSubstance = o.isControlledSubstance;
        if ('controlledSchedule' in o) base.controlledSchedule = o.controlledSchedule;
        if ('isColdChain' in o) base.isColdChain = o.isColdChain;
        if ('patientDob' in o) base.patientDob = o.patientDob;
        if ('prescriberName' in o) base.prescriberName = o.prescriberName;
        if ('prescriberNpi' in o) base.prescriberNpi = o.prescriberNpi;
        if ('hipaaSafeNotes' in o) base.hipaaSafeNotes = o.hipaaSafeNotes;
        return base;
      }) as Array<typeof orders.$inferInsert>,
    )
    .returning({ id: orders.id });

  // --- Routes (3: completed, in_progress, draft) ---
  const depotLoc = locationList[0];
  const baseRoute = {
    tenantId,
    depotAddress: { street: depotLoc.name, city: cityContext.city, state: cityContext.state, zip: (depotLoc as GeneratedAddress).zip || '' },
    depotLat: depotLoc.lat.toString(),
    depotLng: depotLoc.lng.toString(),
  };

  // Partition orders across routes: first 6 → completed, next 5 → in_progress, rest → draft
  const completedOrderIds = insertedOrders.slice(0, 6).map(o => o.id);
  const inProgressOrderIds = insertedOrders.slice(6, 11).map(o => o.id);
  const draftOrderIds = insertedOrders.slice(11).map(o => o.id);

  // Route 1: completed
  const [completedRoute] = await db
    .insert(routes)
    .values({
      ...baseRoute,
      name: `Morning ${cityContext.city} Route`,
      status: 'completed',
      driverId: insertedDrivers[0]?.id ?? null,
      vehicleId: insertedVehicles[0]?.id ?? null,
      totalStops: completedOrderIds.length,
      completedStops: completedOrderIds.length,
      plannedStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0),
      actualStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 5),
      actualEndAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30),
    })
    .returning({ id: routes.id });

  // Mark completed orders
  for (const orderId of completedOrderIds) {
    await db
      .update(orders)
      .set({
        status: 'delivered',
        routeId: completedRoute.id,
        completedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60)),
      })
      .where(eq(orders.id, orderId));
  }

  // Route 2: in_progress
  const [activeRoute] = await db
    .insert(routes)
    .values({
      ...baseRoute,
      name: `Midday ${cityContext.city} Route`,
      status: 'in_progress',
      driverId: insertedDrivers[1]?.id ?? null,
      vehicleId: insertedVehicles[1]?.id ?? null,
      totalStops: inProgressOrderIds.length,
      completedStops: 2,
      plannedStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0),
      actualStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 10),
    })
    .returning({ id: routes.id });

  // Assign in-progress orders
  for (let i = 0; i < inProgressOrderIds.length; i++) {
    await db
      .update(orders)
      .set({
        status: i < 2 ? 'delivered' : 'in_transit',
        routeId: activeRoute.id,
        stopSequence: i + 1,
        ...(i < 2 ? { completedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30 + i * 15) } : {}),
      })
      .where(eq(orders.id, inProgressOrderIds[i]));
  }

  // Route 3: draft (afternoon)
  const [draftRoute] = await db
    .insert(routes)
    .values({
      ...baseRoute,
      name: `Afternoon ${cityContext.city} Route`,
      status: 'draft',
      totalStops: draftOrderIds.length,
      completedStops: 0,
      plannedStartAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
    })
    .returning({ id: routes.id });

  // Assign draft orders
  for (let i = 0; i < draftOrderIds.length; i++) {
    await db
      .update(orders)
      .set({
        status: 'assigned',
        routeId: draftRoute.id,
        stopSequence: i + 1,
      })
      .where(eq(orders.id, draftOrderIds[i]));
  }

  // Update driver on active route to on_route
  if (insertedDrivers[1]) {
    await db
      .update(drivers)
      .set({ status: 'on_route' })
      .where(eq(drivers.id, insertedDrivers[1].id));
  }

  // --- Historical analytics data (90 days of realistic orders + routes) ---
  await seedDemoAnalytics(tenantId, insertedDrivers.map(d => d.id), insertedVehicles.map(v => v.id), locationList, cityContext, industry);
}

// ---------------------------------------------------------------------------
// 90-day historical data for analytics — creates ~700 orders, ~50 routes
// with deliberate patterns for the insights engine to detect
// ---------------------------------------------------------------------------

type FailureCategory = 'not_home' | 'access_denied' | 'wrong_address' | 'refused' | 'other';
const FAILURE_CATEGORIES: FailureCategory[] = ['not_home', 'access_denied', 'wrong_address', 'refused', 'other'];
const FAILURE_WEIGHTS = [40, 20, 15, 10, 15]; // cumulative probability

function pickFailureCategory(): FailureCategory {
  const r = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < FAILURE_CATEGORIES.length; i++) {
    cumulative += FAILURE_WEIGHTS[i];
    if (r < cumulative) return FAILURE_CATEGORIES[i];
  }
  return 'other';
}

// Seeded random for reproducible demo data
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Driver performance profiles: [successRate, avgTimeMinutes, volumeWeight]
const DRIVER_PROFILES = [
  { successRate: 0.97, avgTimeMin: 28, volumeWeight: 1.2, label: 'star' },
  { successRate: 0.93, avgTimeMin: 35, volumeWeight: 1.0, label: 'reliable' },
  { successRate: 0.85, avgTimeMin: 42, volumeWeight: 0.9, label: 'new_hire' },
  { successRate: 0.78, avgTimeMin: 48, volumeWeight: 0.7, label: 'struggling' },
  { successRate: 0.95, avgTimeMin: 30, volumeWeight: 0.5, label: 'part_timer' },
];

export async function seedDemoAnalytics(
  tenantId: string,
  driverIds: string[],
  vehicleIds: string[],
  locationPool?: Array<{ name: string; lat: number; lng: number; city?: string; state?: string; zip?: string }>,
  cityCtx?: { city: string; state: string },
  industry?: Industry,
): Promise<void> {
  const locations = locationPool || BAY_AREA_LOCATIONS;
  const depotCity = cityCtx?.city || 'San Francisco';
  const depotState = cityCtx?.state || 'CA';
  const rand = seededRandom(42);
  const now = new Date();
  const allOrders: Array<{
    tenantId: string;
    recipientName: string;
    deliveryAddress: { street: string; city: string; state: string; zip: string };
    deliveryLat: string;
    deliveryLng: string;
    status: 'delivered' | 'failed';
    createdAt: Date;
    completedAt: Date | null;
    failureCategory: FailureCategory | null;
    timeWindowStart: Date | null;
    timeWindowEnd: Date | null;
    notes: string | null;
  }> = [];

  const allRoutes: Array<{
    tenantId: string;
    name: string;
    status: 'completed';
    driverId: string;
    vehicleId: string;
    depotAddress: { street: string; city: string; state: string; zip: string };
    depotLat: string;
    depotLng: string;
    totalStops: number;
    completedStops: number;
    totalDuration: number;
    totalDistance: string;
    plannedStartAt: Date;
    actualStartAt: Date;
    actualEndAt: Date;
    createdAt: Date;
  }> = [];

  const depotLoc = locations[0];

  // Generate 90 days of data (skip today — today's data is the real-time seed above)
  for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    // Volume: ramp from ~5/day to ~15/day, weekdays heavier
    const progress = (90 - daysAgo) / 90; // 0 → 1 over the period
    const baseVolume = 5 + progress * 10;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayVolume = Math.round(baseVolume * (isWeekend ? 0.4 : 1.0) + (rand() - 0.5) * 4);
    if (dayVolume <= 0) continue;

    // Assign orders to 1-3 routes for this day
    const routeCount = Math.max(1, Math.min(3, Math.floor(dayVolume / 5)));
    const ordersPerRoute = Math.ceil(dayVolume / routeCount);

    for (let ri = 0; ri < routeCount; ri++) {
      const driverIdx = (daysAgo * 3 + ri) % Math.min(driverIds.length, DRIVER_PROFILES.length);
      const profile = DRIVER_PROFILES[driverIdx];
      const driverId = driverIds[driverIdx];
      const vehicleId = vehicleIds[ri % vehicleIds.length];

      // Route timing
      const startHour = 7 + ri * 3 + Math.floor(rand() * 2);
      const routeStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, Math.floor(rand() * 30));
      const durationMinutes = ordersPerRoute * profile.avgTimeMin * (0.8 + rand() * 0.4);
      const routeEnd = new Date(routeStart.getTime() + durationMinutes * 60000);

      let routeDelivered = 0;
      const routeOrderCount = Math.min(ordersPerRoute, 8); // cap per route

      for (let oi = 0; oi < routeOrderCount; oi++) {
        const loc = locations[Math.floor(rand() * locations.length)];
        const first = RECIPIENT_FIRST[Math.floor(rand() * RECIPIENT_FIRST.length)];
        const last = RECIPIENT_LAST[Math.floor(rand() * RECIPIENT_LAST.length)];

        // Delivery hour: 70% between 8-18, peak at 14-16
        const hour = rand() < 0.7
          ? 8 + Math.floor(rand() * 10)
          : Math.floor(rand() * 24);
        const orderCreated = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 6 + Math.floor(rand() * 3), Math.floor(rand() * 60));

        // Determine success: apply driver profile + Tuesday penalty
        let failChance = 1 - profile.successRate;
        const isTuesday = dayOfWeek === 2;
        if (isTuesday) failChance *= 2; // Tuesday failure spike (deliberate pattern)

        const succeeded = rand() > failChance;
        const deliveryTime = profile.avgTimeMin * (0.6 + rand() * 0.8);
        const completedAt = succeeded
          ? new Date(routeStart.getTime() + (oi + 1) * deliveryTime * 60000)
          : null;

        // Time window: 70% of orders have one
        const hasTimeWindow = rand() < 0.7;
        const windowStart = hasTimeWindow ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0) : null;
        const windowEnd = hasTimeWindow ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour + 2, 0) : null;

        // Industry-flavored item description as notes for analytics orders
        const itemNote = industry ? pickIndustryItem(industry) : null;

        allOrders.push({
          tenantId,
          recipientName: `${first} ${last}`,
          deliveryAddress: { street: loc.name, city: (loc as GeneratedAddress).city || '', state: (loc as GeneratedAddress).state || depotState, zip: (loc as GeneratedAddress).zip || '' },
          deliveryLat: loc.lat.toString(),
          deliveryLng: loc.lng.toString(),
          status: succeeded ? 'delivered' : 'failed',
          createdAt: orderCreated,
          completedAt,
          failureCategory: succeeded ? null : pickFailureCategory(),
          timeWindowStart: windowStart,
          timeWindowEnd: windowEnd,
          notes: itemNote,
        });

        if (succeeded) routeDelivered++;
      }

      const totalDistance = routeOrderCount * (3 + rand() * 8); // 3-11 km per stop

      allRoutes.push({
        tenantId,
        name: `Route ${date.toISOString().slice(0, 10)} #${ri + 1}`,
        status: 'completed',
        driverId,
        vehicleId,
        depotAddress: { street: depotLoc.name, city: depotCity, state: depotState, zip: (depotLoc as GeneratedAddress).zip || '' },
        depotLat: depotLoc.lat.toString(),
        depotLng: depotLoc.lng.toString(),
        totalStops: routeOrderCount,
        completedStops: routeDelivered,
        totalDuration: Math.round(durationMinutes),
        totalDistance: String(Math.round(totalDistance * 10) / 10),
        plannedStartAt: routeStart,
        actualStartAt: new Date(routeStart.getTime() + Math.floor(rand() * 10) * 60000),
        actualEndAt: routeEnd,
        createdAt: new Date(routeStart.getTime() - 30 * 60000), // created 30min before start
      });
    }
  }

  // Batch insert routes, then assign orders to them
  const ROUTE_BATCH = 25;
  const insertedRouteIds: string[] = [];
  for (let i = 0; i < allRoutes.length; i += ROUTE_BATCH) {
    const batch = allRoutes.slice(i, i + ROUTE_BATCH);
    const result = await db.insert(routes).values(batch).returning({ id: routes.id });
    insertedRouteIds.push(...result.map(r => r.id));
  }

  // Map orders to routes: orders are grouped by route (ordersPerRoute per route)
  let orderIdx = 0;
  const ordersWithRoutes = allOrders.map(o => {
    // Find which route this order belongs to based on insertion order
    const routeIdx = Math.min(
      Math.floor(orderIdx / 8), // max 8 orders per route
      insertedRouteIds.length - 1,
    );
    orderIdx++;
    return { ...o, routeId: insertedRouteIds[routeIdx] ?? null, ...(o.notes ? { notes: o.notes } : {}) };
  });

  // Batch insert orders
  const ORDER_BATCH = 50;
  for (let i = 0; i < ordersWithRoutes.length; i += ORDER_BATCH) {
    const batch = ordersWithRoutes.slice(i, i + ORDER_BATCH);
    await db.insert(orders).values(batch);
  }
}
