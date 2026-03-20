/**
 * Pre-computed Bay Area route paths for demo Live Map simulation.
 * Waypoints follow major highways (I-280, US-101, I-80, CA-24, I-880).
 */

export interface DemoRouteStop {
  lat: number;
  lng: number;
  name: string;
  completed: boolean;
  pathIndex: number;    // index into the path array where this stop sits
  orderId: string;      // for generating delivery events
  recipientName: string;
}

export interface DemoRoutePath {
  routeId: string;
  routeName: string;
  driverId: string;
  driverName: string;
  status: 'completed' | 'in_progress';
  stops: DemoRouteStop[];
  path: [number, number][];  // [lat, lng] waypoints
  initialPathIndex: number;  // where the driver starts in the simulation
}

// ---------------------------------------------------------------------------
// Morning SF Route — Alex Rivera (completed, 6 stops)
// Depot → I-280 south → Palo Alto → Menlo Park → US-101 north → San Mateo
// → Bay Bridge → Emeryville → Oakland → back to depot
// ---------------------------------------------------------------------------

const MORNING_SF_PATH: [number, number][] = [
  // Depot: Market St, SF
  [37.790, -122.400],
  // South on I-280
  [37.775, -122.405],
  [37.760, -122.410],
  [37.740, -122.420],
  [37.720, -122.430],   // Daly City
  [37.695, -122.435],   // San Bruno
  [37.665, -122.432],   // near SFO
  [37.635, -122.420],   // Millbrae
  [37.605, -122.395],   // San Mateo (I-280)
  [37.575, -122.370],   // Belmont
  [37.545, -122.335],   // Redwood City area
  [37.515, -122.290],   // Woodside
  [37.480, -122.235],   // Atherton
  [37.455, -122.190],   // approaching Palo Alto
  // Stop 1: Palo Alto (index 14)
  [37.442, -122.163],
  // Short hop to Menlo Park
  [37.455, -122.158],
  [37.468, -122.152],
  // Stop 2: Menlo Park (index 17)
  [37.485, -122.148],
  // North on US-101 to San Mateo
  [37.500, -122.175],
  [37.520, -122.210],
  [37.540, -122.260],
  [37.555, -122.300],
  // Stop 3: San Mateo (index 22)
  [37.565, -122.324],
  // Continue north on 101
  [37.585, -122.345],
  [37.615, -122.375],
  [37.650, -122.395],
  [37.690, -122.410],
  [37.725, -122.405],
  [37.755, -122.398],
  [37.780, -122.393],
  // Bay Bridge approach
  [37.790, -122.375],
  [37.793, -122.355],
  [37.797, -122.335],
  // On Bay Bridge
  [37.800, -122.315],
  [37.805, -122.300],
  [37.815, -122.295],
  // Stop 4: Emeryville (index 36)
  [37.839, -122.293],
  // South to Oakland
  [37.830, -122.280],
  [37.820, -122.270],
  // Stop 5: Oakland (index 39)
  [37.808, -122.263],
  // Return to SF via Bay Bridge
  [37.815, -122.280],
  [37.805, -122.305],
  [37.798, -122.335],
  [37.793, -122.360],
  [37.790, -122.385],
  // Back to depot (index 45)
  [37.790, -122.400],
];

// ---------------------------------------------------------------------------
// Midday East Bay Route — Jordan Chen (in_progress, 2/5 completed)
// Depot → Bay Bridge → CA-24 → Walnut Creek → back → Berkeley
// → Oakland → south I-880 → Redwood City → US-101 → depot
// ---------------------------------------------------------------------------

const MIDDAY_EASTBAY_PATH: [number, number][] = [
  // Depot: Market St, SF
  [37.790, -122.400],
  // Bay Bridge eastbound
  [37.790, -122.380],
  [37.793, -122.355],
  [37.797, -122.330],
  [37.802, -122.305],
  [37.808, -122.285],
  // Through Oakland on I-80/CA-24
  [37.815, -122.270],
  [37.825, -122.255],
  [37.835, -122.240],
  [37.845, -122.220],
  [37.855, -122.195],
  [37.865, -122.165],
  [37.878, -122.130],
  [37.890, -122.100],
  // Stop 1: Walnut Creek (index 14)
  [37.902, -122.065],
  // Return west on CA-24
  [37.892, -122.095],
  [37.880, -122.125],
  [37.868, -122.160],
  [37.855, -122.195],
  [37.845, -122.225],
  // North to Berkeley
  [37.852, -122.245],
  [37.860, -122.258],
  // Stop 2: Berkeley (index 22)
  [37.872, -122.268],
  // South through Oakland
  [37.860, -122.265],
  [37.845, -122.268],
  [37.830, -122.272],
  // Stop 3: Oakland (index 26)
  [37.812, -122.269],
  // South along I-880
  [37.795, -122.265],
  [37.775, -122.258],
  [37.750, -122.248],
  [37.720, -122.238],
  [37.690, -122.232],
  [37.650, -122.228],
  [37.610, -122.226],
  [37.565, -122.228],
  [37.525, -122.229],
  // Stop 4: Redwood City (index 36)
  [37.486, -122.229],
  // Return north via US-101
  [37.520, -122.245],
  [37.565, -122.280],
  [37.610, -122.330],
  [37.660, -122.380],
  [37.710, -122.400],
  [37.755, -122.403],
  // Back to depot (index 43)
  [37.790, -122.400],
];

