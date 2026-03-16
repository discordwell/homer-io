/**
 * Google Routes API client for traffic-aware ETAs.
 *
 * Used only for customer-facing ETAs on finalized routes — not for
 * distance matrices (OSRM handles that). Cached aggressively in Redis.
 */

import { config } from '../../config.js';
import { cacheGet, cacheSet } from '../cache.js';
import { createHash } from 'crypto';

export interface RouteLeg {
  durationSeconds: number;
  distanceMeters: number;
}

export interface GoogleRouteResult {
  legs: RouteLeg[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
}

const CACHE_TTL_SECONDS = 300; // 5 minutes
const RATE_LIMIT_PER_SEC = 10;

// Simple in-memory token bucket for rate limiting
let tokenBucket = RATE_LIMIT_PER_SEC;
let lastRefill = Date.now();

function acquireToken(): boolean {
  const now = Date.now();
  const elapsed = (now - lastRefill) / 1000;
  tokenBucket = Math.min(RATE_LIMIT_PER_SEC, tokenBucket + elapsed * RATE_LIMIT_PER_SEC);
  lastRefill = now;

  if (tokenBucket >= 1) {
    tokenBucket -= 1;
    return true;
  }
  return false;
}

/**
 * Compute traffic-aware ETAs for an ordered route.
 *
 * @param routeId - Used for cache key
 * @param origin - Starting point [lat, lng]
 * @param waypoints - Ordered intermediate stops [lat, lng][]
 * @param destination - Final stop [lat, lng] (last waypoint if not specified)
 */
export async function computeRouteETAs(
  routeId: string,
  origin: [number, number],
  waypoints: [number, number][],
): Promise<GoogleRouteResult | null> {
  if (!config.google.routesApiKey) {
    return null;
  }

  if (waypoints.length === 0) {
    return { legs: [], totalDurationSeconds: 0, totalDistanceMeters: 0 };
  }

  // Check cache
  const cacheKey = buildCacheKey(routeId, origin, waypoints);
  const cached = await cacheGet<GoogleRouteResult>(cacheKey);
  if (cached) return cached;

  // Rate limit check
  if (!acquireToken()) {
    return null; // Let caller fall back to OSRM
  }

  try {
    const destination = waypoints[waypoints.length - 1];
    const intermediates = waypoints.slice(0, -1);

    const body: Record<string, unknown> = {
      origin: {
        location: {
          latLng: { latitude: origin[0], longitude: origin[1] },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destination[0], longitude: destination[1] },
        },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    if (intermediates.length > 0) {
      body.intermediates = intermediates.map(([lat, lng]) => ({
        location: {
          latLng: { latitude: lat, longitude: lng },
        },
      }));
    }

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.google.routesApiKey,
        'X-Goog-FieldMask': 'routes.legs.duration,routes.legs.distanceMeters',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[google-routes] HTTP ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route?.legs) return null;

    const legs: RouteLeg[] = route.legs.map((leg: any) => ({
      durationSeconds: parseDuration(leg.duration),
      distanceMeters: leg.distanceMeters ?? 0,
    }));

    const result: GoogleRouteResult = {
      legs,
      totalDurationSeconds: legs.reduce((sum, l) => sum + l.durationSeconds, 0),
      totalDistanceMeters: legs.reduce((sum, l) => sum + l.distanceMeters, 0),
    };

    // Cache the result
    await cacheSet(cacheKey, result, CACHE_TTL_SECONDS);

    return result;
  } catch (err) {
    console.error('[google-routes] Error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Check if Google Routes API is configured.
 */
export function isGoogleRoutesConfigured(): boolean {
  return !!config.google.routesApiKey;
}

// ---- Internal ----

function buildCacheKey(
  routeId: string,
  origin: [number, number],
  waypoints: [number, number][],
): string {
  const hash = createHash('md5')
    .update(JSON.stringify({ origin, waypoints }))
    .digest('hex')
    .slice(0, 12);
  return `eta:${routeId}:${hash}`;
}

/** Parse Google's duration format ("123s" or "123.456s") to seconds */
function parseDuration(duration: string | undefined): number {
  if (!duration) return 0;
  const match = String(duration).match(/([\d.]+)s/);
  return match ? Math.round(parseFloat(match[1])) : 0;
}
