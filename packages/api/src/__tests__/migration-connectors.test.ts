import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Map(),
  });
}

// ─── Tookan ──────────────────────────────────────────────────────────────────

describe('TookanConnector', () => {
  it('validates credentials with status 200', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ status: 200, data: [] }));
    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const connector = new TookanConnector();
    const result = await connector.validateCredentials('test-key');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/get_all_team'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns false on 401', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({}, 401));
    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const result = await new TookanConnector().validateCredentials('bad-key');
    expect(result).toBe(false);
  });

  it('maps tasks to ExternalMigrationOrder', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({
      status: 200,
      data: [{
        job_id: '12345',
        customer_username: 'John Doe',
        customer_phone: '+1234567890',
        customer_email: 'john@test.com',
        job_address: '123 Main St',
        job_city: 'Portland',
        job_state: 'OR',
        job_zipcode: '97201',
        job_country: 'US',
        job_latitude: 45.5231,
        job_longitude: -122.6765,
        no_of_packages: '3',
        job_description: 'Leave at door',
        creation_datetime: '2026-03-01T00:00:00Z',
      }],
      total_page_count: 1,
    }));

    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const orders = await new TookanConnector().fetchOrders('test-key');

    expect(orders).toHaveLength(1);
    expect(orders[0].externalId).toBe('12345');
    expect(orders[0].recipientName).toBe('John Doe');
    expect(orders[0].deliveryAddress.city).toBe('Portland');
    expect(orders[0].deliveryAddress.lat).toBe(45.5231);
    expect(orders[0].packageCount).toBe(3);
    expect(orders[0].notes).toBe('Leave at door');
  });

  it('maps agents to ExternalDriver', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({
      status: 200,
      data: [{ fleet_id: 'f1', username: 'Driver One', email: 'd1@test.com', phone: '+1111111111' }],
    }));

    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const drivers = await new TookanConnector().fetchDrivers('test-key');
    expect(drivers).toHaveLength(1);
    expect(drivers[0].externalId).toBe('f1');
    expect(drivers[0].name).toBe('Driver One');
  });

  it('returns empty vehicles', async () => {
    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const vehicles = await new TookanConnector().fetchVehicles('test-key');
    expect(vehicles).toEqual([]);
  });

  it('handles empty response', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ status: 200, data: [], total_page_count: 0 }));
    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const orders = await new TookanConnector().fetchOrders('test-key');
    expect(orders).toEqual([]);
  });

  it('paginates through multiple pages', async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({
        status: 200,
        data: [{ job_id: '1', customer_username: 'A', creation_datetime: '2026-01-01' }],
        total_page_count: 2,
      }))
      .mockReturnValueOnce(jsonResponse({
        status: 200,
        data: [{ job_id: '2', customer_username: 'B', creation_datetime: '2026-01-02' }],
        total_page_count: 2,
      }));

    const { TookanConnector } = await import('../lib/migration-connectors/tookan.js');
    const orders = await new TookanConnector().fetchOrders('test-key');
    expect(orders).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─── Onfleet ─────────────────────────────────────────────────────────────────

describe('OnfleetConnector', () => {
  it('validates credentials', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ name: 'Test Org' }));
    const { OnfleetConnector } = await import('../lib/migration-connectors/onfleet.js');
    const result = await new OnfleetConnector().validateCredentials('test-key');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/organization'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic') }) }),
    );
  });

  it('maps tasks to ExternalMigrationOrder', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({
      tasks: [{
        id: 'onf-1',
        destination: { address: { number: '456', street: 'Oak Ave', city: 'Seattle', state: 'WA', postalCode: '98101', country: 'US' }, location: [-122.33, 47.61] },
        recipients: [{ name: 'Jane Smith', phone: '+9876543210' }],
        quantity: 2,
        notes: 'Ring bell',
        timeCreated: 1709280000000,
      }],
      lastId: null,
    }));

    const { OnfleetConnector } = await import('../lib/migration-connectors/onfleet.js');
    const orders = await new OnfleetConnector().fetchOrders('test-key');
    expect(orders).toHaveLength(1);
    expect(orders[0].externalId).toBe('onf-1');
    expect(orders[0].recipientName).toBe('Jane Smith');
    expect(orders[0].deliveryAddress.street).toBe('456 Oak Ave');
    expect(orders[0].deliveryAddress.lat).toBe(47.61);
  });

  it('fetches vehicles (only Onfleet supports this)', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([
      { id: 'v1', description: 'White Van', type: 'van', licensePlate: 'ABC123' },
    ]));

    const { OnfleetConnector } = await import('../lib/migration-connectors/onfleet.js');
    const vehicles = await new OnfleetConnector().fetchVehicles('test-key');
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].externalId).toBe('v1');
    expect(vehicles[0].licensePlate).toBe('ABC123');
  });
});

// ─── OptimoRoute ─────────────────────────────────────────────────────────────

