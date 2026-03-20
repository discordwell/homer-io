/**
 * Static demo data for the public demo mode.
 * This data is used entirely client-side — no API calls required.
 */

// --- Dashboard Stats ---

export interface DemoDashboardStats {
  ordersToday: number;
  activeRoutes: number;
  activeDrivers: number;
  deliveryRate: number;
  totalVehicles: number;
  recentOrders: DemoRecentOrder[];
}

export interface DemoRecentOrder {
  id: string;
  recipientName: string;
  status: string;
  priority: string;
  packageCount: number;
  createdAt: string;
}

const today = new Date().toISOString().slice(0, 10);

export const DEMO_DASHBOARD_STATS: DemoDashboardStats = {
  ordersToday: 47,
  activeRoutes: 3,
  activeDrivers: 5,
  deliveryRate: 94,
  totalVehicles: 4,
  recentOrders: [
    { id: 'demo-001', recipientName: 'Emma Johnson', status: 'delivered', priority: 'normal', packageCount: 2, createdAt: `${today}T09:15:00Z` },
    { id: 'demo-002', recipientName: 'Liam Garcia', status: 'in_transit', priority: 'high', packageCount: 1, createdAt: `${today}T09:30:00Z` },
    { id: 'demo-003', recipientName: 'Sophia Williams', status: 'in_transit', priority: 'normal', packageCount: 3, createdAt: `${today}T09:45:00Z` },
    { id: 'demo-004', recipientName: 'Noah Brown', status: 'delivered', priority: 'urgent', packageCount: 1, createdAt: `${today}T10:00:00Z` },
    { id: 'demo-005', recipientName: 'Olivia Davis', status: 'assigned', priority: 'normal', packageCount: 2, createdAt: `${today}T10:15:00Z` },
    { id: 'demo-006', recipientName: 'Mason Rodriguez', status: 'received', priority: 'low', packageCount: 1, createdAt: `${today}T10:30:00Z` },
    { id: 'demo-007', recipientName: 'Ava Martinez', status: 'delivered', priority: 'normal', packageCount: 4, createdAt: `${today}T10:45:00Z` },
    { id: 'demo-008', recipientName: 'Ethan Wilson', status: 'delivered', priority: 'high', packageCount: 1, createdAt: `${today}T11:00:00Z` },
    { id: 'demo-009', recipientName: 'Isabella Anderson', status: 'in_transit', priority: 'normal', packageCount: 2, createdAt: `${today}T11:15:00Z` },
    { id: 'demo-010', recipientName: 'James Thomas', status: 'failed', priority: 'normal', packageCount: 1, createdAt: `${today}T08:30:00Z` },
  ],
};

// --- Demo Orders (for Orders page) ---

export interface DemoOrder {
  id: string;
  externalId: string | null;
  status: string;
  priority: string;
  recipientName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  deliveryAddress: { street: string; city: string; state: string; zip: string; country: string };
  packageCount: number;
  weight: string | null;
  volume: string | null;
  notes: string | null;
  routeId: string | null;
  stopSequence: number | null;
  createdAt: string;
}

