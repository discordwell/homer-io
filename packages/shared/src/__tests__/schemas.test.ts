import { describe, it, expect } from 'vitest';
import {
  registerSchema, loginSchema, refreshTokenSchema,
  paginationSchema, coordsSchema, addressSchema,
  createVehicleSchema, createDriverSchema,
  createOrderSchema, updateOrderStatusSchema,
  dashboardStatsSchema,
  aiChatRequestSchema, aiChatMessageSchema,
  locationUpdateSchema, deliveryEventSchema, routeStatusTransitionSchema,
  notificationSchema, notificationPrefsSchema, notificationTypeEnum,
  orgSettingsSchema, updateOrgSettingsSchema, brandingSchema,
  analyticsQuerySchema, driverPerformanceSchema, routeEfficiencySchema,
  trendPointSchema, analyticsOverviewSchema,
  apiKeyCreateSchema, inviteUserSchema,
} from '../index.js';
import { hasMinRole } from '../types/roles.js';

describe('Auth Schemas', () => {
  it('validates register input', () => {
    const valid = registerSchema.parse({
      email: 'test@homer.io',
      password: 'secureP@ss1',
      name: 'Test User',
      orgName: 'Test Org',
    });
    expect(valid.email).toBe('test@homer.io');
    expect(valid.orgName).toBe('Test Org');
  });

  it('rejects short password', () => {
    expect(() => registerSchema.parse({
      email: 'test@homer.io',
      password: 'short',
      name: 'Test',
      orgName: 'Org',
    })).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() => registerSchema.parse({
      email: 'not-an-email',
      password: 'secureP@ss1',
      name: 'Test',
      orgName: 'Org',
    })).toThrow();
  });

  it('validates login input', () => {
    const valid = loginSchema.parse({
      email: 'test@homer.io',
      password: 'password123',
    });
    expect(valid.email).toBe('test@homer.io');
  });

  it('validates refresh token input', () => {
    const valid = refreshTokenSchema.parse({ refreshToken: 'abc123' });
    expect(valid.refreshToken).toBe('abc123');
  });
});

describe('Common Schemas', () => {
  it('validates pagination with defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string pagination values', () => {
    const result = paginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: 200 })).toThrow();
  });

  it('validates coordinates', () => {
    const valid = coordsSchema.parse({ lat: 37.4848, lng: -122.2281 });
    expect(valid.lat).toBe(37.4848);
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => coordsSchema.parse({ lat: 91, lng: 0 })).toThrow();
    expect(() => coordsSchema.parse({ lat: 0, lng: 181 })).toThrow();
  });

  it('validates address', () => {
    const valid = addressSchema.parse({
      street: '123 Main St',
      city: 'San Mateo',
      state: 'CA',
      zip: '94401',
    });
    expect(valid.country).toBe('US'); // default
  });
});

describe('Fleet Schemas', () => {
  it('validates vehicle creation', () => {
    const valid = createVehicleSchema.parse({
      name: 'Van 1',
      type: 'van',
      capacityCount: 50,
    });
    expect(valid.fuelType).toBe('gasoline'); // default
  });

  it('rejects invalid vehicle type', () => {
    expect(() => createVehicleSchema.parse({
      name: 'X',
      type: 'helicopter',
    })).toThrow();
  });

  it('validates driver creation', () => {
    const valid = createDriverSchema.parse({
      name: 'John Doe',
      phone: '555-0100',
    });
    expect(valid.skillTags).toEqual([]); // default
  });
});

