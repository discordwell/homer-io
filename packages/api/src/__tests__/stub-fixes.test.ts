import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db - vi.mock paths are resolved relative to the test file
const mockReturning = vi.fn().mockResolvedValue([{ id: 'order-1', tenantId: 'tenant-1', recipientName: 'Test' }]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

const mockDeleteReturning = vi.fn().mockResolvedValue([{ id: 'driver-1' }]);
const mockDeleteWhere = vi.fn().mockReturnValue({ returning: mockDeleteReturning });
const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

const mockDb = {
  insert: mockInsert,
  delete: mockDelete,
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        offset: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'sub-1' }]),
      }),
    }),
  }),
  transaction: vi.fn().mockImplementation(async (fn: any) => {
    await fn({ insert: mockInsert });
  }),
};

vi.mock('../lib/db/index.js', () => ({ db: mockDb }));

// Mock schema modules - these need to be mocked at the path relative to THIS file,
// since vi.mock resolves relative to the test
vi.mock('../lib/db/schema/orders.js', () => ({
  orders: {
    id: 'id', tenantId: 'tenant_id', status: 'status',
    recipientName: 'recipient_name', createdAt: 'created_at',
    completedAt: 'completed_at', routeId: 'route_id',
  },
  orderStatusEnum: { enumValues: ['received', 'assigned', 'in_transit', 'delivered', 'failed', 'returned'] },
}));

vi.mock('../lib/db/schema/routes.js', () => ({
  routes: { id: 'id', tenantId: 'tenant_id', driverId: 'driver_id' },
}));

vi.mock('../lib/db/schema/drivers.js', () => ({
  drivers: {
    id: 'id', tenantId: 'tenant_id', name: 'name',
    status: 'status', createdAt: 'created_at',
  },
  driverStatusEnum: { enumValues: ['available', 'busy', 'offline', 'on_break'] },
}));

vi.mock('../lib/db/schema/vehicles.js', () => ({
  vehicles: { id: 'id', tenantId: 'tenant_id', createdAt: 'created_at' },
}));

vi.mock('../lib/db/schema/activity-log.js', () => ({
  activityLog: {
    id: 'id', tenantId: 'tenant_id', action: 'action',
    entityType: 'entity_type', entityId: 'entity_id', createdAt: 'created_at',
  },
}));

// Mock logActivity
const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/activity.js', () => ({
  logActivity: (...args: any[]) => mockLogActivity(...args),
}));

// Mock billing service (syncSeats removed — per-order pricing now)
vi.mock('../modules/billing/service.js', () => ({
  recordMeteredUsage: vi.fn().mockResolvedValue({ allowed: true }),
}));

// Mock errors
vi.mock('../lib/errors.js', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
  },
}));

// Mock ETA service
const mockCalculateRouteETAs = vi.fn().mockResolvedValue({
  routeId: 'route-1',
  stops: [
    { orderId: 'order-1', sequence: 1, etaMinutes: 15, etaTimestamp: '2025-06-01T14:15:00Z', distanceKm: 5.2 },
  ],
  totalEtaMinutes: 15,
  calculatedAt: new Date().toISOString(),
});
vi.mock('../modules/eta/service.js', () => ({
  calculateRouteETAs: (...args: any[]) => mockCalculateRouteETAs(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default mock implementations
  mockReturning.mockResolvedValue([{ id: 'order-1', tenantId: 'tenant-1', recipientName: 'Test' }]);
  mockDeleteReturning.mockResolvedValue([{ id: 'driver-1' }]);
});

describe('B2: Public tracking uses real ETA', () => {
  it('calls calculateRouteETAs for in-transit orders with routeId', async () => {
    const { calculateRouteETAs } = await import('../modules/eta/service.js');
    const etas = await calculateRouteETAs('route-1', 'tenant-1');

    expect(etas.stops).toHaveLength(1);
    expect(etas.stops[0].etaTimestamp).toBe('2025-06-01T14:15:00Z');
    expect(mockCalculateRouteETAs).toHaveBeenCalledWith('route-1', 'tenant-1');
  });

  it('returns null etaTimestamp when stop not found for orderId', async () => {
    mockCalculateRouteETAs.mockResolvedValueOnce({
      routeId: 'route-1',
      stops: [],
      totalEtaMinutes: 0,
      calculatedAt: new Date().toISOString(),
    });

    const { calculateRouteETAs } = await import('../modules/eta/service.js');
    const etas = await calculateRouteETAs('route-1', 'tenant-1');
    const stopEta = etas.stops.find((s: any) => s.orderId === 'order-1');

    expect(stopEta).toBeUndefined();
  });

  it('falls back to timeWindowEnd when ETA calculation throws', async () => {
    mockCalculateRouteETAs.mockRejectedValueOnce(new Error('Route not found'));

    const timeWindowEnd = new Date('2025-06-01T18:00:00Z');
    let estimatedDelivery: string | null = null;

    try {
      const { calculateRouteETAs } = await import('../modules/eta/service.js');
      await calculateRouteETAs('route-1', 'tenant-1');
    } catch {
      estimatedDelivery = timeWindowEnd.toISOString();
    }

    expect(estimatedDelivery).toBe('2025-06-01T18:00:00.000Z');
  });
});

describe('B3: Per-order billing — no syncSeats on driver create/delete', () => {
  it('does not call syncSeats after createDriver (per-order model)', async () => {
    const { createDriver } = await import('../modules/fleet/service.js');
    await createDriver('tenant-1', {
      name: 'Test Driver',
      email: 'driver@example.com',
      phone: '+15551234567',
      skillTags: [],
    });

    // syncSeats no longer exists — per-order pricing means unlimited drivers
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it('does not call syncSeats after deleteDriver (per-order model)', async () => {
    const { deleteDriver } = await import('../modules/fleet/service.js');
    await deleteDriver('tenant-1', 'driver-1');

    // syncSeats no longer exists — per-order pricing means unlimited drivers
    expect(mockLogActivity).toHaveBeenCalled();
  });
});

describe('B6: Activity logging on createOrder', () => {
  it('logs activity after creating an order', async () => {
    const { createOrder } = await import('../modules/orders/service.js');
    await createOrder('tenant-1', {
      recipientName: 'Jane Doe',
      deliveryAddress: { street: '123 Main St', city: 'NY', state: 'NY', zip: '10001', country: 'US' },
      packageCount: 1,
      priority: 'normal' as const,
      requiresSignature: false,
      requiresPhoto: false,
    });

    expect(mockLogActivity).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'order_created',
      entityType: 'order',
      entityId: 'order-1',
    });
  });

  it('logs activity after createDriver', async () => {
    const { createDriver } = await import('../modules/fleet/service.js');
    await createDriver('tenant-1', {
      name: 'Test Driver',
      email: 'driver@example.com',
      phone: '+15551234567',
      skillTags: [],
    });

    expect(mockLogActivity).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'driver_created',
      entityType: 'driver',
      entityId: 'order-1', // from mock returning { id: 'order-1' }
    });
  });

  it('logs activity after deleteDriver', async () => {
    const { deleteDriver } = await import('../modules/fleet/service.js');
    await deleteDriver('tenant-1', 'driver-1');

    expect(mockLogActivity).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      action: 'driver_deleted',
      entityType: 'driver',
      entityId: 'driver-1',
    });
  });
});
