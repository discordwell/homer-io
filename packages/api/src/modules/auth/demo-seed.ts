import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { vehicles } from '../../lib/db/schema/vehicles.js';
import { drivers } from '../../lib/db/schema/drivers.js';
import { orders } from '../../lib/db/schema/orders.js';
import { routes } from '../../lib/db/schema/routes.js';

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

const RECIPIENT_FIRST = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'James', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia',
  'Henry', 'Harper', 'Alexander', 'Evelyn', 'Daniel',
];

const RECIPIENT_LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
];

export function generateDemoOrders() {
  const count = 15 + Math.floor(Math.random() * 6); // 15–20
  const now = new Date();
  const locations = [...BAY_AREA_LOCATIONS].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const loc = locations[i % locations.length];
    const first = RECIPIENT_FIRST[Math.floor(Math.random() * RECIPIENT_FIRST.length)];
    const last = RECIPIENT_LAST[Math.floor(Math.random() * RECIPIENT_LAST.length)];

    // Stagger createdAt across the morning (06:00–10:00 UTC) so toISOString stays on the same date
    const createdAt = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      6 + Math.floor(i / 5), (i * 7) % 60, 0, 0,
    ));

    return {
      recipientName: `${first} ${last}`,
      deliveryAddress: { street: loc.name, city: '', state: 'CA', zip: '' },
      deliveryLat: loc.lat.toString(),
      deliveryLng: loc.lng.toString(),
      createdAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Main seed function — inserts vehicles, drivers, orders, routes
// ---------------------------------------------------------------------------

export async function seedDemoOrg(tenantId: string): Promise<void> {
  const now = new Date();

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
  const insertedDrivers = await db
    .insert(drivers)
    .values(
      driverNames.map((name, i) => ({
        tenantId,
        name,
        status: i < 3 ? ('available' as const) : ('offline' as const),
        currentVehicleId: i < insertedVehicles.length ? insertedVehicles[i].id : null,
      })),
    )
    .returning({ id: drivers.id });

  // --- Orders ---
  const orderData = generateDemoOrders();
  const insertedOrders = await db
    .insert(orders)
    .values(
      orderData.map(o => ({
        tenantId,
        recipientName: o.recipientName,
        deliveryAddress: o.deliveryAddress,
        deliveryLat: o.deliveryLat,
        deliveryLng: o.deliveryLng,
        status: 'received' as const,
        createdAt: o.createdAt,
      })),
    )
    .returning({ id: orders.id });

  // --- Routes (3: completed, in_progress, draft) ---
  const depotLoc = BAY_AREA_LOCATIONS[0]; // Market St depot
  const baseRoute = {
    tenantId,
    depotAddress: { street: depotLoc.name, city: 'San Francisco', state: 'CA', zip: '94105' },
    depotLat: depotLoc.lat.toString(),
    depotLng: depotLoc.lng.toString(),
  };

  // Spread-copy to avoid mutating the exported constant
  const shuffledLocations = [...BAY_AREA_LOCATIONS].sort(() => Math.random() - 0.5);

  // Partition orders across routes: first 6 → completed, next 5 → in_progress, rest → draft
  const completedOrderIds = insertedOrders.slice(0, 6).map(o => o.id);
  const inProgressOrderIds = insertedOrders.slice(6, 11).map(o => o.id);
  const draftOrderIds = insertedOrders.slice(11).map(o => o.id);

  // Route 1: completed
  const [completedRoute] = await db
    .insert(routes)
    .values({
      ...baseRoute,
      name: 'Morning SF Route',
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
      name: 'Midday East Bay Route',
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
      name: 'Afternoon Peninsula Route',
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
}
