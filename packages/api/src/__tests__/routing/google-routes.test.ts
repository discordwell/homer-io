import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeRouteETAs, isGoogleRoutesConfigured } from '../../lib/routing/google-routes.js';

// Mock fetch and cache
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../lib/cache.js', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config.js', () => ({
  config: {
    google: { routesApiKey: 'test-api-key' },
    osrm: { url: 'http://localhost:5000' },
    redis: { url: 'redis://localhost:6379' },
  },
}));

beforeEach(() => {
  mockFetch.mockReset();
});

describe('computeRouteETAs', () => {
  it('returns empty for no waypoints', async () => {
    const result = await computeRouteETAs('route1', [40, -74], []);
    expect(result).toEqual({
      legs: [],
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
    });
  });

  it('calls Google Routes API with correct format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          legs: [
            { duration: '300s', distanceMeters: 5000 },
            { duration: '600s', distanceMeters: 10000 },
          ],
        }],
      }),
    });

    const result = await computeRouteETAs(
      'route1',
      [40.7128, -74.006],
      [[40.7580, -73.9855], [40.7484, -73.9857]],
    );

    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(2);
    expect(result!.legs[0].durationSeconds).toBe(300);
    expect(result!.legs[1].durationSeconds).toBe(600);
    expect(result!.totalDurationSeconds).toBe(900);
    expect(result!.totalDistanceMeters).toBe(15000);

    // Verify API call
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('routes.googleapis.com');
    expect(options.headers['X-Goog-Api-Key']).toBe('test-api-key');
    expect(options.headers['X-Goog-FieldMask']).toContain('routes.legs.duration');

    const body = JSON.parse(options.body);
    expect(body.travelMode).toBe('DRIVE');
    expect(body.routingPreference).toBe('TRAFFIC_AWARE');
  });

  it('returns null on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    const result = await computeRouteETAs('route1', [40, -74], [[34, -118]]);
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await computeRouteETAs('route1', [40, -74], [[34, -118]]);
    expect(result).toBeNull();
  });
});

describe('isGoogleRoutesConfigured', () => {
  it('returns true when API key is set', () => {
    expect(isGoogleRoutesConfigured()).toBe(true);
  });
});
