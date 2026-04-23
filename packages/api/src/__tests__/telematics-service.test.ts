import { describe, it, expect, vi } from 'vitest';

vi.mock('../config.js', () => ({
  config: {
    jwt: { secret: 'a'.repeat(32) },
    integrations: { encryptionKey: 'x'.repeat(32) },
    telematics: {
      samsara: { clientId: 'c', clientSecret: 's', webhookSigningSecret: '' },
      motive: { clientId: '', clientSecret: '', webhookSigningSecret: '' },
      geotab: { clientId: '', clientSecret: '', webhookSigningSecret: '' },
    },
    app: { apiUrl: 'https://homer.test', frontendUrl: 'https://homer.test' },
    redis: { url: 'redis://localhost:6379' },
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    sendgrid: { apiKey: '', fromEmail: '' },
  },
}));

// Stub BullMQ so transitive imports via mergePosition → geofencing → customer-notifications
// don't try to open a real Redis connection during the test.
vi.mock('bullmq', () => ({
  Queue: vi.fn(() => ({ add: vi.fn(), on: vi.fn() })),
  Worker: vi.fn(),
}));

vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// Stub DB — signState/verifyState never touch it.
vi.mock('../lib/db/index.js', () => ({ db: {} }));

import { signState, verifyState } from '../modules/telematics/service.js';
import { haversineMeters } from '../modules/tracking/service.js';

describe('signState + verifyState', () => {
  it('round-trips correctly', () => {
    const state = signState('tenant-1', 'samsara');
    const { tenantId, provider } = verifyState(state);
    expect(tenantId).toBe('tenant-1');
    expect(provider).toBe('samsara');
  });

  it('rejects a tampered signature', () => {
    const state = signState('tenant-1', 'samsara');
    const [body] = state.split('.');
    const forged = `${body}.deadbeef`;
    expect(() => verifyState(forged)).toThrow();
  });

  it('rejects a state that was signed >15 minutes ago', () => {
    // Produce a state with an artificially old ts by injecting the same secret
    // via exported signState twice is hard; instead, manually craft + re-sign.
    const { createHmac } = require('crypto') as typeof import('crypto');
    const payload = { tid: 't', prov: 'samsara', ts: Date.now() - 16 * 60_000, nonce: 'abcd' };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', Buffer.from('a'.repeat(32))).update(body).digest('base64url');
    expect(() => verifyState(`${body}.${sig}`)).toThrow(/expired/i);
  });

  it('rejects a state with garbage format', () => {
    expect(() => verifyState('no-dot')).toThrow();
    expect(() => verifyState('')).toThrow();
  });
});

describe('haversineMeters', () => {
  it('computes the distance between SF and Oakland to the right order of magnitude', () => {
    // SF: 37.7749, -122.4194 → Oakland: 37.8044, -122.2711 ≈ 13.4 km
    const d = haversineMeters(37.7749, -122.4194, 37.8044, -122.2711);
    expect(d).toBeGreaterThan(12_000);
    expect(d).toBeLessThan(15_000);
  });

  it('returns 0 for the same point', () => {
    const d = haversineMeters(10, 20, 10, 20);
    expect(d).toBeLessThan(1);
  });
});
