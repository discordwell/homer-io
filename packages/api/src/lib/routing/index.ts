/**
 * Unified routing interface with graceful degradation:
 *   OSRM (preferred) → haversine fallback
 *   Google Routes (customer ETAs) → OSRM → haversine fallback
 */

import { getDistanceMatrix, getRoute, isOsrmAvailable } from './osrm.js';
import { solveTSP, solveCVRPTW, tourDuration } from './vrp-solver.js';
import type { CVRPTWInput, CVRPTWResult, VehicleCapacity, OrderDemand, TimeWindow } from './vrp-solver.js';
import { computeRouteETAs } from './google-routes.js';
import { haversineDistance, estimateEtaMinutes } from '../geo.js';
import { dwellTimesMinutes } from '@homer-io/shared';
import { cacheGet, cacheSet } from '../cache.js';

// ---- Fallback tracking ----
// Every haversine fallback gets a loud log and a Redis counter so degradation is never silent.

const FALLBACK_COUNTER_KEY = 'routing:haversine_fallbacks';
const FALLBACK_COUNTER_TTL = 86400; // 24h rolling window

async function trackFallback(context: string, error?: unknown) {
  const msg = error instanceof Error ? error.message : String(error ?? 'unknown');
  console.error(`[ROUTING FALLBACK] ${context} — OSRM unreachable, using haversine. Error: ${msg}`);
  try {
    // Increment Redis counter for monitoring/alerting
    const count = await cacheGet<number>(FALLBACK_COUNTER_KEY) ?? 0;
    await cacheSet(FALLBACK_COUNTER_KEY, count + 1, FALLBACK_COUNTER_TTL);
  } catch { /* Redis failure shouldn't block the fallback */ }
}

// ---- Types ----

export interface StopData {
  id: string;
  lat: number;
  lng: number;
  timeWindow?: TimeWindow;
  /** Per-stop service duration override (minutes). Falls back to vehicle-type default. */
  serviceDurationMinutes?: number;
}

export interface DepotData {
  lat: number;
  lng: number;
}

export interface OptimizedRoute {
  /** Ordered stop IDs in optimal visit sequence */
  orderedStopIds: string[];
  /** Ordered indices (0-based) into the input stops array */
  orderedIndices: number[];
  /** Total route duration in seconds */
  totalDuration: number;
  /** Total route distance in meters */
  totalDistance: number;
  /** OSRM polyline geometry (empty string if haversine fallback) */
  geometry: string;
  /** Whether OSRM was used (false = haversine fallback) */
  usedOsrm: boolean;
}

export interface DriverData {
  id: string;
  lat: number;
  lng: number;
  capacity: VehicleCapacity;
}

export interface DispatchOrderData {
  id: string;
  lat: number;
  lng: number;
  demand: OrderDemand;
  priority: number | string;
  timeWindow?: TimeWindow;
}

export interface DispatchOptions {
  maxOrdersPerRoute: number;
  depotLat?: number;
  depotLng?: number;
}

export interface DispatchAssignment {
  driverId: string;
  orderedOrderIds: string[];
  totalDuration: number;
}

export interface DispatchResult {
  assignments: DispatchAssignment[];
  unassignedOrderIds: string[];
  usedOsrm: boolean;
}

export interface EtaStop {
  orderId: string;
  sequence: number;
  etaMinutes: number | null;
  etaTimestamp: string | null;
  distanceKm: number | null;
}

export interface EtaResult {
  routeId: string;
  stops: EtaStop[];
  totalEtaMinutes: number;
  calculatedAt: string;
  source: 'google' | 'osrm' | 'haversine';
}

// ---- Route Optimization (single vehicle TSP) ----

