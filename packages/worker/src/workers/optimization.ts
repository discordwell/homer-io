import type { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { orders, routes } from '../lib/schema.js';
import { logger } from '../lib/logger.js';
import { solveTSP, tourDuration } from './lib/vrp-solver.js';
import { getDistanceMatrix } from './lib/osrm.js';
import { haversineDistance } from './lib/geo.js';

interface OptimizationJobData {
  tenantId: string;
  routeId: string;
}

const log = logger.child({ worker: 'optimization' });

export async function processOptimization(job: Job<OptimizationJobData>) {
  const { tenantId, routeId } = job.data;
  log.info('Processing route optimization', { routeId, tenantId });

  // Get route
  const [route] = await db
    .select()
    .from(routes)
    .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)))
    .limit(1);

  if (!route) {
    throw new Error(`Route ${routeId} not found`);
  }

  // Get orders on this route
  const routeOrders = await db
    .select()
    .from(orders)
    .where(and(eq(orders.routeId, routeId), eq(orders.tenantId, tenantId)))
    .orderBy(orders.stopSequence);

  if (routeOrders.length === 0) {
    log.info('No orders on route, skipping', { routeId });
    return { optimized: false, routeId, message: 'No orders to optimize' };
  }

  // Build coordinate array: [depot?, ...orders]
  const coords: [number, number][] = [];
  let depotIndex: number | undefined;

  if (route.depotLat && route.depotLng) {
    depotIndex = 0;
    coords.push([Number(route.depotLat), Number(route.depotLng)]);
  }

  const orderStartIndex = coords.length;
  const validOrders: typeof routeOrders = [];

  for (const order of routeOrders) {
    if (order.deliveryLat && order.deliveryLng) {
      coords.push([Number(order.deliveryLat), Number(order.deliveryLng)]);
      validOrders.push(order);
    }
  }

  if (validOrders.length < 2) {
    log.info('Not enough geocoded orders to optimize', { routeId });
    return { optimized: false, routeId, message: 'Not enough geocoded orders' };
  }

  const stopMatrixIndices = validOrders.map((_, i) => orderStartIndex + i);

  // Get distance matrix (OSRM with haversine fallback)
  let matrix: number[][];
  let usedOsrm = false;

  try {
    const osrmResult = await getDistanceMatrix(coords);
    matrix = osrmResult.durations;
    usedOsrm = true;
  } catch (err) {
    log.warn('OSRM unavailable, using haversine fallback', { routeId, error: (err as Error).message });
    matrix = buildHaversineMatrix(coords);
  }

  // Solve TSP
  const optimizedOrder = solveTSP(matrix, stopMatrixIndices, depotIndex);
  const orderedIndices = optimizedOrder.map(mi => mi - orderStartIndex);

  // Update stopSequence on orders atomically
  const method = usedOsrm ? 'OSRM+VRP' : 'VRP (approximate)';
  await db.transaction(async (tx) => {
    for (let newSeq = 0; newSeq < orderedIndices.length; newSeq++) {
      const order = validOrders[orderedIndices[newSeq]];
      await tx
        .update(orders)
        .set({ stopSequence: newSeq + 1, updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId)));
    }

    await tx
      .update(routes)
      .set({
        optimizationNotes: `Worker ${method} optimized on ${new Date().toISOString()}. Sequence: ${orderedIndices.join(' → ')}`,
        updatedAt: new Date(),
      })
      .where(and(eq(routes.id, routeId), eq(routes.tenantId, tenantId)));
  });

  log.info('Route optimized successfully', { routeId, method, order: orderedIndices });
  return { optimized: true, routeId, order: orderedIndices, method };
}

function buildHaversineMatrix(coords: [number, number][]): number[][] {
  const n = coords.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const speedKmh = 30;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = haversineDistance(coords[i][0], coords[i][1], coords[j][0], coords[j][1]);
      matrix[i][j] = (dist * 1.3 / speedKmh) * 3600;
    }
  }
  return matrix;
}
