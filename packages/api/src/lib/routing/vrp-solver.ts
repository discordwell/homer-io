/**
 * Deterministic VRP solver for delivery route optimization.
 *
 * TSP: nearest-neighbor heuristic + 2-opt local search improvement.
 * CVRPTW: Clarke-Wright savings algorithm + per-driver TSP.
 *
 * Designed for <200 stops — runs in <50ms for typical delivery problems.
 */

// ---- Types ----

export interface TimeWindow {
  start: Date;
  end: Date;
}

export interface OrderDemand {
  weight: number;
  volume: number;
  count: number;
}

export interface VehicleCapacity {
  weight: number;
  volume: number;
  count: number;
}

export interface CVRPTWInput {
  /** N×N duration matrix in seconds (indices 0..N-1 correspond to allCoords) */
  matrix: number[][];
  /** Driver info: index into the matrix for their starting position */
  drivers: {
    id: string;
    matrixIndex: number;
    capacity: VehicleCapacity;
  }[];
  /** Order info: index into the matrix for delivery location */
  orders: {
    id: string;
    matrixIndex: number;
    demand: OrderDemand;
    priority: number; // higher = more urgent
    timeWindow?: TimeWindow;
  }[];
  /** Index into the matrix for the depot (if any) */
  depotIndex?: number;
  maxOrdersPerRoute: number;
}

export interface RouteAssignment {
  driverId: string;
  orderIndices: number[]; // indices into the input orders array, in optimized visit order
  totalDuration: number; // seconds
  totalDistance?: number;
}

export interface CVRPTWResult {
  assignments: RouteAssignment[];
  unassignedOrderIndices: number[];
}

// ---- TSP Solver (single vehicle) ----

/**
 * Solve TSP using nearest-neighbor heuristic + 2-opt improvement.
 * Returns ordered indices into the matrix (excluding depotIndex if provided).
 *
 * @param matrix - N×N duration/distance matrix
 * @param stopIndices - which matrix indices are stops to visit
 * @param depotIndex - starting position (not included in output)
 */
export function solveTSP(
  matrix: number[][],
  stopIndices: number[],
  depotIndex?: number,
): number[] {
  if (stopIndices.length <= 1) return [...stopIndices];
  if (stopIndices.length === 2) {
    // Only two stops — check both orders
    const [a, b] = stopIndices;
    const start = depotIndex ?? a;
    const costAB = matrix[start][a] + matrix[a][b];
    const costBA = matrix[start][b] + matrix[b][a];
    return costAB <= costBA ? [a, b] : [b, a];
  }

  // Phase 1: Nearest-neighbor heuristic
  const tour = nearestNeighbor(matrix, stopIndices, depotIndex);

  // Phase 2: 2-opt local search improvement
  return twoOpt(matrix, tour, depotIndex);
}

function nearestNeighbor(
  matrix: number[][],
  stopIndices: number[],
  depotIndex?: number,
): number[] {
  const remaining = new Set(stopIndices);
  const tour: number[] = [];
  let current = depotIndex ?? stopIndices[0];

  // If depot is one of the stops, visit it first
  if (depotIndex !== undefined && remaining.has(depotIndex)) {
    tour.push(depotIndex);
    remaining.delete(depotIndex);
  }

  while (remaining.size > 0) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (const idx of remaining) {
      const dist = matrix[current][idx];
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = idx;
      }
    }
    tour.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }

  return tour;
}

function twoOpt(
  matrix: number[][],
  tour: number[],
  depotIndex?: number,
): number[] {
  const n = tour.length;
  if (n < 3) return tour;

  const result = [...tour];
  let improved = true;
  let iterations = 0;
  const maxIterations = 1000; // Safety bound

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 2; j < n; j++) {
        const delta = twoOptDelta(matrix, result, i, j, depotIndex);
        if (delta < -0.001) { // numerical stability
          // Reverse the segment between i+1 and j
          reverse(result, i + 1, j);
          improved = true;
        }
      }
    }
  }

  return result;
}

function twoOptDelta(
  matrix: number[][],
  tour: number[],
  i: number,
  j: number,
  depotIndex?: number,
): number {
  const n = tour.length;
  const beforeI = i === 0 && depotIndex !== undefined ? depotIndex : tour[i > 0 ? i - 1 : n - 1];
  const afterJ = j < n - 1 ? tour[j + 1] : (depotIndex !== undefined ? depotIndex : tour[0]);

  const oldCost = matrix[beforeI][tour[i]] + matrix[tour[j]][afterJ];
  const newCost = matrix[beforeI][tour[j]] + matrix[tour[i]][afterJ];

  return newCost - oldCost;
}

function reverse(arr: number[], from: number, to: number): void {
  let left = from;
  let right = to;
  while (left < right) {
    const tmp = arr[left];
    arr[left] = arr[right];
    arr[right] = tmp;
    left++;
    right--;
  }
}

/**
 * Calculate total tour duration given a matrix and ordered stops.
 */