describe('Order Schemas', () => {
  it('validates order creation', () => {
    const valid = createOrderSchema.parse({
      recipientName: 'Jane Doe',
      deliveryAddress: {
        street: '456 Oak Ave',
        city: 'Redwood City',
        state: 'CA',
        zip: '94063',
      },
    });
    expect(valid.packageCount).toBe(1); // default
    expect(valid.priority).toBe('normal'); // default
  });

  it('validates order with time window', () => {
    const valid = createOrderSchema.parse({
      recipientName: 'Bob',
      deliveryAddress: {
        street: '789 Elm St',
        city: 'Burlingame',
        state: 'CA',
        zip: '94010',
      },
      timeWindow: {
        start: '2026-03-15T09:00:00Z',
        end: '2026-03-15T12:00:00Z',
      },
      priority: 'urgent',
      requiresSignature: true,
    });
    expect(valid.priority).toBe('urgent');
    expect(valid.requiresSignature).toBe(true);
  });

  it('validates status update', () => {
    const valid = updateOrderStatusSchema.parse({
      status: 'delivered',
    });
    expect(valid.status).toBe('delivered');
  });

  it('rejects invalid status', () => {
    expect(() => updateOrderStatusSchema.parse({
      status: 'invalid_status',
    })).toThrow();
  });
});

describe('Role Hierarchy', () => {
  it('owner has min role of all levels', () => {
    expect(hasMinRole('owner', 'owner')).toBe(true);
    expect(hasMinRole('owner', 'admin')).toBe(true);
    expect(hasMinRole('owner', 'dispatcher')).toBe(true);
    expect(hasMinRole('owner', 'driver')).toBe(true);
  });

  it('driver only has min role of driver', () => {
    expect(hasMinRole('driver', 'driver')).toBe(true);
    expect(hasMinRole('driver', 'dispatcher')).toBe(false);
    expect(hasMinRole('driver', 'admin')).toBe(false);
    expect(hasMinRole('driver', 'owner')).toBe(false);
  });

  it('dispatcher can access driver-level', () => {
    expect(hasMinRole('dispatcher', 'driver')).toBe(true);
    expect(hasMinRole('dispatcher', 'dispatcher')).toBe(true);
    expect(hasMinRole('dispatcher', 'admin')).toBe(false);
  });
});

describe('Dashboard Schema', () => {
  it('parses valid dashboard stats', () => {
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

  it('rejects missing required fields', () => {
    expect(() => dashboardStatsSchema.parse({})).toThrow();
  });

  it('rejects non-numeric deliveryRate', () => {
    expect(() => dashboardStatsSchema.parse({
      ordersToday: 5, activeRoutes: 2, activeDrivers: 3,
      deliveryRate: 'invalid', totalVehicles: 10, recentOrders: [],
    })).toThrow();
  });

  it('accepts empty recentOrders array', () => {
    const stats = {
      ordersToday: 0, activeRoutes: 0, activeDrivers: 0,
      deliveryRate: 0, totalVehicles: 0, recentOrders: [],
    };
    expect(dashboardStatsSchema.parse(stats)).toEqual(stats);
  });
});

describe('AI Schemas', () => {
  it('parses valid chat request', () => {
    const request = {
      message: 'How many deliveries today?',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
      ],
    };
    expect(aiChatRequestSchema.parse(request)).toEqual(request);
  });

  it('defaults history to empty array', () => {
    const result = aiChatRequestSchema.parse({ message: 'Hello' });
    expect(result.history).toEqual([]);
  });

  it('rejects empty message', () => {
    expect(() => aiChatRequestSchema.parse({ message: '' })).toThrow();
  });

  it('rejects oversized message (>5000 chars)', () => {
    expect(() => aiChatRequestSchema.parse({
      message: 'x'.repeat(5001),
    })).toThrow();
  });

  it('rejects history exceeding 50 entries', () => {
    const history = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `message ${i}`,
    }));
    expect(() => aiChatRequestSchema.parse({
      message: 'test',
      history,
    })).toThrow();
  });

  it('validates role enum in aiChatMessageSchema', () => {
    expect(aiChatMessageSchema.parse({ role: 'user', content: 'hi' })).toEqual({ role: 'user', content: 'hi' });
    expect(aiChatMessageSchema.parse({ role: 'assistant', content: 'hello' })).toEqual({ role: 'assistant', content: 'hello' });
  });

  it('rejects invalid role in aiChatMessageSchema', () => {
    expect(() => aiChatMessageSchema.parse({ role: 'system', content: 'hi' })).toThrow();
    expect(() => aiChatMessageSchema.parse({ role: 'admin', content: 'hi' })).toThrow();
  });
});