export async function optimizeRouteStops(
  stops: StopData[],
  depot?: DepotData,
): Promise<OptimizedRoute> {
  if (stops.length <= 1) {
    return {
      orderedStopIds: stops.map(s => s.id),
      orderedIndices: stops.map((_, i) => i),
      totalDuration: 0,
      totalDistance: 0,
      geometry: '',
      usedOsrm: false,
    };
  }

  // Build coordinate array: [depot, ...stops]
  const coords: [number, number][] = [];
  let depotIndex: number | undefined;

  if (depot) {
    depotIndex = 0;
    coords.push([depot.lat, depot.lng]);
  }

  const stopStartIndex = coords.length;
  for (const stop of stops) {
    coords.push([stop.lat, stop.lng]);
  }

  const stopMatrixIndices = stops.map((_, i) => stopStartIndex + i);

  // Try OSRM for distance matrix
  let matrix: number[][];
  let usedOsrm = false;

  try {
    const osrmResult = await getDistanceMatrix(coords);
    matrix = osrmResult.durations;
    usedOsrm = true;
  } catch (err) {
    await trackFallback('optimizeRouteStops', err);
    matrix = buildHaversineMatrix(coords);
  }

  // Solve TSP
  const optimizedMatrixOrder = solveTSP(matrix, stopMatrixIndices, depotIndex);

  // Map matrix indices back to stop indices
  const orderedIndices = optimizedMatrixOrder.map(mi => mi - stopStartIndex);
  const orderedStopIds = orderedIndices.map(i => stops[i].id);

  // Calculate total duration from the solved tour
  const totalDuration = tourDuration(matrix, optimizedMatrixOrder, depotIndex);

  // Try to get route geometry from OSRM
  let geometry = '';
  let totalDistance = 0;

  if (usedOsrm) {
    try {
      const routeCoords: [number, number][] = [];
      if (depot) routeCoords.push([depot.lat, depot.lng]);
      for (const idx of orderedIndices) {
        routeCoords.push([stops[idx].lat, stops[idx].lng]);
      }
      const routeResult = await getRoute(routeCoords);
      geometry = routeResult.geometry;
      totalDistance = routeResult.distance;
    } catch {
      // Geometry is optional — ignore errors
    }
  }

  if (totalDistance === 0) {
    // Estimate from matrix (distances in meters if OSRM, or haversine km * 1000)
    totalDistance = estimateTotalDistance(coords, optimizedMatrixOrder, depotIndex, usedOsrm);
  }

  return {
    orderedStopIds,
    orderedIndices,
    totalDuration,
    totalDistance,
    geometry,
    usedOsrm,
  };
}

// ---- Dispatch (multi-vehicle CVRPTW) ----

export async function dispatchOrders(
  drivers: DriverData[],
  orders: DispatchOrderData[],
  options: DispatchOptions,
): Promise<DispatchResult> {
  if (orders.length === 0 || drivers.length === 0) {
    return {
      assignments: [],
      unassignedOrderIds: orders.map(o => o.id),
      usedOsrm: false,
    };
  }

  // Build coordinate array: [depot?, ...drivers, ...orders]
  const coords: [number, number][] = [];
  let depotIndex: number | undefined;

  if (options.depotLat != null && options.depotLng != null) {
    depotIndex = 0;
    coords.push([options.depotLat, options.depotLng]);
  }

  const driverStartIndex = coords.length;
  for (const d of drivers) {
    coords.push([d.lat, d.lng]);
  }

  const orderStartIndex = coords.length;
  for (const o of orders) {
    coords.push([o.lat, o.lng]);
  }

  // Get distance matrix
  let matrix: number[][];
  let usedOsrm = false;

  try {
    const osrmResult = await getDistanceMatrix(coords);
    matrix = osrmResult.durations;
    usedOsrm = true;
  } catch (err) {
    await trackFallback('dispatchOrders', err);
    matrix = buildHaversineMatrix(coords);
  }

  // Build solver input
  const solverInput: CVRPTWInput = {
    matrix,
    drivers: drivers.map((d, i) => ({
      id: d.id,
      matrixIndex: driverStartIndex + i,
      capacity: d.capacity,
    })),
    orders: orders.map((o, i) => ({
      id: o.id,
      matrixIndex: orderStartIndex + i,
      demand: o.demand,
      priority: typeof o.priority === 'number' ? o.priority : ({ urgent: 3, high: 2, normal: 1, low: 0 }[o.priority as string] ?? 1),
      timeWindow: o.timeWindow,
    })),
    depotIndex,
    maxOrdersPerRoute: options.maxOrdersPerRoute,
  };

  const result: CVRPTWResult = solveCVRPTW(solverInput);

  return {
    assignments: result.assignments.map(a => ({
      driverId: a.driverId,
      orderedOrderIds: a.orderIndices.map(i => orders[i].id),
      totalDuration: a.totalDuration,
    })),
    unassignedOrderIds: result.unassignedOrderIndices.map(i => orders[i].id),
    usedOsrm,
  };
}