// ---------------------------------------------------------------------------
// Exported route definitions
// ---------------------------------------------------------------------------

export const DEMO_ROUTE_PATHS: DemoRoutePath[] = [
  {
    routeId: 'route-001',
    routeName: 'Morning SF Route',
    driverId: 'drv-001',
    driverName: 'Alex Rivera',
    status: 'completed',
    initialPathIndex: 28, // around north 101, heading toward Bay Bridge
    stops: [
      { lat: 37.442, lng: -122.163, name: 'Palo Alto', completed: true,  pathIndex: 14, orderId: 'demo-004', recipientName: 'Noah Brown' },
      { lat: 37.485, lng: -122.148, name: 'Menlo Park', completed: true,  pathIndex: 17, orderId: 'demo-008', recipientName: 'Ethan Wilson' },
      { lat: 37.565, lng: -122.324, name: 'San Mateo', completed: true,  pathIndex: 22, orderId: 'demo-012', recipientName: 'Lucas Hernandez' },
      { lat: 37.839, lng: -122.293, name: 'Emeryville', completed: true,  pathIndex: 36, orderId: 'demo-007', recipientName: 'Ava Martinez' },
      { lat: 37.808, lng: -122.263, name: 'Oakland', completed: true,  pathIndex: 39, orderId: 'demo-011', recipientName: 'Charlotte Lopez' },
      { lat: 37.790, lng: -122.400, name: 'Market St (Return)', completed: true,  pathIndex: 45, orderId: 'demo-001', recipientName: 'Emma Johnson' },
    ],
    path: MORNING_SF_PATH,
  },
  {
    routeId: 'route-002',
    routeName: 'Midday East Bay Route',
    driverId: 'drv-002',
    driverName: 'Jordan Chen',
    status: 'in_progress',
    initialPathIndex: 24, // between Berkeley and Oakland, heading to stop 3
    stops: [
      { lat: 37.902, lng: -122.065, name: 'Walnut Creek', completed: true,  pathIndex: 14, orderId: 'demo-010', recipientName: 'James Thomas' },
      { lat: 37.872, lng: -122.268, name: 'Berkeley', completed: true,  pathIndex: 22, orderId: 'demo-003', recipientName: 'Sophia Williams' },
      { lat: 37.812, lng: -122.269, name: 'Oakland', completed: false, pathIndex: 26, orderId: 'demo-002', recipientName: 'Liam Garcia' },
      { lat: 37.486, lng: -122.229, name: 'Redwood City', completed: false, pathIndex: 36, orderId: 'demo-009', recipientName: 'Isabella Anderson' },
      { lat: 37.790, lng: -122.400, name: 'Depot (Return)', completed: false, pathIndex: 43, orderId: 'demo-005', recipientName: 'Olivia Davis' },
    ],
    path: MIDDAY_EASTBAY_PATH,
  },
];

// ---------------------------------------------------------------------------
// Pure helper: advance a position along a path by a given distance (degrees)
// ---------------------------------------------------------------------------

export function advanceAlongPath(
  pathIndex: number,
  fraction: number,
  path: [number, number][],
  distancePerTick: number,
): { pathIndex: number; fraction: number; lat: number; lng: number; heading: number; looped: boolean } {
  let remaining = distancePerTick;
  let idx = pathIndex;
  let frac = fraction;
  let looped = false;
  let iterations = 0;
  const maxIterations = path.length * 2;

  while (remaining > 0 && iterations < maxIterations) {
    iterations++;
    if (idx >= path.length - 1) {
      // Loop back to start
      idx = 0;
      frac = 0;
      looped = true;
    }

    const [lat1, lng1] = path[idx];
    const [lat2, lng2] = path[idx + 1];
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    const segLen = Math.sqrt(dLat * dLat + dLng * dLng);

    if (segLen < 1e-10) {
      // Zero-length segment, skip
      idx++;
      frac = 0;
      continue;
    }

    const remainingInSeg = segLen * (1 - frac);

    if (remaining < remainingInSeg) {
      frac += remaining / segLen;
      remaining = 0;
    } else {
      remaining -= remainingInSeg;
      idx++;
      frac = 0;
    }
  }

  // Clamp
  if (idx >= path.length - 1) {
    idx = 0;
    frac = 0;
    looped = true;
  }

  const [lat1, lng1] = path[idx];
  const [lat2, lng2] = path[idx + 1] ?? path[idx];
  const lat = lat1 + (lat2 - lat1) * frac;
  const lng = lng1 + (lng2 - lng1) * frac;

  // Heading: 0 = north, 90 = east (geographic convention)
  const heading = (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI;

  return {
    pathIndex: idx,
    fraction: frac,
    lat,
    lng,
    heading: (heading + 360) % 360,
    looped,
  };
}
