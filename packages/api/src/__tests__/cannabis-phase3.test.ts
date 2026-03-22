import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config.js', () => ({
  config: {
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
    jwt: { secret: 'test-secret' },
    minio: { endpoint: '', port: 9000, accessKey: '', secretKey: '', useSSL: false },
    integrations: { encryptionKey: 'test-key' },
  },
}));

describe('Cannabis jurisdictions', () => {
  it('has 27 delivery-legal states (14 rec + 13 medical)', async () => {
    const { DELIVERY_LEGAL_STATES } = await import('../lib/cannabis-jurisdictions.js');
    expect(DELIVERY_LEGAL_STATES.length).toBe(27);
    const rec = DELIVERY_LEGAL_STATES.filter(s => s.deliveryType === 'both');
    const med = DELIVERY_LEGAL_STATES.filter(s => s.deliveryType === 'medical');
    expect(rec.length).toBe(14);
    expect(med.length).toBe(13);
  });

  it('all states have required fields', async () => {
    const { DELIVERY_LEGAL_STATES } = await import('../lib/cannabis-jurisdictions.js');
    for (const state of DELIVERY_LEGAL_STATES) {
      expect(state.code).toHaveLength(2);
      expect(state.name.length).toBeGreaterThan(0);
      expect(state.minimumAge).toBeGreaterThanOrEqual(18);
      expect(state.minimumAge).toBeLessThanOrEqual(21);
    }
  });

  it('California is in the list with delivery type both', async () => {
    const { DELIVERY_LEGAL_STATES } = await import('../lib/cannabis-jurisdictions.js');
    const ca = DELIVERY_LEGAL_STATES.find(s => s.code === 'CA');
    expect(ca).toBeDefined();
    expect(ca!.deliveryType).toBe('both');
    expect(ca!.minimumAge).toBe(21);
  });

  it('has CA jurisdictions with cities and counties', async () => {
    const { CA_JURISDICTIONS } = await import('../lib/cannabis-jurisdictions.js');
    expect(CA_JURISDICTIONS.length).toBeGreaterThan(50);
    const counties = CA_JURISDICTIONS.filter(j => j.type === 'county');
    const cities = CA_JURISDICTIONS.filter(j => j.type === 'city');
    expect(counties.length).toBe(58); // CA has 58 counties
    expect(cities.length).toBeGreaterThan(30);
  });

  it('getCADeliveryJurisdictions returns only allowed/medical', async () => {
    const { getCADeliveryJurisdictions, CA_JURISDICTIONS } = await import('../lib/cannabis-jurisdictions.js');
    const deliveryOk = getCADeliveryJurisdictions();
    expect(deliveryOk.length).toBeGreaterThan(0);
    expect(deliveryOk.every(j => j.deliveryStatus !== 'prohibited')).toBe(true);
    // Should be fewer than total
    expect(deliveryOk.length).toBeLessThan(CA_JURISDICTIONS.length);
  });

  it('isDeliveryLegalState works correctly', async () => {
    const { isDeliveryLegalState } = await import('../lib/cannabis-jurisdictions.js');
    expect(isDeliveryLegalState('CA')).toBe(true);
    expect(isDeliveryLegalState('NY')).toBe(true);
    expect(isDeliveryLegalState('TX')).toBe(false);
    expect(isDeliveryLegalState('FL')).toBe(true); // medical delivery
  });
});

describe('Delivery zone validation', () => {
  it('checkDeliveryZone function exists', async () => {
    const { checkDeliveryZone } = await import('../modules/cannabis/service.js');
    expect(checkDeliveryZone).toBeDefined();
  });

  // Note: full integration tests for checkDeliveryZone need a DB.
  // The function's haversine + zip code logic is tested via the shared geo util.
});

describe('Haversine distance (used by zone check)', () => {
  it('calculates distance between two points', async () => {
    const { haversineDistance } = await import('@homer-io/shared');
    // SF to Oakland is ~13km
    const dist = haversineDistance(37.7749, -122.4194, 37.8044, -122.2712);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(20);
  });

  it('returns 0 for same point', async () => {
    const { haversineDistance } = await import('@homer-io/shared');
    const dist = haversineDistance(37.7749, -122.4194, 37.7749, -122.4194);
    expect(dist).toBe(0);
  });
});