describe('Tracking Schemas', () => {
  it('validates location update', () => {
    const valid = locationUpdateSchema.parse({ lat: 37.7749, lng: -122.4194, speed: 45.5, heading: 180 });
    expect(valid.lat).toBe(37.7749);
    expect(valid.speed).toBe(45.5);
    expect(valid.heading).toBe(180);
  });

  it('rejects out-of-range lat/lng', () => {
    expect(() => locationUpdateSchema.parse({ lat: 91, lng: 0 })).toThrow();
    expect(() => locationUpdateSchema.parse({ lat: 0, lng: -181 })).toThrow();
  });

  it('allows optional speed/heading/accuracy', () => {
    const valid = locationUpdateSchema.parse({ lat: 40, lng: -74 });
    expect(valid.speed).toBeUndefined();
    expect(valid.heading).toBeUndefined();
  });

  it('validates delivery event', () => {
    const valid = deliveryEventSchema.parse({
      routeId: '550e8400-e29b-41d4-a716-446655440000',
      orderId: '660e8400-e29b-41d4-a716-446655440000',
      status: 'delivered',
    });
    expect(valid.status).toBe('delivered');
  });

  it('rejects invalid delivery status', () => {
    expect(() => deliveryEventSchema.parse({
      routeId: '550e8400-e29b-41d4-a716-446655440000',
      orderId: '660e8400-e29b-41d4-a716-446655440000',
      status: 'pending',
    })).toThrow();
  });

  it('validates route status transition', () => {
    expect(routeStatusTransitionSchema.parse({ status: 'in_progress' }).status).toBe('in_progress');
    expect(routeStatusTransitionSchema.parse({ status: 'completed' }).status).toBe('completed');
  });

  it('rejects draft as transition target', () => {
    expect(() => routeStatusTransitionSchema.parse({ status: 'draft' })).toThrow();
  });
});

describe('Notification Schemas', () => {
  it('validates notification type enum', () => {
    expect(notificationTypeEnum.parse('delivery_completed')).toBe('delivery_completed');
    expect(notificationTypeEnum.parse('route_started')).toBe('route_started');
  });

  it('rejects invalid notification type', () => {
    expect(() => notificationTypeEnum.parse('invalid_type')).toThrow();
  });

  it('validates notification schema', () => {
    const valid = notificationSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'delivery_completed',
      title: 'Delivery Complete',
      body: 'Order #123 delivered successfully',
      readAt: null,
      createdAt: '2026-03-14T00:00:00Z',
    });
    expect(valid.title).toBe('Delivery Complete');
    expect(valid.readAt).toBeNull();
  });

  it('validates notification preferences with defaults', () => {
    const valid = notificationPrefsSchema.parse({});
    expect(valid.deliveryUpdates).toBe(true);
    expect(valid.routeUpdates).toBe(true);
    expect(valid.driverAlerts).toBe(true);
    expect(valid.systemNotices).toBe(true);
  });

  it('allows overriding notification preferences', () => {
    const valid = notificationPrefsSchema.parse({ deliveryUpdates: false, driverAlerts: false });
    expect(valid.deliveryUpdates).toBe(false);
    expect(valid.driverAlerts).toBe(false);
    expect(valid.routeUpdates).toBe(true);
  });
});