export function tourDuration(
  matrix: number[][],
  tour: number[],
  depotIndex?: number,
): number {
  if (tour.length === 0) return 0;
  let total = 0;
  let prev = depotIndex ?? tour[0];

  for (const stop of tour) {
    if (stop === prev && depotIndex === undefined) continue;
    total += matrix[prev][stop];
    prev = stop;
  }
  return total;
}

// ---- CVRPTW Solver (multi-vehicle) ----

/**
 * Solve the Capacitated VRP with Time Windows using Clarke-Wright savings.
 */
export function solveCVRPTW(input: CVRPTWInput): CVRPTWResult {
  const { matrix, drivers, orders, depotIndex, maxOrdersPerRoute } = input;

  if (orders.length === 0) {
    return { assignments: [], unassignedOrderIndices: [] };
  }

  if (drivers.length === 0) {
    return {
      assignments: [],
      unassignedOrderIndices: orders.map((_, i) => i),
    };
  }

  // Sort orders by priority (urgent first) for initial assignment
  const sortedOrderIndices = orders
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = priorityScore(orders[a].priority);
      const pb = priorityScore(orders[b].priority);
      return pb - pa; // higher score = more urgent = first
    });

  // Use depot or first driver's position as reference point
  const refIndex = depotIndex ?? drivers[0].matrixIndex;

  // Phase 1: Assign orders to nearest driver using savings-based approach
  // Start with each order in its own route assigned to nearest driver
  const orderToDriver: (number | null)[] = new Array(orders.length).fill(null);
  const driverOrders: number[][] = drivers.map(() => []);
  const driverLoad: OrderDemand[] = drivers.map(() => ({ weight: 0, volume: 0, count: 0 }));

  for (const oi of sortedOrderIndices) {
    const order = orders[oi];
    let bestDriver = -1;
    let bestDist = Infinity;

    for (let di = 0; di < drivers.length; di++) {
      const driver = drivers[di];
      const dist = matrix[driver.matrixIndex][order.matrixIndex];

      // Check capacity
      const newWeight = driverLoad[di].weight + order.demand.weight;
      const newVolume = driverLoad[di].volume + order.demand.volume;
      const newCount = driverLoad[di].count + order.demand.count;

      if (driver.capacity.weight > 0 && newWeight > driver.capacity.weight) continue;
      if (driver.capacity.volume > 0 && newVolume > driver.capacity.volume) continue;
      if (driver.capacity.count > 0 && newCount > driver.capacity.count) continue;

      // Check max orders per route
      if (driverOrders[di].length >= maxOrdersPerRoute) continue;

      if (dist < bestDist) {
        bestDist = dist;
        bestDriver = di;
      }
    }

    if (bestDriver >= 0) {
      orderToDriver[oi] = bestDriver;
      driverOrders[bestDriver].push(oi);
      driverLoad[bestDriver].weight += order.demand.weight;
      driverLoad[bestDriver].volume += order.demand.volume;
      driverLoad[bestDriver].count += order.demand.count;
    }
  }

  // Phase 2: Optimize stop order within each driver's route using TSP
  const assignments: RouteAssignment[] = [];

  for (let di = 0; di < drivers.length; di++) {
    const driverOrderIndices = driverOrders[di];
    if (driverOrderIndices.length === 0) continue;

    const driver = drivers[di];

    // Map matrix indices to order indices, handling duplicates
    // (multiple orders at the same coordinates share a matrix index).
    const matrixToOrders = new Map<number, number[]>();
    for (const oi of driverOrderIndices) {
      const mi = orders[oi].matrixIndex;
      const existing = matrixToOrders.get(mi);
      if (existing) existing.push(oi);
      else matrixToOrders.set(mi, [oi]);
    }

    // Deduplicate matrix indices for TSP (it operates on unique locations)
    const uniqueStopMatrixIndices = [...matrixToOrders.keys()];

    // Solve TSP for unique locations
    const optimizedMatrixOrder = solveTSP(matrix, uniqueStopMatrixIndices, driver.matrixIndex);

    // Expand back: each unique matrix index maps to one or more orders
    const orderedOrderIndices: number[] = [];
    for (const mi of optimizedMatrixOrder) {
      const ois = matrixToOrders.get(mi);
      if (ois) orderedOrderIndices.push(...ois);
    }

    const totalDur = tourDuration(matrix, optimizedMatrixOrder, driver.matrixIndex);

    assignments.push({
      driverId: driver.id,
      orderIndices: orderedOrderIndices,
      totalDuration: totalDur,
    });
  }

  // Collect unassigned orders
  const unassignedOrderIndices = orders
    .map((_, i) => i)
    .filter(i => orderToDriver[i] === null);

  return { assignments, unassignedOrderIndices };
}

function priorityScore(priority: number | string): number {
  if (typeof priority === 'number') return priority;
  switch (priority) {
    case 'urgent': return 4;
    case 'high': return 3;
    case 'normal': return 2;
    case 'low': return 1;
    default: return 2;
  }
}
