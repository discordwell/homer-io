/**
 * Minimal OSRM client for the worker package.
 * Same interface as the API's OSRM client but reads from worker config.
 */

import { config } from '../../lib/config.js';

export interface DistanceMatrix {
  durations: number[][];
  distances: number[][];
}

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

export async function getDistanceMatrix(
  coords: [number, number][],
): Promise<DistanceMatrix> {
  if (coords.length === 0) {
    return { durations: [], distances: [] };
  }

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
      return osrmFetch(url, retryCount + 1);
    }
    throw err;
  }
}
