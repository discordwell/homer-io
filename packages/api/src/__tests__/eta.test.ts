import { describe, it, expect } from 'vitest';
import { etaResponseSchema, vehicleSpeedsKmh, dwellTimesMinutes } from '@homer-io/shared';

describe('ETA schemas', () => {
  it('has correct vehicle speeds', () => {
    expect(vehicleSpeedsKmh.bike).toBe(15);
    expect(vehicleSpeedsKmh.car).toBe(30);
    expect(vehicleSpeedsKmh.van).toBe(28);
    expect(vehicleSpeedsKmh.truck).toBe(22);
    expect(vehicleSpeedsKmh.motorcycle).toBe(35);
    expect(vehicleSpeedsKmh.cargo_bike).toBe(12);
  });

  it('has correct dwell times', () => {
    expect(dwellTimesMinutes.bike).toBe(2);
    expect(dwellTimesMinutes.car).toBe(3);
    expect(dwellTimesMinutes.van).toBe(4);
    expect(dwellTimesMinutes.truck).toBe(5);
  });

  it('validates ETA response schema', () => {
    const valid = etaResponseSchema.parse({
      routeId: 'route-123',
      stops: [
        {
          orderId: 'order-1',
          sequence: 1,
          etaMinutes: 12.5,
          etaTimestamp: '2026-03-14T10:00:00.000Z',
          distanceKm: 5.2,
        },
        {
          orderId: 'order-2',
          sequence: 2,
          etaMinutes: 25.0,
          etaTimestamp: '2026-03-14T10:12:30.000Z',
          distanceKm: 3.8,
        },
      ],
      totalEtaMinutes: 25.0,
      calculatedAt: '2026-03-14T09:47:30.000Z',
    });
    expect(valid.stops).toHaveLength(2);
    expect(valid.totalEtaMinutes).toBe(25.0);
  });
});