export const DEMO_ORDERS: DemoOrder[] = [
  { id: 'demo-001', externalId: 'ORD-4821', status: 'delivered', priority: 'normal', recipientName: 'Emma Johnson', recipientPhone: '555-0101', recipientEmail: 'emma@example.com', deliveryAddress: { street: '555 Market St', city: 'San Francisco', state: 'CA', zip: '94105', country: 'US' }, packageCount: 2, weight: '4.5', volume: null, notes: 'Leave at front desk', routeId: 'route-001', stopSequence: 1, createdAt: `${today}T09:15:00Z` },
  { id: 'demo-002', externalId: 'ORD-4822', status: 'in_transit', priority: 'high', recipientName: 'Liam Garcia', recipientPhone: '555-0102', recipientEmail: null, deliveryAddress: { street: '1955 Broadway', city: 'Oakland', state: 'CA', zip: '94612', country: 'US' }, packageCount: 1, weight: '2.1', volume: null, notes: null, routeId: 'route-002', stopSequence: 3, createdAt: `${today}T09:30:00Z` },
  { id: 'demo-003', externalId: 'ORD-4823', status: 'in_transit', priority: 'normal', recipientName: 'Sophia Williams', recipientPhone: '555-0103', recipientEmail: 'sophia@example.com', deliveryAddress: { street: '2100 University Ave', city: 'Berkeley', state: 'CA', zip: '94704', country: 'US' }, packageCount: 3, weight: '8.2', volume: null, notes: 'Ring buzzer #4', routeId: 'route-002', stopSequence: 4, createdAt: `${today}T09:45:00Z` },
  { id: 'demo-004', externalId: 'ORD-4824', status: 'delivered', priority: 'urgent', recipientName: 'Noah Brown', recipientPhone: '555-0104', recipientEmail: 'noah@example.com', deliveryAddress: { street: '100 El Camino Real', city: 'Palo Alto', state: 'CA', zip: '94301', country: 'US' }, packageCount: 1, weight: '0.8', volume: null, notes: 'Time-sensitive medical supplies', routeId: 'route-001', stopSequence: 2, createdAt: `${today}T10:00:00Z` },
  { id: 'demo-005', externalId: 'ORD-4825', status: 'assigned', priority: 'normal', recipientName: 'Olivia Davis', recipientPhone: null, recipientEmail: 'olivia@example.com', deliveryAddress: { street: '1450 Burlingame Ave', city: 'Burlingame', state: 'CA', zip: '94010', country: 'US' }, packageCount: 2, weight: '3.0', volume: null, notes: null, routeId: 'route-003', stopSequence: 1, createdAt: `${today}T10:15:00Z` },
  { id: 'demo-006', externalId: 'ORD-4826', status: 'received', priority: 'low', recipientName: 'Mason Rodriguez', recipientPhone: '555-0106', recipientEmail: null, deliveryAddress: { street: '355 Santana Row', city: 'San Jose', state: 'CA', zip: '95128', country: 'US' }, packageCount: 1, weight: '1.5', volume: null, notes: null, routeId: null, stopSequence: null, createdAt: `${today}T10:30:00Z` },
  { id: 'demo-007', externalId: 'ORD-4827', status: 'delivered', priority: 'normal', recipientName: 'Ava Martinez', recipientPhone: '555-0107', recipientEmail: 'ava@example.com', deliveryAddress: { street: '5959 Shellmound St', city: 'Emeryville', state: 'CA', zip: '94608', country: 'US' }, packageCount: 4, weight: '12.0', volume: null, notes: 'Fragile - handle with care', routeId: 'route-001', stopSequence: 3, createdAt: `${today}T10:45:00Z` },
  { id: 'demo-008', externalId: 'ORD-4828', status: 'delivered', priority: 'high', recipientName: 'Ethan Wilson', recipientPhone: '555-0108', recipientEmail: null, deliveryAddress: { street: '1 Hacker Way', city: 'Menlo Park', state: 'CA', zip: '94025', country: 'US' }, packageCount: 1, weight: '0.5', volume: null, notes: 'Security check required at gate', routeId: 'route-001', stopSequence: 4, createdAt: `${today}T11:00:00Z` },
  { id: 'demo-009', externalId: 'ORD-4829', status: 'in_transit', priority: 'normal', recipientName: 'Isabella Anderson', recipientPhone: '555-0109', recipientEmail: 'isabella@example.com', deliveryAddress: { street: '333 Main St', city: 'Redwood City', state: 'CA', zip: '94063', country: 'US' }, packageCount: 2, weight: '5.0', volume: null, notes: null, routeId: 'route-002', stopSequence: 5, createdAt: `${today}T11:15:00Z` },
  { id: 'demo-010', externalId: 'ORD-4830', status: 'failed', priority: 'normal', recipientName: 'James Thomas', recipientPhone: '555-0110', recipientEmail: 'james@example.com', deliveryAddress: { street: '2700 Ygnacio Valley Rd', city: 'Walnut Creek', state: 'CA', zip: '94598', country: 'US' }, packageCount: 1, weight: '2.3', volume: null, notes: 'Customer not available', routeId: 'route-002', stopSequence: 1, createdAt: `${today}T08:30:00Z` },
  { id: 'demo-011', externalId: 'ORD-4831', status: 'delivered', priority: 'normal', recipientName: 'Charlotte Lopez', recipientPhone: '555-0111', recipientEmail: null, deliveryAddress: { street: '1999 Harrison St', city: 'Oakland', state: 'CA', zip: '94612', country: 'US' }, packageCount: 1, weight: '1.2', volume: null, notes: null, routeId: 'route-001', stopSequence: 5, createdAt: `${today}T08:00:00Z` },
  { id: 'demo-012', externalId: 'ORD-4832', status: 'delivered', priority: 'high', recipientName: 'Lucas Hernandez', recipientPhone: '555-0112', recipientEmail: 'lucas@example.com', deliveryAddress: { street: '80 E 4th Ave', city: 'San Mateo', state: 'CA', zip: '94401', country: 'US' }, packageCount: 2, weight: '6.8', volume: null, notes: null, routeId: 'route-001', stopSequence: 6, createdAt: `${today}T07:45:00Z` },
];

// --- Demo Vehicles ---

export interface DemoVehicle {
  id: string;
  name: string;
  type: string;
  licensePlate: string | null;
  fuelType: string;
  capacityWeight: string | null;
  capacityVolume: string | null;
  capacityCount: number | null;
  evRange: string | null;
  isActive: boolean;
  createdAt: string;
}

