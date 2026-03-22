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

describe('Pharmacy schemas', () => {
  it('pharmacySettingsSchema validates correct settings', async () => {
    const { pharmacySettingsSchema } = await import('@homer-io/shared');
    const result = pharmacySettingsSchema.parse({
      licenseNumber: 'PH-12345',
      npi: '1234567890',
      state: 'CA',
    });
    expect(result.licenseNumber).toBe('PH-12345');
    expect(result.requireSignature).toBe(true); // default
    expect(result.requireDobVerification).toBe(true); // default
    expect(result.hipaaSafeDriverDisplay).toBe(true); // default
  });

  it('controlledScheduleEnum validates II-V', async () => {
    const { controlledScheduleEnum } = await import('@homer-io/shared');
    expect(controlledScheduleEnum.parse('II')).toBe('II');
    expect(controlledScheduleEnum.parse('V')).toBe('V');
    expect(() => controlledScheduleEnum.parse('I')).toThrow();
    expect(() => controlledScheduleEnum.parse('VI')).toThrow();
  });

  it('createOrderSchema accepts pharmacy fields', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Patient Smith',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
      isControlledSubstance: true,
      controlledSchedule: 'II',
      isColdChain: true,
      patientDob: '1965-03-15',
      prescriberName: 'Dr. Sarah Johnson',
      prescriberNpi: '1234567890',
      hipaaSafeNotes: 'Ring doorbell, leave at door if not home',
      isGift: false,
    });
    expect(result.isControlledSubstance).toBe(true);
    expect(result.controlledSchedule).toBe('II');
    expect(result.isColdChain).toBe(true);
    expect(result.patientDob).toBe('1965-03-15');
    expect(result.prescriberName).toBe('Dr. Sarah Johnson');
  });

  it('pharmacy fields default correctly', async () => {
    const { createOrderSchema } = await import('@homer-io/shared');
    const result = createOrderSchema.parse({
      recipientName: 'Test',
      deliveryAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
    });
    expect(result.isControlledSubstance).toBe(false);
    expect(result.isColdChain).toBe(false);
    expect(result.controlledSchedule).toBeUndefined();
  });
});

describe('Pharmacy DB schema', () => {
  it('orders table has pharmacy columns', async () => {
    const { orders } = await import('../lib/db/schema/orders.js');
    expect(orders.isControlledSubstance).toBeDefined();
    expect(orders.controlledSchedule).toBeDefined();
    expect(orders.isColdChain).toBeDefined();
    expect(orders.coldChainConfirmed).toBeDefined();
    expect(orders.patientDob).toBeDefined();
    expect(orders.patientDobVerified).toBeDefined();
    expect(orders.prescriberName).toBeDefined();
    expect(orders.prescriberNpi).toBeDefined();
    expect(orders.hipaaSafeNotes).toBeDefined();
  });
});

describe('Pharmacy service', () => {
  it('all pharmacy functions are importable', async () => {
    const mod = await import('../modules/pharmacy/service.js');
    expect(mod.getPharmacySettings).toBeDefined();
    expect(mod.updatePharmacySettings).toBeDefined();
    expect(mod.requirePharmacyIndustry).toBeDefined();
  });
});

describe('HIPAA-safe driver view', () => {
  it('getCurrentRoute is importable (strips PHI for pharmacy)', async () => {
    const mod = await import('../modules/driver/service.js');
    expect(mod.getCurrentRoute).toBeDefined();
  });
});

describe('Pharmacy demo data', () => {
  it('generates pharmacy orders with controlled/cold chain/prescriber data', async () => {
    const { generateIndustryOrders } = await import('../modules/auth/industry-data.js');
    const { BAY_AREA_LOCATIONS } = await import('../modules/auth/demo-seed.js');
    const orders = generateIndustryOrders('pharmacy', 50, BAY_AREA_LOCATIONS.slice(0, 5));
    expect(orders.length).toBe(50);

    // All pharmacy orders should have patient DOB and prescriber
    const withDob = orders.filter(o => o.patientDob);
    expect(withDob.length).toBe(50); // all

    const withPrescriber = orders.filter(o => o.prescriberName);
    expect(withPrescriber.length).toBe(50); // all

    // ~20% should be controlled substances
    const controlled = orders.filter(o => o.isControlledSubstance);
    expect(controlled.length).toBeGreaterThan(2);
    expect(controlled.length).toBeLessThan(25);

    for (const c of controlled) {
      expect(['II', 'III', 'IV', 'V']).toContain(c.controlledSchedule);
    }

    // ~15% should be cold chain
    const coldChain = orders.filter(o => o.isColdChain);
    expect(coldChain.length).toBeGreaterThan(0);
  });
});

