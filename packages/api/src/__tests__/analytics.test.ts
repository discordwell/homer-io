import { describe, it, expect } from 'vitest';
import {
  analyticsQuerySchema, driverPerformanceSchema,
  routeEfficiencySchema, trendPointSchema, analyticsOverviewSchema,
} from '@homer-io/shared';

describe('Analytics - Query Schema', () => {
  it('defaults range to 7d', () => {
    expect(analyticsQuerySchema.parse({}).range).toBe('7d');
  });

  it('accepts 30d and 90d', () => {
    expect(analyticsQuerySchema.parse({ range: '30d' }).range).toBe('30d');
    expect(analyticsQuerySchema.parse({ range: '90d' }).range).toBe('90d');
  });

  it('rejects invalid range', () => {
    expect(() => analyticsQuerySchema.parse({ range: '1d' })).toThrow();
    expect(() => analyticsQuerySchema.parse({ range: '365d' })).toThrow();
  });
});

describe('Analytics - Driver Performance', () => {
  it('validates complete driver stats', () => {
    const result = driverPerformanceSchema.parse({
      driverId: '550e8400-e29b-41d4-a716-446655440000',
      driverName: 'Alice',
      totalDeliveries: 200,
      successRate: 97.5,
      avgDeliveryTime: 18.3,
      totalDistance: 2500,
    });
    expect(result.driverName).toBe('Alice');
    expect(result.totalDeliveries).toBe(200);
  });

  it('accepts nullable time and distance', () => {
    const result = driverPerformanceSchema.parse({
      driverId: '550e8400-e29b-41d4-a716-446655440000',
      driverName: 'Bob',
      totalDeliveries: 0,
      successRate: 0,
      avgDeliveryTime: null,
      totalDistance: null,
    });
    expect(result.avgDeliveryTime).toBeNull();
  });

  it('rejects non-UUID driver ID', () => {
    expect(() => driverPerformanceSchema.parse({
      driverId: 'bad-id',
      driverName: 'X',
      totalDeliveries: 0,
      successRate: 0,
      avgDeliveryTime: null,
      totalDistance: null,
    })).toThrow();
  });
});

describe('Analytics - Route Efficiency', () => {
  it('validates route efficiency stats', () => {
    const result = routeEfficiencySchema.parse({
      totalRoutes: 100,
      completedRoutes: 85,
      avgStopsPerRoute: 15,
      avgCompletionRate: 92.3,
      avgDuration: 145,
    });
    expect(result.totalRoutes).toBe(100);
    expect(result.avgCompletionRate).toBe(92.3);
  });

  it('accepts null avgDuration', () => {
    const result = routeEfficiencySchema.parse({
      totalRoutes: 0, completedRoutes: 0,
      avgStopsPerRoute: 0, avgCompletionRate: 0,
      avgDuration: null,
    });
    expect(result.avgDuration).toBeNull();
  });
});

describe('Analytics - Trend Points', () => {
  it('validates a single trend point', () => {
    const result = trendPointSchema.parse({
      date: '2026-03-14',
      deliveries: 50,
      failedDeliveries: 3,
      newOrders: 60,
    });
    expect(result.date).toBe('2026-03-14');
    expect(result.deliveries).toBe(50);
  });

  it('rejects missing fields', () => {
    expect(() => trendPointSchema.parse({ date: '2026-03-14' })).toThrow();
  });
});

describe('Analytics - Overview', () => {
  it('validates complete overview', () => {
    const result = analyticsOverviewSchema.parse({
      totalDeliveries: 1000,
      successRate: 96.2,
      avgDeliveryTime: 25,
      totalRoutes: 200,
      totalDistance: 15000,
      ordersReceived: 1200,
    });
    expect(result.totalDeliveries).toBe(1000);
    expect(result.ordersReceived).toBe(1200);
  });

  it('accepts null time and distance', () => {
    const result = analyticsOverviewSchema.parse({
      totalDeliveries: 0, successRate: 0,
      avgDeliveryTime: null, totalRoutes: 0,
      totalDistance: null, ordersReceived: 0,
    });
    expect(result.avgDeliveryTime).toBeNull();
    expect(result.totalDistance).toBeNull();
  });
});