export const DEMO_VEHICLES: DemoVehicle[] = [
  { id: 'veh-001', name: 'Van #1 - Sprinter', type: 'van', licensePlate: '8ABC123', fuelType: 'diesel', capacityWeight: '2000', capacityVolume: '400', capacityCount: 80, evRange: null, isActive: true, createdAt: '2025-11-15T00:00:00Z' },
  { id: 'veh-002', name: 'Van #2 - Transit', type: 'van', licensePlate: '8DEF456', fuelType: 'diesel', capacityWeight: '1800', capacityVolume: '350', capacityCount: 60, evRange: null, isActive: true, createdAt: '2025-11-15T00:00:00Z' },
  { id: 'veh-003', name: 'Sedan #1 - Civic', type: 'car', licensePlate: '8GHI789', fuelType: 'gasoline', capacityWeight: '400', capacityVolume: '50', capacityCount: 15, evRange: null, isActive: true, createdAt: '2025-12-01T00:00:00Z' },
  { id: 'veh-004', name: 'Cargo Bike #1', type: 'cargo_bike', licensePlate: null, fuelType: 'electric', capacityWeight: '100', capacityVolume: '30', capacityCount: 10, evRange: '60', isActive: true, createdAt: '2026-01-10T00:00:00Z' },
];

// --- Demo Drivers ---

export interface DemoDriver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string;
  skillTags: string[];
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  createdAt: string;
}

export const DEMO_DRIVERS: DemoDriver[] = [
  { id: 'drv-001', name: 'Alex Rivera', email: 'alex.rivera@demo.homer.io', phone: '555-2001', licenseNumber: 'D1234567', status: 'on_route', skillTags: ['hazmat', 'large_vehicle'], lat: 37.725, lng: -122.405, heading: 15, speed: 32, createdAt: '2025-11-15T00:00:00Z' },
  { id: 'drv-002', name: 'Jordan Chen', email: 'jordan.chen@demo.homer.io', phone: '555-2002', licenseNumber: 'D2345678', status: 'on_route', skillTags: [], lat: 37.845, lng: -122.268, heading: 195, speed: 28, createdAt: '2025-11-20T00:00:00Z' },
  { id: 'drv-003', name: 'Sam Okafor', email: 'sam.okafor@demo.homer.io', phone: '555-2003', licenseNumber: 'D3456789', status: 'available', skillTags: ['refrigerated'], lat: 37.839, lng: -122.293, heading: null, speed: null, createdAt: '2025-12-01T00:00:00Z' },
  { id: 'drv-004', name: 'Morgan Patel', email: 'morgan.patel@demo.homer.io', phone: '555-2004', licenseNumber: 'D4567890', status: 'available', skillTags: [], lat: 37.321, lng: -121.948, heading: null, speed: null, createdAt: '2026-01-05T00:00:00Z' },
  { id: 'drv-005', name: 'Casey Nguyen', email: 'casey.nguyen@demo.homer.io', phone: '555-2005', licenseNumber: null, status: 'offline', skillTags: ['cargo_bike'], lat: null, lng: null, heading: null, speed: null, createdAt: '2026-01-15T00:00:00Z' },
];

// --- Demo Routes ---

export interface DemoRoute {
  id: string;
  name: string;
  status: string;
  totalStops: number;
  completedStops: number;
  driverName: string | null;
  vehicleName: string | null;
  plannedStartAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  totalDistance: string | null;
  totalDuration: number | null;
  createdAt: string;
}

export const DEMO_ROUTES: DemoRoute[] = [
  { id: 'route-001', name: 'Morning SF Route', status: 'completed', totalStops: 6, completedStops: 6, driverName: 'Alex Rivera', vehicleName: 'Van #1 - Sprinter', plannedStartAt: `${today}T07:00:00Z`, actualStartAt: `${today}T07:05:00Z`, actualEndAt: `${today}T11:30:00Z`, totalDistance: '42.3', totalDuration: 265, createdAt: `${today}T06:30:00Z` },
  { id: 'route-002', name: 'Midday East Bay Route', status: 'in_progress', totalStops: 5, completedStops: 2, driverName: 'Jordan Chen', vehicleName: 'Van #2 - Transit', plannedStartAt: `${today}T11:00:00Z`, actualStartAt: `${today}T11:10:00Z`, actualEndAt: null, totalDistance: '38.7', totalDuration: null, createdAt: `${today}T10:30:00Z` },
  { id: 'route-003', name: 'Afternoon Peninsula Route', status: 'draft', totalStops: 4, completedStops: 0, driverName: null, vehicleName: null, plannedStartAt: `${today}T14:00:00Z`, actualStartAt: null, actualEndAt: null, totalDistance: null, totalDuration: null, createdAt: `${today}T09:00:00Z` },
];

// --- Demo user profile for display ---

export const DEMO_USER = {
  id: 'demo-user-000',
  email: 'demo@homer.io',
  name: 'Demo User',
  role: 'owner' as const,
  tenantId: 'demo-tenant-000',
  createdAt: '2025-11-01T00:00:00Z',
  avatarUrl: null,
  isDemo: true,
};