describe('PioneerRx connector', () => {
  it('is importable and implements EcommerceConnector', async () => {
    const { PioneerRxConnector } = await import('../lib/integrations/pioneerrx.js');
    const connector = new PioneerRxConnector();
    expect(connector.platform).toBe('pioneerrx');
    expect(connector.validateCredentials).toBeDefined();
    expect(connector.fetchOrders).toBeDefined();
    expect(connector.mapOrderToHomer).toBeDefined();
  });

  it('maps PioneerRx prescription with HIPAA-safe handling', async () => {
    const { PioneerRxConnector } = await import('../lib/integrations/pioneerrx.js');
    const connector = new PioneerRxConnector();

    const externalOrder = {
      externalId: 'rx-001',
      orderNumber: 'RX-4821, RX-4822',
      customerName: 'John Smith',
      customerEmail: 'john@example.com',
      customerPhone: '555-0100',
      shippingAddress: { street: '456 Oak Ave', city: 'Portland', state: 'OR', zip: '97201', country: 'US' },
      lineItems: [{ name: 'Prescription (2 items)', quantity: 2 }],
      totalWeight: null,
      notes: 'Ring doorbell',
      createdAt: '2026-03-22T00:00:00Z',
      rawData: {
        id: 'rx-001',
        rxNumbers: ['RX-4821', 'RX-4822'],
        patientName: 'John Smith',
        patientPhone: '555-0100',
        patientEmail: 'john@example.com',
        patientDob: '1965-03-15',
        prescriberName: 'Dr. Sarah Johnson',
        prescriberNpi: '1234567890',
        isControlled: true,
        controlledSchedule: 'II',
        requiresRefrigeration: true,
        itemCount: 2,
        copayAmount: 25.00,
        deliveryInstructions: 'Ring doorbell',
        deliveryAddress: { street: '456 Oak Ave', city: 'Portland', state: 'OR', zip: '97201' },
      },
    };

    const mapped = connector.mapOrderToHomer(externalOrder, 'tenant-123');
    expect(mapped.recipientName).toBe('John Smith');
    expect(mapped.isControlledSubstance).toBe(true);
    expect(mapped.controlledSchedule).toBe('II');
    expect(mapped.isColdChain).toBe(true);
    expect(mapped.patientDob).toBe('1965-03-15');
    expect(mapped.prescriberName).toBe('Dr. Sarah Johnson');
    expect(mapped.prescriberNpi).toBe('1234567890');
    expect(mapped.barcodes).toContain('RX-4821');
    expect(mapped.requiresSignature).toBe(true);
    expect(mapped.cashAmount).toBe(25.00);
    // HIPAA: hipaaSafeNotes should NOT contain medication names
    expect(mapped.hipaaSafeNotes).toBe('Ring doorbell');
    // Internal notes have RX numbers (for pharmacy staff only)
    expect(mapped.notes).toContain('RX-4821');
  });

  it('PioneerRx is registered with pharmacy industry gate', async () => {
    const { getAvailablePlatforms } = await import('../lib/integrations/index.js');
    const platforms = getAvailablePlatforms();
    const prx = platforms.find(p => p.platform === 'pioneerrx');
    expect(prx).toBeDefined();
    expect(prx!.industryGate).toBe('pharmacy');
  });

  it('PioneerRx connector is accessible via getConnector', async () => {
    const { getConnector } = await import('../lib/integrations/index.js');
    expect(getConnector('pioneerrx').platform).toBe('pioneerrx');
  });
});
