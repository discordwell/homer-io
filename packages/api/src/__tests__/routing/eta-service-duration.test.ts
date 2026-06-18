import { describe, it, expect, vi } from 'vitest';

// Mock all external routing to force haversine fallback, which exercises buildEtaResult directly
vi.mock('../../lib/routing/osrm.js', () => ({
  getDistanceMatrix: vi.fn().mockRejectedValue(new Error('OSRM unavailable')),
  getRoute: vi.fn().mockRejectedValue(new Error('OSRM unavailable')),
  isOsrmAvailable: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../lib/routing/google-routes.js', () => ({
  computeRouteETAs: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/cache.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

import { getTrafficAwareETAs, getOsrmETAs } from '../../lib/routing/index.js';
import { estimateTravelMinutes } from '../../lib/geo.js';
import { dwellTimesMinutes } from '@homer-io/shared';

const ORIGIN: [number, number] = [37.7749, -122.4194]; // SF
const S1 = { lat: 37.7849, lng: -122.4094 };
const S2 = { lat: 37.7949, lng: -122.3994 };
const CAR_DWELL = dwellTimesMinutes.car; // 3 min

describe('ETA — per-stop serviceDurationMinutes override', () => {
  it('uses vehicle-type default dwell when no per-stop override', async () => {
    const result = await getTrafficAwareETAs(
      'route-1',
      [37.7749, -122.4194], // SF origin
      [
        { orderId: 'o1', sequence: 1, lat: 37.7849, lng: -122.4094 },
        { orderId: 'o2', sequence: 2, lat: 37.7949, lng: -122.3994 },
      ],
      'car', // car default dwell = 3 min
    );

    expect(result.source).toBe('haversine');
    expect(result.stops).toHaveLength(2);
    // Both stops use default car dwell (3 min)
    // Stop 1 ETA = travel1 + 3
    // Stop 2 ETA = travel1 + 3 + travel2 + 3
    const stop1 = result.stops[0];
    const stop2 = result.stops[1];
    expect(stop1.etaMinutes).toBeGreaterThan(0);
    expect(stop2.etaMinutes).toBeGreaterThan(stop1.etaMinutes!);
    // The difference between stop2 and stop1 should include 3 min dwell
    const diff = stop2.etaMinutes! - stop1.etaMinutes!;
    expect(diff).toBeGreaterThanOrEqual(3); // at least 3 min dwell
  });

  it('uses per-stop serviceDurationMinutes when provided', async () => {
    const result = await getTrafficAwareETAs(
      'route-2',
      [37.7749, -122.4194],
      [
        { orderId: 'o1', sequence: 1, lat: 37.7849, lng: -122.4094, serviceDurationMinutes: 15 },
        { orderId: 'o2', sequence: 2, lat: 37.7949, lng: -122.3994 }, // falls back to default
      ],
      'car',
    );

    expect(result.source).toBe('haversine');
    expect(result.stops).toHaveLength(2);
    // Stop 1 uses 15 min dwell (override)
    // Stop 2 uses 3 min dwell (car default)
    const stop1 = result.stops[0];
    const stop2 = result.stops[1];
    expect(stop1.etaMinutes).toBeGreaterThan(0);
    expect(stop2.etaMinutes).toBeGreaterThan(stop1.etaMinutes!);
  });

  it('total ETA reflects mixed per-stop durations', async () => {
    // Two identical-distance stops, one with 30 min override, one with default 3 min
    const resultWithOverride = await getTrafficAwareETAs(
      'route-3a',
      [37.7749, -122.4194],
      [
        { orderId: 'o1', sequence: 1, lat: 37.7849, lng: -122.4094, serviceDurationMinutes: 30 },
        { orderId: 'o2', sequence: 2, lat: 37.7949, lng: -122.3994, serviceDurationMinutes: 30 },
      ],
      'car',
    );

    const resultDefault = await getTrafficAwareETAs(
      'route-3b',
      [37.7749, -122.4194],
      [
        { orderId: 'o1', sequence: 1, lat: 37.7849, lng: -122.4094 },
        { orderId: 'o2', sequence: 2, lat: 37.7949, lng: -122.3994 },
      ],
      'car',
    );

    // With 30 min overrides (total 60 min dwell) vs default 3 min (total 6 min dwell)
    // Same travel time, so the difference should be ~54 min
    const dwellDiff = resultWithOverride.totalEtaMinutes - resultDefault.totalEtaMinutes;
    expect(dwellDiff).toBeCloseTo(54, 0); // 2 stops × (30 - 3) = 54
  });
});

// Regression guard for the dwell double-counting bug: the haversine fallback
// must put TRAVEL TIME ONLY into each leg, because buildEtaResult adds the
// stop's dwell itself. The previous code used estimateEtaMinutes (travel +
// dwell) per leg, so dwell was counted twice and the error compounded by stop:
// stop N's ETA was inflated by N × dwell. These tests assert the absolute ETA,
// which the older relative-only assertions above could not catch.
describe('ETA — haversine fallback does not double-count dwell (regression)', () => {
  it('getTrafficAwareETAs: each stop ETA = cumulative travel + exactly one dwell per stop', async () => {
    const result = await getTrafficAwareETAs(
      'route-dwell-1',
      ORIGIN,
      [
        { orderId: 'o1', sequence: 1, lat: S1.lat, lng: S1.lng },
        { orderId: 'o2', sequence: 2, lat: S2.lat, lng: S2.lng },
      ],
      'car',
    );

    expect(result.source).toBe('haversine');

    const travel1 = estimateTravelMinutes(ORIGIN[0], ORIGIN[1], S1.lat, S1.lng, 'car');
    const travel2 = estimateTravelMinutes(S1.lat, S1.lng, S2.lat, S2.lng, 'car');

    // Stop 1: travel(origin→s1) + ONE dwell  (old buggy code gave travel1 + 2×dwell)
    expect(result.stops[0].etaMinutes!).toBeCloseTo(travel1 + CAR_DWELL, 1);
    // Stop 2: cumulative travel + exactly TWO dwells (old buggy code gave +4 dwells)
    expect(result.stops[1].etaMinutes!).toBeCloseTo(travel1 + travel2 + 2 * CAR_DWELL, 1);
    expect(result.totalEtaMinutes).toBeCloseTo(travel1 + travel2 + 2 * CAR_DWELL, 1);
  });

  it('getOsrmETAs: same travel-only legs on OSRM-failure fallback', async () => {
    const result = await getOsrmETAs(
      'route-dwell-2',
      ORIGIN,
      [
        { orderId: 'o1', sequence: 1, lat: S1.lat, lng: S1.lng },
        { orderId: 'o2', sequence: 2, lat: S2.lat, lng: S2.lng },
      ],
      'car',
    );

    expect(result.source).toBe('haversine');

    const travel1 = estimateTravelMinutes(ORIGIN[0], ORIGIN[1], S1.lat, S1.lng, 'car');
    const travel2 = estimateTravelMinutes(S1.lat, S1.lng, S2.lat, S2.lng, 'car');

    expect(result.stops[0].etaMinutes!).toBeCloseTo(travel1 + CAR_DWELL, 1);
    expect(result.stops[1].etaMinutes!).toBeCloseTo(travel1 + travel2 + 2 * CAR_DWELL, 1);
  });

  it('per-stop serviceDurationMinutes override is added exactly once', async () => {
    const override = 15;
    const result = await getTrafficAwareETAs(
      'route-dwell-3',
      ORIGIN,
      [{ orderId: 'o1', sequence: 1, lat: S1.lat, lng: S1.lng, serviceDurationMinutes: override }],
      'car',
    );

    const travel1 = estimateTravelMinutes(ORIGIN[0], ORIGIN[1], S1.lat, S1.lng, 'car');
    // travel + the 15-min override once — not override + default, not override twice
    expect(result.stops[0].etaMinutes!).toBeCloseTo(travel1 + override, 1);
  });
});
