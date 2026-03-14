import { describe, it, expect } from 'vitest';
import { dashboardStatsSchema } from '@homer-io/shared';

// Unit tests for dashboard schema validation (no DB required)

describe('Dashboard', () => {
  it('should validate complete stats', () => {
    const stats = {
      ordersToday: 5,
      activeRoutes: 2,
      activeDrivers: 3,
      deliveryRate: 85.5,
      totalVehicles: 10,
      recentOrders: [
        { id: 'abc123', recipientName: 'John', status: 'delivered', priority: 'normal', packageCount: 2, createdAt: '2024-01-01T00:00:00Z' },
      ],
    };
    expect(dashboardStatsSchema.parse(stats)).toEqual(stats);
  });

  it('should reject missing required fields', () => {
    expect(() => dashboardStatsSchema.parse({})).toThrow();
  });

  it('should reject invalid delivery rate', () => {
    expect(() => dashboardStatsSchema.parse({
      ordersToday: 5, activeRoutes: 2, activeDrivers: 3,
      deliveryRate: 'invalid', totalVehicles: 10, recentOrders: [],
    })).toThrow();
  });

  it('should accept stats with zero values', () => {
    const stats = {
      ordersToday: 0,
      activeRoutes: 0,
      activeDrivers: 0,
      deliveryRate: 0,
      totalVehicles: 0,
      recentOrders: [],
    };
    expect(dashboardStatsSchema.parse(stats)).toEqual(stats);
  });

  it('should reject recentOrders with missing fields', () => {
    expect(() => dashboardStatsSchema.parse({
      ordersToday: 1, activeRoutes: 1, activeDrivers: 1,
      deliveryRate: 50, totalVehicles: 1,
      recentOrders: [{ id: 'abc' }], // missing recipientName, status, etc.
    })).toThrow();
  });

  it('should validate multiple recent orders', () => {
    const stats = {
      ordersToday: 3,
      activeRoutes: 1,
      activeDrivers: 2,
      deliveryRate: 100,
      totalVehicles: 5,
      recentOrders: [
        { id: 'o1', recipientName: 'Alice', status: 'pending', priority: 'urgent', packageCount: 1, createdAt: '2024-06-01T10:00:00Z' },
        { id: 'o2', recipientName: 'Bob', status: 'in_transit', priority: 'normal', packageCount: 3, createdAt: '2024-06-01T11:00:00Z' },
        { id: 'o3', recipientName: 'Carol', status: 'delivered', priority: 'low', packageCount: 1, createdAt: '2024-06-01T12:00:00Z' },
      ],
    };
    expect(dashboardStatsSchema.parse(stats)).toEqual(stats);
  });
});