describe('OptimoRouteConnector', () => {
  it('validates credentials via get_drivers', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ drivers: [] }));
    const { OptimoRouteConnector } = await import('../lib/migration-connectors/optimoroute.js');
    const result = await new OptimoRouteConnector().validateCredentials('test-key');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('get_drivers'),
      expect.anything(),
    );
  });

  it('maps orders with location data', async () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    mockFetch.mockReturnValueOnce(jsonResponse({
      orders: [{
        orderNo: 'OPT-001',
        location: { locationName: 'Bob Corp', address: '789 Pine', city: 'Denver', state: 'CO', zip: '80201', country: 'US', latitude: 39.74, longitude: -104.99 },
        quantity: 5,
        weight: 12.5,
        notes: 'Fragile',
      }],
    }));

    const { OptimoRouteConnector } = await import('../lib/migration-connectors/optimoroute.js');
    const orders = await new OptimoRouteConnector().fetchOrders('test-key', today, today);
    expect(orders).toHaveLength(1);
    expect(orders[0].externalId).toBe('OPT-001');
    expect(orders[0].weight).toBe(12.5);
    expect(orders[0].deliveryAddress.lat).toBe(39.74);
  });

  it('returns empty vehicles', async () => {
    const { OptimoRouteConnector } = await import('../lib/migration-connectors/optimoroute.js');
    const vehicles = await new OptimoRouteConnector().fetchVehicles('test-key');
    expect(vehicles).toEqual([]);
  });
});

// ─── GetSwift ────────────────────────────────────────────────────────────────

describe('GetSwiftConnector', () => {
  it('validates with api-key header', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse([]));
    const { GetSwiftConnector } = await import('../lib/migration-connectors/getswift.js');
    const result = await new GetSwiftConnector().validateCredentials('test-key');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/drivers'),
      expect.objectContaining({ headers: { 'api-key': 'test-key' } }),
    );
  });

  it('maps deliveries to orders', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({
      data: [{
        id: 'gs-1',
        dropoffDetail: { name: 'Alice', phone: '+5555555555', address: '100 Elm St', city: 'Austin', state: 'TX', postcode: '73301', country: 'US', latitude: 30.27, longitude: -97.74 },
        itemCount: 3,
        weight: 5.0,
        instructions: 'Back door',
        created: '2026-03-10T12:00:00Z',
      }],
      totalPages: 1,
    }));

    const { GetSwiftConnector } = await import('../lib/migration-connectors/getswift.js');
    const orders = await new GetSwiftConnector().fetchOrders('test-key');
    expect(orders).toHaveLength(1);
    expect(orders[0].recipientName).toBe('Alice');
    expect(orders[0].packageCount).toBe(3);
    expect(orders[0].weight).toBe(5.0);
  });
});

// ─── Circuit ─────────────────────────────────────────────────────────────────

describe('CircuitConnector', () => {
  it('validates with bearer token', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ plans: [] }));
    const { CircuitConnector } = await import('../lib/migration-connectors/circuit.js');
    const result = await new CircuitConnector().validateCredentials('test-token');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/plans'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }),
    );
  });

  it('fetches stops from plans', async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({
        plans: [{ id: 'plan-1', date: '2026-03-10', stopCount: 2 }],
      }))
      .mockReturnValueOnce(jsonResponse({
        stops: [{
          id: 'stop-1',
          recipient: { name: 'Charlie', phone: '+7777777777' },
          address: { addressLineOne: '200 Maple Dr', city: 'Chicago', state: 'IL', zip: '60601', country: 'US', latitude: 41.88, longitude: -87.63 },
          packages: 1,
          notes: 'Apartment 3B',
        }],
      }));

    const { CircuitConnector } = await import('../lib/migration-connectors/circuit.js');
    const orders = await new CircuitConnector().fetchOrders('test-token');
    expect(orders).toHaveLength(1);
    expect(orders[0].recipientName).toBe('Charlie');
    expect(orders[0].deliveryAddress.street).toBe('200 Maple Dr');
    expect(orders[0].deliveryAddress.lat).toBe(41.88);
  });

  it('fetches team drivers', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({
      drivers: [{ id: 'd1', name: 'Driver X', email: 'dx@test.com', phone: '+8888888888' }],
    }));

    const { CircuitConnector } = await import('../lib/migration-connectors/circuit.js');
    const drivers = await new CircuitConnector().fetchDrivers('test-token');
    expect(drivers).toHaveLength(1);
    expect(drivers[0].name).toBe('Driver X');
  });
});

// ─── Registry ────────────────────────────────────────────────────────────────

describe('Connector registry', () => {
  it('returns connector for all API platforms', async () => {
    const { getMigrationConnector, apiMigrationPlatforms } = await import('../lib/migration-connectors/index.js');
    for (const platform of apiMigrationPlatforms) {
      const connector = getMigrationConnector(platform);
      expect(connector).toBeDefined();
      expect(connector!.platform).toBe(platform);
    }
  });

  it('returns undefined for unknown platform', async () => {
    const { getMigrationConnector } = await import('../lib/migration-connectors/index.js');
    expect(getMigrationConnector('doordash')).toBeUndefined();
  });

  it('does not include speedyroute (CSV-only)', async () => {
    const { apiMigrationPlatforms } = await import('../lib/migration-connectors/index.js');
    expect(apiMigrationPlatforms).not.toContain('speedyroute');
  });

  it('returns platform info for all 6 platforms', async () => {
    const { getMigrationPlatformInfo } = await import('../lib/migration-connectors/index.js');
    const info = getMigrationPlatformInfo();
    expect(info).toHaveLength(6);
    const speedyroute = info.find(p => p.platform === 'speedyroute');
    expect(speedyroute?.supportsApi).toBe(false);
    const onfleet = info.find(p => p.platform === 'onfleet');
    expect(onfleet?.supportsApi).toBe(true);
    expect(onfleet?.supportsVehicles).toBe(true);
  });
});
