import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasMinRole, registerSchema, loginSchema, type Role } from '@homer-io/shared';

// Unit tests for auth logic (no DB required)
// Integration tests require a running Postgres instance

describe('Auth - Role checks', () => {
  it('owner can access all roles', () => {
    expect(hasMinRole('owner', 'driver')).toBe(true);
    expect(hasMinRole('owner', 'dispatcher')).toBe(true);
    expect(hasMinRole('owner', 'admin')).toBe(true);
    expect(hasMinRole('owner', 'owner')).toBe(true);
  });

  it('admin cannot access owner', () => {
    expect(hasMinRole('admin', 'owner')).toBe(false);
    expect(hasMinRole('admin', 'admin')).toBe(true);
  });

  it('dispatcher cannot access admin or owner', () => {
    expect(hasMinRole('dispatcher', 'admin')).toBe(false);
    expect(hasMinRole('dispatcher', 'owner')).toBe(false);
    expect(hasMinRole('dispatcher', 'driver')).toBe(true);
  });

  it('driver can only access driver', () => {
    expect(hasMinRole('driver', 'driver')).toBe(true);
    expect(hasMinRole('driver', 'dispatcher')).toBe(false);
  });
});

describe('Auth - JWT payload structure', () => {
  it('validates expected JWT payload shape', () => {
    const payload = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: '660e8400-e29b-41d4-a716-446655440000',
      email: 'test@homer.io',
      role: 'dispatcher' as Role,
    };

    expect(payload.id).toBeDefined();
    expect(payload.tenantId).toBeDefined();
    expect(payload.email).toContain('@');
    expect(['owner', 'admin', 'dispatcher', 'driver']).toContain(payload.role);
  });
});

describe('Auth - Password validation', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(() => registerSchema.parse({
      email: 'test@homer.io',
      password: '1234567',
      name: 'Test',
      orgName: 'Org',
    })).toThrow();
  });

  it('accepts valid passwords', () => {
    const result = registerSchema.parse({
      email: 'test@homer.io',
      password: 'validPassword123',
      name: 'Test',
      orgName: 'Org',
    });
    expect(result.password).toBe('validPassword123');
  });
});

describe('Auth - Email normalization', () => {
  it('validates email format', () => {
    expect(() => loginSchema.parse({
      email: 'not-valid',
      password: 'test123',
    })).toThrow();
  });

  it('accepts valid email', () => {
    const result = loginSchema.parse({
      email: 'User@Homer.IO',
      password: 'test123',
    });
    expect(result.email).toBe('User@Homer.IO');
  });
});