// ---- Traffic-Aware ETAs ----

/**
 * Get ETAs for ordered stops on a route.
 * Fallback chain: Google Routes (cached) → OSRM → haversine
 */
export async function getTrafficAwareETAs(
  routeId: string,
  origin: [number, number],
  stops: { orderId: string; sequence: number; lat: number; lng: number; serviceDurationMinutes?: number }[],
  vehicleType: string,
): Promise<EtaResult> {
  const now = new Date();

  if (stops.length === 0) {
    return { routeId, stops: [], totalEtaMinutes: 0, calculatedAt: now.toISOString(), source: 'haversine' };
  }

  const type = vehicleType as keyof typeof dwellTimesMinutes;
  const dwell = dwellTimesMinutes[type] ?? dwellTimesMinutes.car;

  // Try Google Routes API first (cached)
  const waypoints: [number, number][] = stops.map(s => [s.lat, s.lng]);
  const googleResult = await computeRouteETAs(routeId, origin, waypoints);

  if (googleResult && googleResult.legs.length > 0) {
    return buildEtaResult(routeId, stops, googleResult.legs.map(l => ({
      durationSeconds: l.durationSeconds,
      distanceMeters: l.distanceMeters,
    })), dwell, now, 'google');
  }

  // Try OSRM route
  try {
    const routeCoords: [number, number][] = [origin, ...waypoints];
    const osrmResult = await getDistanceMatrix(routeCoords);

    // Extract sequential leg durations/distances from matrix
    const legs = [];
    for (let i = 0; i < routeCoords.length - 1; i++) {
      legs.push({
        durationSeconds: osrmResult.durations[i][i + 1],
        distanceMeters: osrmResult.distances[i][i + 1],
      });
    }

    return buildEtaResult(routeId, stops, legs, dwell, now, 'osrm');
  } catch (err) {
    await trackFallback('getTrafficAwareETAs/osrm', err);
  }

  // Haversine fallback
  const legs = [];
  let prevLat = origin[0];
  let prevLng = origin[1];

  for (const stop of stops) {
    const dist = haversineDistance(prevLat, prevLng, stop.lat, stop.lng);
    const etaMin = estimateEtaMinutes(prevLat, prevLng, stop.lat, stop.lng, vehicleType);
    legs.push({
      durationSeconds: etaMin * 60,
      distanceMeters: dist * 1000,
    });
    prevLat = stop.lat;
    prevLng = stop.lng;
  }

  return buildEtaResult(routeId, stops, legs, dwell, now, 'haversine');
}

/**
 * Get ETAs using OSRM only (no Google). For high-frequency driver location updates.
 */
