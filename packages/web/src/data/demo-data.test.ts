import { describe, it, expect } from 'vitest';
import {
  DEMO_DASHBOARD_STATS,
  DEMO_ORDERS,
  DEMO_VEHICLES,
  DEMO_DRIVERS,
  DEMO_ROUTES,
  DEMO_USER,
} from './demo-data.js';

describe('Demo data - dashboard stats', () => {
  it('has realistic KPI values', () => {
    expect(DEMO_DASHBOARD_STATS.ordersToday).toBeGreaterThan(0);
    expect(DEMO_DASHBOARD_STATS.activeRoutes).toBeGreaterThan(0);
    expect(DEMO_DASHBOARD_STATS.activeDrivers).toBeGreaterThan(0);
    expect(DEMO_DASHBOARD_STATS.deliveryRate).toBeGreaterThan(0);
    expect(DEMO_DASHBOARD_STATS.deliveryRate).toBeLessThanOrEqual(100);
    expect(DEMO_DASHBOARD_STATS.totalVehicles).toBeGreaterThan(0);
  });

  it('has recent orders with all required fields', () => {
    expect(DEMO_DASHBOARD_STATS.recentOrders.length).toBeGreaterThan(0);
    DEMO_DASHBOARD_STATS.recentOrders.forEach((o) => {
      expect(o.id).toBeDefined();
      expect(o.recipientName).toBeDefined();
      expect(o.status).toBeDefined();
      expect(o.priority).toBeDefined();
      expect(o.packageCount).toBeGreaterThan(0);
      expect(o.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});

describe('Demo data - orders', () => {
  it('has at least 10 orders', () => {
    expect(DEMO_ORDERS.length).toBeGreaterThanOrEqual(10);
  });

  it('has orders in various statuses', () => {
    const statuses = new Set(DEMO_ORDERS.map(o => o.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
    expect(statuses.has('delivered')).toBe(true);
    expect(statuses.has('in_transit')).toBe(true);
    expect(statuses.has('received')).toBe(true);
    expect(statuses.has('failed')).toBe(true);
  });

  it('has valid Bay Area addresses', () => {
    DEMO_ORDERS.forEach((o) => {
      expect(o.deliveryAddress.state).toBe('CA');
      expect(o.deliveryAddress.street.length).toBeGreaterThan(0);
    });
  });
});

describe('Demo data - vehicles', () => {
  it('has at least 3 vehicles', () => {
    expect(DEMO_VEHICLES.length).toBeGreaterThanOrEqual(3);
  });

  it('has different vehicle types', () => {
    const types = new Set(DEMO_VEHICLES.map(v => v.type));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('all vehicles are active', () => {
    DEMO_VEHICLES.forEach((v) => {
      expect(v.isActive).toBe(true);
    });
  });
});

describe('Demo data - drivers', () => {
  it('has at least 4 drivers', () => {
    expect(DEMO_DRIVERS.length).toBeGreaterThanOrEqual(4);
  });

  it('has drivers in different statuses', () => {
    const statuses = new Set(DEMO_DRIVERS.map(d => d.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);
    expect(statuses.has('on_route')).toBe(true);
    expect(statuses.has('available')).toBe(true);
  });
});

describe('Demo data - routes', () => {
  it('has at least 3 routes', () => {
    expect(DEMO_ROUTES.length).toBeGreaterThanOrEqual(3);
  });

  it('has routes in different statuses', () => {
    const statuses = new Set(DEMO_ROUTES.map(r => r.status));
    expect(statuses.has('completed')).toBe(true);
    expect(statuses.has('in_progress')).toBe(true);
    expect(statuses.has('draft')).toBe(true);
  });

  it('completed route has all stops done', () => {
    const completed = DEMO_ROUTES.find(r => r.status === 'completed');
    expect(completed).toBeDefined();
    expect(completed!.completedStops).toBe(completed!.totalStops);
  });
});

describe('Demo data - user', () => {
  it('has isDemo flag set', () => {
    expect(DEMO_USER.isDemo).toBe(true);
  });

  it('has valid user structure', () => {
    expect(DEMO_USER.id).toBeDefined();
    expect(DEMO_USER.name).toBe('Demo User');
    expect(DEMO_USER.role).toBe('owner');
    expect(DEMO_USER.tenantId).toBeDefined();
  });
});
