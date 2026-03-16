/**
 * OSRM HTTP client for distance/duration matrices and route computation.
 *
 * OSRM expects coordinates as lng,lat (not lat,lng).
 * The table API supports up to ~100 coordinates per request.
 */

import { config } from '../../config.js';

export interface DistanceMatrix {
  durations: number[][]; // seconds
  distances: number[][]; // meters
}

export interface RouteResult {
  distance: number; // meters
  duration: number; // seconds
  geometry: string; // polyline-encoded geometry
}

const OSRM_TABLE_LIMIT = 100;
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

/**
 * Get N×N duration and distance matrix from OSRM.
 * @param coords - Array of [lat, lng] pairs (DB format)
 */
export async function getDistanceMatrix(
  coords: [number, number][],
): Promise<DistanceMatrix> {
  if (coords.length === 0) {
    return { durations: [], distances: [] };
  }

  if (coords.length <= OSRM_TABLE_LIMIT) {
    return fetchTable(coords);
  }

  // Batch: for >100 coords, compute full matrix in tiles
  return fetchTableBatched(coords);
}

/**
 * Get a route through an ordered list of waypoints.
 * @param coords - Array of [lat, lng] pairs in visit order
 */
export async function getRoute(
  coords: [number, number][],
): Promise<RouteResult> {
  if (coords.length < 2) {
    return { distance: 0, duration: 0, geometry: '' };
  }

  const coordStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${config.osrm.url}/route/v1/driving/${coordStr}?overview=full&geometries=polyline`;

  const data = await osrmFetch(url);

  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(`OSRM route error: ${data.code} ${data.message || ''}`);
  }

  const route = data.routes[0];
  return {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry,
  };
}

/**
 * Check if the OSRM service is reachable.
 */
export async function isOsrmAvailable(): Promise<boolean> {
  try {
    const res = await fetch(config.osrm.url, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- Internal ----

async function fetchTable(coords: [number, number][]): Promise<DistanceMatrix> {
  // OSRM expects lng,lat
  const coordStr = coords.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `${config.osrm.url}/table/v1/driving/${coordStr}?annotations=duration,distance`;

  const data = await osrmFetch(url);

  if (data.code !== 'Ok') {
    throw new Error(`OSRM table error: ${data.code} ${data.message || ''}`);
  }

  return {
    durations: data.durations,
    distances: data.distances,
  };
}

async function fetchTableBatched(coords: [number, number][]): Promise<DistanceMatrix> {
  const n = coords.length;
  const durations: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const distances: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Build tiles of source×destination pairs within the OSRM limit
  // Strategy: send all coords but use sources/destinations params to partition
  // OSRM supports sources=0;1;2&destinations=3;4;5 to get a rectangular submatrix
  const batchSize = Math.floor(OSRM_TABLE_LIMIT / 2); // sources and destinations each get half

  for (let srcStart = 0; srcStart < n; srcStart += batchSize) {
    const srcEnd = Math.min(srcStart + batchSize, n);
    for (let dstStart = 0; dstStart < n; dstStart += batchSize) {
      const dstEnd = Math.min(dstStart + batchSize, n);

      // Build deduplicated coordinate list for this tile
      const tileIndices = new Set<number>();
      for (let i = srcStart; i < srcEnd; i++) tileIndices.add(i);
      for (let j = dstStart; j < dstEnd; j++) tileIndices.add(j);
      const tileArr = [...tileIndices].sort((a, b) => a - b);

      // Map original indices to tile-local indices
      const origToTile = new Map<number, number>();
      tileArr.forEach((orig, tileIdx) => origToTile.set(orig, tileIdx));

      const tileCoords = tileArr.map(i => coords[i]);
      const coordStr = tileCoords.map(([lat, lng]) => `${lng},${lat}`).join(';');

      const sources = [];
      for (let i = srcStart; i < srcEnd; i++) sources.push(origToTile.get(i)!);
      const destinations = [];
      for (let j = dstStart; j < dstEnd; j++) destinations.push(origToTile.get(j)!);

      const url = `${config.osrm.url}/table/v1/driving/${coordStr}` +
        `?annotations=duration,distance` +
        `&sources=${sources.join(';')}` +
        `&destinations=${destinations.join(';')}`;

      const data = await osrmFetch(url);
      if (data.code !== 'Ok') {
        throw new Error(`OSRM batch table error: ${data.code} ${data.message || ''}`);
      }

      // Copy results into the full matrix
      for (let si = 0; si < srcEnd - srcStart; si++) {
        for (let di = 0; di < dstEnd - dstStart; di++) {
          durations[srcStart + si][dstStart + di] = data.durations[si][di];
          distances[srcStart + si][dstStart + di] = data.distances[si][di];
        }
      }
    }
  }

  return { durations, distances };
}

async function osrmFetch(url: string, retryCount = 0): Promise<any> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 500 && retryCount < MAX_RETRIES) {
      return osrmFetch(url, retryCount + 1);
    }

    if (!res.ok) {
      throw new Error(`OSRM HTTP ${res.status}: ${res.statusText}`);
    }

    return res.json();
  } catch (err) {
    if (retryCount < MAX_RETRIES && err instanceof TypeError) {
      // Network error — retry once
      return osrmFetch(url, retryCount + 1);
    }
    throw err;
  }
}