describe('Dutchie connector', () => {
  it('is importable and implements EcommerceConnector', async () => {
    const { DutchieConnector } = await import('../lib/integrations/dutchie.js');
    const connector = new DutchieConnector();
    expect(connector.platform).toBe('dutchie');
    expect(connector.validateCredentials).toBeDefined();
    expect(connector.fetchOrders).toBeDefined();
    expect(connector.mapOrderToHomer).toBeDefined();
    expect(connector.registerWebhooks).toBeDefined();
  });

  it('maps Dutchie order to HOMER format with cannabis fields', async () => {
    const { DutchieConnector } = await import('../lib/integrations/dutchie.js');
    const connector = new DutchieConnector();

    const externalOrder = {
      externalId: 'dutchie-001',
      orderNumber: 'D-1234',
      customerName: 'Jane Doe',
      customerEmail: 'jane@test.com',
      customerPhone: '555-0100',
      shippingAddress: { street: '123 Main St', city: 'SF', state: 'CA', zip: '94102', country: 'US' },
      lineItems: [
        { name: 'Blue Dream 1/8oz', quantity: 1, weight: 3.5, price: 45.00 },
        { name: 'Gummy Pack 100mg', quantity: 2, price: 25.00 },
      ],
      totalWeight: 3.5,
      notes: 'Ring bell twice',
      createdAt: '2026-03-22T00:00:00Z',
      rawData: {
        id: 'dutchie-001',
        medical: true,
        patientId: 'PAT-555',
        items: [
          { name: 'Blue Dream 1/8oz', quantity: 1, weight: 3.5, price: 45.00, trackingId: 'TAG-001', category: 'Flower', thcContent: '22%', strain: 'Blue Dream' },
          { name: 'Gummy Pack 100mg', quantity: 2, price: 25.00, category: 'Edibles', thcContent: '100mg' },
        ],
        paymentMethod: 'cash',
        total: 95.00,
      },
    };

    const mapped = connector.mapOrderToHomer(externalOrder, 'tenant-123');
    expect(mapped.recipientName).toBe('Jane Doe');
    expect(mapped.packageCount).toBe(3); // 1 + 2
    expect(mapped.requiresSignature).toBe(true);
    expect(mapped.paymentMethod).toBe('cash');
    expect(mapped.cashAmount).toBe(95.00);
    expect(mapped.customFields.medicalOrder).toBe(true);
    expect(mapped.customFields.patientId).toBe('PAT-555');
    expect(mapped.barcodes).toContain('TAG-001');
  });
});

describe('METRC connector', () => {
  it('is importable and implements SeedToSaleConnector', async () => {
    const { MetrcConnector } = await import('../lib/integrations/metrc.js');
    const connector = new MetrcConnector();
    expect(connector.platform).toBe('metrc');
    expect(connector.validateApiKey).toBeDefined();
    expect(connector.getActivePackages).toBeDefined();
    expect(connector.createTransfer).toBeDefined();
    expect(connector.reportDelivery).toBeDefined();
  });

  it('getMetrcStates returns available states', async () => {
    const { getMetrcStates } = await import('../lib/integrations/metrc.js');
    const states = getMetrcStates();
    expect(states).toContain('CA');
    expect(states).toContain('CO');
    expect(states).toContain('OR');
    expect(states.length).toBeGreaterThan(10);
  });
});

describe('Integration index', () => {
  it('Dutchie connector is registered', async () => {
    const { getConnector } = await import('../lib/integrations/index.js');
    const connector = getConnector('dutchie');
    expect(connector.platform).toBe('dutchie');
  });

  it('Dutchie platform info is available with industry gate', async () => {
    const { getAvailablePlatforms } = await import('../lib/integrations/index.js');
    const platforms = getAvailablePlatforms();
    const dutchie = platforms.find(p => p.platform === 'dutchie');
    expect(dutchie).toBeDefined();
    expect(dutchie!.name).toBe('Dutchie');
    expect(dutchie!.industryGate).toBe('cannabis');
  });
});
