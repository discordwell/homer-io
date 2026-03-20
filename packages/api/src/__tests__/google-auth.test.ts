import { describe, it, expect } from 'vitest';
import { extractDomain, isGenericDomain } from '../modules/auth/domain.js';
import { buildOrgOptions } from '../modules/auth/google.js';

describe('Google Auth - Schema columns', () => {
  it('users table has googleId column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.googleId).toBeDefined();
  });

  it('users table has avatarUrl column defined', async () => {
    const { users } = await import('../lib/db/schema/users.js');
    expect(users.avatarUrl).toBeDefined();
  });

  it('tenants table has orgDomain column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.orgDomain).toBeDefined();
  });

  it('tenants table has autoJoinEnabled column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.autoJoinEnabled).toBeDefined();
  });

  it('tenants table has isDemo column defined', async () => {
    const { tenants } = await import('../lib/db/schema/tenants.js');
    expect(tenants.isDemo).toBeDefined();
  });
});

describe('Domain resolution', () => {
  it('extracts domain from email', () => {
    expect(extractDomain('user@acme.com')).toBe('acme.com');
    expect(extractDomain('USER@ACME.COM')).toBe('acme.com');
  });

  it('identifies generic email domains', () => {
    expect(isGenericDomain('gmail.com')).toBe(true);
    expect(isGenericDomain('yahoo.com')).toBe(true);
    expect(isGenericDomain('hotmail.com')).toBe(true);
    expect(isGenericDomain('outlook.com')).toBe(true);
    expect(isGenericDomain('icloud.com')).toBe(true);
    expect(isGenericDomain('protonmail.com')).toBe(true);
  });

  it('identifies non-generic domains', () => {
    expect(isGenericDomain('acme.com')).toBe(false);
    expect(isGenericDomain('homer.io')).toBe(false);
  });
});

describe('Google Auth - Org options', () => {
  it('returns fresh and demo options for generic email domains', () => {
    const options = buildOrgOptions(null);
    expect(options).toHaveLength(2);
    expect(options.map(o => o.type)).toEqual(['fresh', 'demo']);
  });

  it('includes join option when matching tenant found', () => {
    const tenant = { id: 'tenant-123', name: 'Acme Logistics', autoJoinEnabled: true };
    const options = buildOrgOptions(tenant);
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({
      type: 'join',
      tenantId: 'tenant-123',
      tenantName: 'Acme Logistics',
    });
  });
});

describe('Google Auth - Route schemas', () => {
  it('validates googleAuthSchema', async () => {
    const { googleAuthSchema } = await import('@homer-io/shared');
    expect(() => googleAuthSchema.parse({ credential: '' })).toThrow();
    expect(() => googleAuthSchema.parse({ credential: 'valid-token' })).not.toThrow();
  });

  it('validates orgChoiceSchema', async () => {
    const { orgChoiceSchema } = await import('@homer-io/shared');
    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'fresh',
      orgName: 'My Org',
    })).not.toThrow();

    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'join',
    })).not.toThrow();

    expect(() => orgChoiceSchema.parse({
      credential: 'token',
      choice: 'invalid',
    })).toThrow();
  });
});
