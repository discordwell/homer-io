import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import type { JwtPayload } from '../../plugins/auth.js';

// Regression coverage for @fastify/jwt v10 upgrade (fast-jwt CVE GHSA-mvf2-f6gm-w987,
// GHSA-rp9m-7r4c-75qg, et al. — fixed in fast-jwt 6.2+ / @fastify/jwt 10).
// These tests pin the sign+verify contract we depend on so a future bump that
// breaks token shape, expiry semantics, or signature validation fails fast.

const SECRET = 'test-secret-not-for-production-use';
const ALT_SECRET = 'different-secret-used-for-tamper-check';

async function buildApp(secret = SECRET): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(jwt, { secret });
  return app;
}

describe('JWT sign + verify (regression for @fastify/jwt v10 / fast-jwt CVE fix)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const payload: JwtPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: '660e8400-e29b-41d4-a716-446655440000',
    email: 'user@homer.io',
    role: 'dispatcher',
  };

  it('happy path: signs a token and verifies it back to the original payload', () => {
    const token = app.jwt.sign(payload, { expiresIn: '15m' });
    expect(typeof token).toBe('string');
    // JWT structure: header.payload.signature (three base64url segments)
    expect(token.split('.')).toHaveLength(3);

    const decoded = app.jwt.verify<JwtPayload & { iat: number; exp: number }>(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.tenantId).toBe(payload.tenantId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    // expiresIn '15m' must translate to exp ~15 minutes past iat
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  it('rejects a token whose signature has been tampered with', () => {
    const token = app.jwt.sign(payload, { expiresIn: '15m' });
    const [header, body, signature] = token.split('.');
    // Flip the last character of the signature to invalidate it
    const lastChar = signature.charAt(signature.length - 1);
    const tamperedChar = lastChar === 'A' ? 'B' : 'A';
    const tampered = `${header}.${body}.${signature.slice(0, -1)}${tamperedChar}`;

    expect(() => app.jwt.verify(tampered)).toThrow();
  });

  it('rejects a token signed with a different secret (algorithm confusion defense)', async () => {
    const otherApp = await buildApp(ALT_SECRET);
    await otherApp.ready();
    try {
      const foreignToken = otherApp.jwt.sign(payload, { expiresIn: '15m' });
      // The main app (SECRET) must not accept a token signed with ALT_SECRET.
      expect(() => app.jwt.verify(foreignToken)).toThrow();
    } finally {
      await otherApp.close();
    }
  });

  it('rejects an expired token', () => {
    // Sign with a negative expiresIn so the token is already expired at issue time.
    const token = app.jwt.sign(payload, { expiresIn: '-1s' });
    expect(() => app.jwt.verify(token)).toThrow();
  });

  it('rejects structurally malformed tokens', () => {
    expect(() => app.jwt.verify('not-a-jwt')).toThrow();
    expect(() => app.jwt.verify('only.two')).toThrow();
    expect(() => app.jwt.verify('')).toThrow();
  });
});
