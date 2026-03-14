import { describe, it, expect } from 'vitest';
import { inviteUserSchema, apiKeyCreateSchema } from '@homer-io/shared';
import { hasMinRole, type Role } from '@homer-io/shared';

describe('Team - Invite User Validation', () => {
  it('validates a valid invite', () => {
    const result = inviteUserSchema.parse({
      email: 'dispatcher@homer.io',
      name: 'New Dispatcher',
      role: 'dispatcher',
    });
    expect(result.email).toBe('dispatcher@homer.io');
    expect(result.role).toBe('dispatcher');
  });

  it('accepts all valid roles', () => {
    for (const role of ['owner', 'admin', 'dispatcher', 'driver'] as const) {
      const result = inviteUserSchema.parse({
        email: `${role}@homer.io`,
        name: 'Test',
        role,
      });
      expect(result.role).toBe(role);
    }
  });

  it('rejects invalid email', () => {
    expect(() => inviteUserSchema.parse({
      email: 'not-email',
      name: 'Test',
      role: 'driver',
    })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => inviteUserSchema.parse({
      email: 'test@test.com',
      name: '',
      role: 'driver',
    })).toThrow();
  });

  it('rejects invalid role', () => {
    expect(() => inviteUserSchema.parse({
      email: 'test@test.com',
      name: 'Test',
      role: 'superuser',
    })).toThrow();
  });
});

describe('Team - API Key Create Validation', () => {
  it('validates valid API key creation', () => {
    const result = apiKeyCreateSchema.parse({
      name: 'Integration Key',
      scopes: ['read:orders', 'write:routes'],
    });
    expect(result.name).toBe('Integration Key');
    expect(result.scopes).toHaveLength(2);
  });

  it('rejects empty name', () => {
    expect(() => apiKeyCreateSchema.parse({
      name: '',
      scopes: ['read:all'],
    })).toThrow();
  });

  it('rejects empty scopes array', () => {
    expect(() => apiKeyCreateSchema.parse({
      name: 'Key',
      scopes: [],
    })).toThrow();
  });

  it('rejects name > 255 chars', () => {
    expect(() => apiKeyCreateSchema.parse({
      name: 'x'.repeat(256),
      scopes: ['read:all'],
    })).toThrow();
  });
});

describe('Team - Role-based Access Control', () => {
  it('admin can invite dispatchers and drivers', () => {
    expect(hasMinRole('admin', 'dispatcher')).toBe(true);
    expect(hasMinRole('admin', 'driver')).toBe(true);
  });

  it('dispatcher cannot invite anyone (needs admin)', () => {
    expect(hasMinRole('dispatcher', 'admin')).toBe(false);
  });

  it('owner can manage all roles', () => {
    const roles: Role[] = ['owner', 'admin', 'dispatcher', 'driver'];
    for (const role of roles) {
      expect(hasMinRole('owner', role)).toBe(true);
    }
  });
});
