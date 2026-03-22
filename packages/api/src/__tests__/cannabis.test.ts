import { describe, it, expect, vi } from 'vitest';

// Mock config for imports that need it
vi.mock('../../config.js', () => ({
  config: {
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
    jwt: { secret: 'test-secret' },
    minio: { endpoint: '', port: 9000, accessKey: '', secretKey: '', useSSL: false },
    integrations: { encryptionKey: 'test-key' },
  },
}));

describe('Cannabis schemas', () => {
  it('cannabisSettingsSchema validates correct settings', async () => {
    const { cannabisSettingsSchema } = await import('@homer-io/shared');
    const result = cannabisSettingsSchema.parse({
      licenseNumber: 'C10-0000001-LIC',
      state: 'CA',
      maxVehicleValue: 5000,
      maxVehicleWeight: null,
      requireIdVerification: true,
      requireSignature: true,
      requirePhoto: true,
      minimumAge: 21,
      allowCashOnDelivery: true,
      manifestPrefix: 'MAN',
    });
    expect(result.licenseNumber).toBe('C10-0000001-LIC');
    expect(result.state).toBe('CA');
    expect(result.maxVehicleValue).toBe(5000);
  });

  it('cannabisSettingsSchema rejects invalid state length', async () => {
    const { cannabisSettingsSchema } = await import('@homer-io/shared');
    expect(() => cannabisSettingsSchema.parse({
      licenseNumber: 'LIC-001',
      state: 'California', // must be 2 chars
    })).toThrow();
  });

  it('cannabisSettingsSchema has sensible defaults', async () => {
    const { cannabisSettingsSchema } = await import('@homer-io/shared');
    const result = cannabisSettingsSchema.parse({
      licenseNumber: 'LIC-001',
      state: 'CA',
    });
    expect(result.maxVehicleValue).toBe(5000);
    expect(result.minimumAge).toBe(21);
    expect(result.requireIdVerification).toBe(true);
    expect(result.manifestPrefix).toBe('MAN');
    expect(result.allowedZipCodes).toEqual([]);
  });

  it('updateCannabisSettingsSchema allows partial updates', async () => {
    const { updateCannabisSettingsSchema } = await import('@homer-io/shared');
    const result = updateCannabisSettingsSchema.parse({ maxVehicleValue: 3000 });
    expect(result.maxVehicleValue).toBe(3000);
    expect(result.licenseNumber).toBeUndefined();
  });

  it('createManifestSchema validates manifest input', async () => {
    const { createManifestSchema } = await import('@homer-io/shared');
    const result = createManifestSchema.parse({
      routeId: '00000000-0000-0000-0000-000000000001',
      items: [{
        orderId: '00000000-0000-0000-0000-000000000002',
        recipientName: 'John Smith',
        products: [{ name: 'Blue Dream 1/8oz', quantity: 1, price: 45.00, trackingTag: 'TAG-001' }],
      }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].products[0].name).toBe('Blue Dream 1/8oz');
  });

  it('createManifestSchema rejects empty items', async () => {
    const { createManifestSchema } = await import('@homer-io/shared');
    expect(() => createManifestSchema.parse({
      routeId: '00000000-0000-0000-0000-000000000001',
      items: [],
    })).toThrow();
  });

  it('idVerificationInputSchema validates input', async () => {
    const { idVerificationInputSchema } = await import('@homer-io/shared');
    const result = idVerificationInputSchema.parse({
      idPhotoBase64: 'base64data...',
      idNumber: '1234',
      idDob: '1990-01-15',
      idExpirationDate: '2028-01-15',
      idNameOnId: 'John Smith',
      orderId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.idDob).toBe('1990-01-15');
  });

  it('createPodSchema now accepts ID verification fields', async () => {
    const { createPodSchema } = await import('@homer-io/shared');
    const result = createPodSchema.parse({
      photoUrls: [],
      idPhotoUrl: '/homer-pod/tenant/order/id.jpg',
      idNumber: '5678',
      idDob: '1985-06-20',
      idExpirationDate: '2027-12-31',
      idNameOnId: 'Jane Doe',
      ageVerified: true,
    });
    expect(result.idPhotoUrl).toBe('/homer-pod/tenant/order/id.jpg');
    expect(result.ageVerified).toBe(true);
  });

  it('userResponseSchema accepts industry field', async () => {
    const { userResponseSchema } = await import('@homer-io/shared');
    const result = userResponseSchema.parse({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@test.com',
      name: 'Test User',
      role: 'owner',
      tenantId: '00000000-0000-0000-0000-000000000002',
      createdAt: '2026-01-01T00:00:00.000Z',
      industry: 'cannabis',
    });
    expect(result.industry).toBe('cannabis');
  });
});

describe('ID verification helpers', () => {
  it('verifyAge correctly calculates age >= 21', async () => {
    const { verifyAge } = await import('../modules/cannabis/service.js');
    // Person born 25 years ago
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 25);
    const result = verifyAge(dob.toISOString().split('T')[0], 21);
    expect(result.verified).toBe(true);
    expect(result.age).toBe(25);
  });

  it('verifyAge correctly rejects under-21', async () => {
    const { verifyAge } = await import('../modules/cannabis/service.js');
    // Person born 19 years ago
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 19);
    const result = verifyAge(dob.toISOString().split('T')[0], 21);
    expect(result.verified).toBe(false);
    expect(result.age).toBe(19);
  });

  it('verifyAge handles edge case — birthday today', async () => {
    const { verifyAge } = await import('../modules/cannabis/service.js');
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 21);
    const result = verifyAge(dob.toISOString().split('T')[0], 21);
    expect(result.verified).toBe(true);
    expect(result.age).toBe(21);
  });

  it('verifyAge rejects someone who is exactly 20', async () => {
    const { verifyAge } = await import('../modules/cannabis/service.js');
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 20);
    // Use local date formatting to avoid timezone shifts
    const dobStr = `${dob.getFullYear()}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
    const result = verifyAge(dobStr, 21);
    expect(result.verified).toBe(false);
    expect(result.age).toBe(20);
  });

  it('validateIdMatch detects exact match', async () => {
    const { validateIdMatch } = await import('../modules/cannabis/service.js');
    const result = validateIdMatch('John Smith', 'John Smith');
    expect(result.match).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it('validateIdMatch handles word order differences', async () => {
    const { validateIdMatch } = await import('../modules/cannabis/service.js');
    const result = validateIdMatch('Smith John', 'John Smith');
    expect(result.match).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  it('validateIdMatch is case insensitive', async () => {
    const { validateIdMatch } = await import('../modules/cannabis/service.js');
    const result = validateIdMatch('JOHN SMITH', 'john smith');
    expect(result.match).toBe(true);
  });

  it('validateIdMatch handles partial name matches', async () => {
    const { validateIdMatch } = await import('../modules/cannabis/service.js');
    // "John A. Smith" vs "John Smith" — should match (2/3 words match = 0.67)
    const result = validateIdMatch('John A Smith', 'John Smith');
    expect(result.match).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('validateIdMatch rejects completely different names', async () => {
    const { validateIdMatch } = await import('../modules/cannabis/service.js');
    const result = validateIdMatch('Alice Johnson', 'Bob Williams');
    expect(result.match).toBe(false);
    expect(result.confidence).toBe(0);
  });
});

describe('Cannabis service exports', () => {
  it('all service functions are importable', async () => {
    const mod = await import('../modules/cannabis/service.js');
    expect(mod.getCannabisSettings).toBeDefined();
    expect(mod.updateCannabisSettings).toBeDefined();
    expect(mod.generateManifestNumber).toBeDefined();
    expect(mod.createManifest).toBeDefined();
    expect(mod.getManifest).toBeDefined();
    expect(mod.listManifests).toBeDefined();
    expect(mod.completeManifest).toBeDefined();
    expect(mod.voidManifest).toBeDefined();
    expect(mod.activateManifest).toBeDefined();
    expect(mod.verifyAge).toBeDefined();
    expect(mod.validateIdMatch).toBeDefined();
    expect(mod.requireCannabisIndustry).toBeDefined();
  });
});

describe('Delivery manifest schema', () => {
  it('delivery manifests table is importable', async () => {
    const { deliveryManifests } = await import('../lib/db/schema/delivery-manifests.js');
    expect(deliveryManifests).toBeDefined();
  });

  it('proof of delivery schema has ID verification columns', async () => {
    const { proofOfDelivery } = await import('../lib/db/schema/proof-of-delivery.js');
    expect(proofOfDelivery.idPhotoUrl).toBeDefined();
    expect(proofOfDelivery.idNumber).toBeDefined();
    expect(proofOfDelivery.idDob).toBeDefined();
    expect(proofOfDelivery.idExpirationDate).toBeDefined();
    expect(proofOfDelivery.idNameOnId).toBeDefined();
    expect(proofOfDelivery.idVerifiedAt).toBeDefined();
    expect(proofOfDelivery.ageVerified).toBeDefined();
  });
});
