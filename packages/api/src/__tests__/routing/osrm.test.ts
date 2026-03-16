import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDistanceMatrix, getRoute, isOsrmAvailable } from '../../lib/routing/osrm.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('getDistanceMatrix', () => {
  it('returns empty matrix for no coordinates', async () => {
    const result = await getDistanceMatrix([]);
    expect(result.durations).toEqual([]);
    expect(result.distances).toEqual([]);
  });

  it('flips lat/lng to lng/lat for OSRM', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [[0, 100], [100, 0]],
        distances: [[0, 5000], [5000, 0]],
      }),
    });

    await getDistanceMatrix([[40.7128, -74.006], [34.0522, -118.2437]]);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    // OSRM expects lng,lat — verify the coordinates are flipped
    expect(calledUrl).toContain('-74.006,40.7128');
    expect(calledUrl).toContain('-118.2437,34.0522');
    expect(calledUrl).toContain('/table/v1/driving/');
    expect(calledUrl).toContain('annotations=duration,distance');
  });

  it('returns durations and distances', async () => {
    const durations = [[0, 120], [120, 0]];
    const distances = [[0, 5000], [5000, 0]];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'Ok', durations, distances }),
    });

    const result = await getDistanceMatrix([[40, -74], [34, -118]]);
    expect(result.durations).toEqual(durations);
    expect(result.distances).toEqual(distances);
  });

  it('throws on OSRM error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 'InvalidUrl', message: 'Bad coordinates' }),
    });

    await expect(getDistanceMatrix([[40, -74]])).rejects.toThrow('OSRM table error');
  });

  it('retries on 5xx errors', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          durations: [[0, 100], [100, 0]],
          distances: [[0, 5000], [5000, 0]],
        }),
      });

    const result = await getDistanceMatrix([[40, -74], [34, -118]]);
    expect(result.durations).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('getRoute', () => {
  it('returns empty for less than 2 coords', async () => {
    const result = await getRoute([[40, -74]]);
    expect(result.distance).toBe(0);
    expect(result.duration).toBe(0);
    expect(result.geometry).toBe('');
  });

  it('returns route geometry and metrics', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 15000,
          duration: 900,
          geometry: 'encoded_polyline_data',
        }],
      }),
    });

    const result = await getRoute([[40, -74], [34, -118]]);
    expect(result.distance).toBe(15000);
    expect(result.duration).toBe(900);
    expect(result.geometry).toBe('encoded_polyline_data');

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/route/v1/driving/');
    expect(calledUrl).toContain('overview=full');
  });
});

describe('isOsrmAvailable', () => {
  it('returns true when OSRM responds OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    expect(await isOsrmAvailable()).toBe(true);
  });

  it('returns false when OSRM is down', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await isOsrmAvailable()).toBe(false);
  });
});