describe('Settings Schemas', () => {
  it('validates branding schema', () => {
    const valid = brandingSchema.parse({ primaryColor: '#FF5733', companyName: 'Acme Logistics' });
    expect(valid.primaryColor).toBe('#FF5733');
    expect(valid.companyName).toBe('Acme Logistics');
  });

  it('rejects invalid hex color', () => {
    expect(() => brandingSchema.parse({ primaryColor: 'red' })).toThrow();
    expect(() => brandingSchema.parse({ primaryColor: '#GGG' })).toThrow();
  });

  it('validates org settings', () => {
    const valid = orgSettingsSchema.parse({
      timezone: 'America/New_York',
      units: 'metric',
      branding: { companyName: 'Test Co' },
      notificationPrefs: { deliveryUpdates: true },
    });
    expect(valid.timezone).toBe('America/New_York');
    expect(valid.units).toBe('metric');
  });

  it('rejects invalid units', () => {
    expect(() => orgSettingsSchema.parse({
      timezone: 'UTC', units: 'furlongs',
      branding: {}, notificationPrefs: {},
    })).toThrow();
  });

  it('validates partial update schema', () => {
    const valid = updateOrgSettingsSchema.parse({ timezone: 'Europe/London' });
    expect(valid.timezone).toBe('Europe/London');
    expect(valid.units).toBeUndefined();
  });
});

describe('Analytics Schemas', () => {
  it('validates analytics query with default range', () => {
    const valid = analyticsQuerySchema.parse({});
    expect(valid.range).toBe('7d');
  });

  it('accepts valid range values', () => {
    expect(analyticsQuerySchema.parse({ range: '30d' }).range).toBe('30d');
    expect(analyticsQuerySchema.parse({ range: '90d' }).range).toBe('90d');
  });

  it('rejects invalid range', () => {
    expect(() => analyticsQuerySchema.parse({ range: '1y' })).toThrow();
  });

  it('validates driver performance', () => {
    const valid = driverPerformanceSchema.parse({
      driverId: '550e8400-e29b-41d4-a716-446655440000',
      driverName: 'John Doe',
      totalDeliveries: 150,
      successRate: 95.5,
      avgDeliveryTime: 22.3,
      totalDistance: 1500.5,
    });
    expect(valid.totalDeliveries).toBe(150);
    expect(valid.successRate).toBe(95.5);
  });

  it('allows nullable fields in driver performance', () => {
    const valid = driverPerformanceSchema.parse({
      driverId: '550e8400-e29b-41d4-a716-446655440000',
      driverName: 'Jane',
      totalDeliveries: 0,
      successRate: 0,
      avgDeliveryTime: null,
      totalDistance: null,
    });
    expect(valid.avgDeliveryTime).toBeNull();
    expect(valid.totalDistance).toBeNull();
  });

  it('validates route efficiency', () => {
    const valid = routeEfficiencySchema.parse({
      totalRoutes: 50, completedRoutes: 45,
      avgStopsPerRoute: 12, avgCompletionRate: 90,
      avgDuration: null,
    });
    expect(valid.completedRoutes).toBe(45);
  });

  it('validates trend point', () => {
    const valid = trendPointSchema.parse({
      date: '2026-03-14', deliveries: 25,
      failedDeliveries: 2, newOrders: 30,
    });
    expect(valid.date).toBe('2026-03-14');
  });

  it('validates analytics overview', () => {
    const valid = analyticsOverviewSchema.parse({
      totalDeliveries: 500, successRate: 94.2,
      avgDeliveryTime: 28, totalRoutes: 100,
      totalDistance: 5000, ordersReceived: 600,
    });
    expect(valid.totalDeliveries).toBe(500);
  });
});

describe('Team & API Key Schemas', () => {
  it('validates invite user schema', () => {
    const valid = inviteUserSchema.parse({
      email: 'new@homer.io',
      name: 'New User',
      role: 'dispatcher',
    });
    expect(valid.email).toBe('new@homer.io');
    expect(valid.role).toBe('dispatcher');
  });

  it('rejects invalid role in invite', () => {
    expect(() => inviteUserSchema.parse({
      email: 'test@test.com',
      name: 'Test',
      role: 'superadmin',
    })).toThrow();
  });

  it('validates API key create schema', () => {
    const valid = apiKeyCreateSchema.parse({
      name: 'My API Key',
      scopes: ['read:orders', 'write:orders'],
    });
    expect(valid.name).toBe('My API Key');
    expect(valid.scopes).toHaveLength(2);
  });

  it('rejects empty scopes', () => {
    expect(() => apiKeyCreateSchema.parse({
      name: 'Key',
      scopes: [],
    })).toThrow();
  });
});