export async function getOsrmETAs(
  routeId: string,
  origin: [number, number],
  stops: { orderId: string; sequence: number; lat: number; lng: number; serviceDurationMinutes?: number }[],
  vehicleType: string,
): Promise<EtaResult> {
  const now = new Date();
  const type = vehicleType as keyof typeof dwellTimesMinutes;
  const dwell = dwellTimesMinutes[type] ?? dwellTimesMinutes.car;

  if (stops.length === 0) {
    return { routeId, stops: [], totalEtaMinutes: 0, calculatedAt: now.toISOString(), source: 'osrm' };
  }

  try {
    const routeCoords: [number, number][] = [origin, ...stops.map(s => [s.lat, s.lng] as [number, number])];
    const osrmResult = await getDistanceMatrix(routeCoords);

    const legs = [];
    for (let i = 0; i < routeCoords.length - 1; i++) {
      legs.push({
        durationSeconds: osrmResult.durations[i][i + 1],
        distanceMeters: osrmResult.distances[i][i + 1],
      });
    }

    return buildEtaResult(routeId, stops, legs, dwell, now, 'osrm');
  } catch (err) {
    await trackFallback('getOsrmETAs', err);
    const legs = [];
    let prevLat = origin[0];
    let prevLng = origin[1];

    for (const stop of stops) {
      const dist = haversineDistance(prevLat, prevLng, stop.lat, stop.lng);
      const etaMin = estimateEtaMinutes(prevLat, prevLng, stop.lat, stop.lng, vehicleType);
      legs.push({
        durationSeconds: etaMin * 60,
        distanceMeters: dist * 1000,
      });
      prevLat = stop.lat;
      prevLng = stop.lng;
    }

    return buildEtaResult(routeId, stops, legs, dwell, now, 'haversine');
  }
}

// ---- Helpers ----

function buildEtaResult(
  routeId: string,
  stops: { orderId: string; sequence: number; lat: number; lng: number; serviceDurationMinutes?: number }[],
  legs: { durationSeconds: number; distanceMeters: number }[],
  dwellMinutes: number,
  now: Date,
  source: 'google' | 'osrm' | 'haversine',
): EtaResult {
  let cumulativeMinutes = 0;

  const etaStops: EtaStop[] = stops.map((stop, i) => {
    const leg = legs[i];
    if (!leg) {
      return {
        orderId: stop.orderId,
        sequence: stop.sequence,
        etaMinutes: null,
        etaTimestamp: null,
        distanceKm: null,
      };
    }

    const travelMinutes = leg.durationSeconds / 60;
    const stopDwell = stop.serviceDurationMinutes ?? dwellMinutes;
    cumulativeMinutes += travelMinutes + stopDwell;
    const etaTimestamp = new Date(now.getTime() + cumulativeMinutes * 60_000);

    return {
      orderId: stop.orderId,
      sequence: stop.sequence,
      etaMinutes: Math.round(cumulativeMinutes * 10) / 10,
      etaTimestamp: etaTimestamp.toISOString(),
      distanceKm: Math.round(leg.distanceMeters / 10) / 100, // meters → km, 2 decimal
    };
  });

  return {
    routeId,
    stops: etaStops,
    totalEtaMinutes: Math.round(cumulativeMinutes * 10) / 10,
    calculatedAt: now.toISOString(),
    source,
  };
}

function buildHaversineMatrix(coords: [number, number][]): number[][] {
  const n = coords.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  // Use a generic 30 km/h average speed for duration estimation
  const speedKmh = 30;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = haversineDistance(coords[i][0], coords[i][1], coords[j][0], coords[j][1]);
      const roadDist = dist * 1.3; // road correction factor
      matrix[i][j] = (roadDist / speedKmh) * 3600; // seconds
    }
  }
  return matrix;
}

function estimateTotalDistance(
  coords: [number, number][],
  tour: number[],
  depotIndex: number | undefined,
  usedOsrm: boolean,
): number {
  let total = 0;
  let prev = depotIndex ?? tour[0];

  for (const stop of tour) {
    if (stop === prev && depotIndex === undefined) continue;
    const dist = haversineDistance(coords[prev][0], coords[prev][1], coords[stop][0], coords[stop][1]);
    total += dist * 1.3 * 1000; // road correction, km → meters
    prev = stop;
  }
  return Math.round(total);
}

