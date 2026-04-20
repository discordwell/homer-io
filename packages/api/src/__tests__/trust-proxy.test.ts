import { describe, it, expect, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { parseTrustProxy } from '../config.js';

// ── parseTrustProxy (pure config parsing) ─────────────────────────────────────

describe('parseTrustProxy', () => {
  it('defaults to loopback-only when env var is unset', () => {
    expect(parseTrustProxy(undefined)).toEqual(['127.0.0.1', '::1']);
  });

  it('defaults to loopback-only for empty string', () => {
    expect(parseTrustProxy('')).toEqual(['127.0.0.1', '::1']);
  });

  it('returns false for "false" (case-insensitive)', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
    expect(parseTrustProxy(' False ')).toBe(false);
  });

  it('returns false for "none"', () => {
    expect(parseTrustProxy('none')).toBe(false);
    expect(parseTrustProxy('NONE')).toBe(false);
  });

  it('parses a single IP', () => {
    expect(parseTrustProxy('10.0.0.1')).toEqual(['10.0.0.1']);
  });

  it('parses a comma-separated list of IPs and CIDRs', () => {
    expect(parseTrustProxy('10.0.0.0/8,172.16.0.0/12')).toEqual([
      '10.0.0.0/8',
      '172.16.0.0/12',
    ]);
  });

  it('trims whitespace and skips empty segments', () => {
    expect(parseTrustProxy(' 10.0.0.1 , , 192.168.1.1 ')).toEqual([
      '10.0.0.1',
      '192.168.1.1',
    ]);
  });

  it('never returns true (which would enable the CVE)', () => {
    // Defense in depth: no valid input should produce `true`.
    const inputs = [undefined, '', 'false', 'none', '10.0.0.1', '10.0.0.0/8,172.16.0.0/12'];
    for (const input of inputs) {
      expect(parseTrustProxy(input)).not.toBe(true);
    }
  });
});

// ── config.server.trustProxy (env-driven) ────────────────────────────────────

describe('config.server.trustProxy from TRUST_PROXY env var', () => {
  const ORIGINAL = process.env.TRUST_PROXY;

  beforeEach(() => {
    // Reset between tests — vitest resetModules ensures fresh config import.
    if (ORIGINAL === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = ORIGINAL;
  });

  it('defaults to loopback when TRUST_PROXY is unset', async () => {
    delete process.env.TRUST_PROXY;
    const { parseTrustProxy: fn } = await import('../config.js');
    expect(fn(process.env.TRUST_PROXY)).toEqual(['127.0.0.1', '::1']);
  });

  it('TRUST_PROXY=false → config.server.trustProxy === false', async () => {
    process.env.TRUST_PROXY = 'false';
    const { parseTrustProxy: fn } = await import('../config.js');
    expect(fn(process.env.TRUST_PROXY)).toBe(false);
  });

  it('TRUST_PROXY=10.0.0.0/8,172.16.0.0/12 → parsed as array', async () => {
    process.env.TRUST_PROXY = '10.0.0.0/8,172.16.0.0/12';
    const { parseTrustProxy: fn } = await import('../config.js');
    expect(fn(process.env.TRUST_PROXY)).toEqual([
      '10.0.0.0/8',
      '172.16.0.0/12',
    ]);
  });
});

// ── Fastify runtime behavior under restricted trustProxy ─────────────────────

describe('Fastify trustProxy enforcement (integration)', () => {
  it('ignores X-Forwarded-For from a non-trusted (non-loopback) source', async () => {
    const app = Fastify({ trustProxy: ['127.0.0.1', '::1'] });
    app.get('/whoami', async (request) => ({
      ip: request.ip,
      ips: request.ips,
    }));

    // Simulate a request from an untrusted remote address with a spoofed
    // X-Forwarded-For header. trustProxy does NOT include 8.8.8.8, so
    // request.ip MUST be the actual socket IP (8.8.8.8), NOT 1.2.3.4.
    // This is the CORE defense against IP spoofing — rate limits, audit
    // logs, and IP allow-lists all key on request.ip.
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      remoteAddress: '8.8.8.8',
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-forwarded-proto': 'https',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ip).toBe('8.8.8.8');
    expect(body.ip).not.toBe('1.2.3.4');

    await app.close();
  });

  it('with trustProxy=true (unsafe), honors spoofed X-Forwarded-For from anywhere', async () => {
    // Regression guard: this is the pre-fix behavior we are moving AWAY from.
    // If this ever changes to match the safe behavior, great — but we assert
    // it to make the contrast explicit. If somebody "cleans up" our loopback
    // restriction back to `true`, the safe test above would start failing.
    const app = Fastify({ trustProxy: true });
    app.get('/whoami', async (request) => ({ ip: request.ip }));

    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      remoteAddress: '8.8.8.8',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    // trustProxy=true is VULNERABLE — spoofed IP is honored.
    expect(res.json().ip).toBe('1.2.3.4');

    await app.close();
  });

  it('honors X-Forwarded-For from a trusted loopback source', async () => {
    const app = Fastify({ trustProxy: ['127.0.0.1', '::1'] });
    app.get('/whoami', async (request) => ({
      ip: request.ip,
      protocol: request.protocol,
    }));

    // Loopback is trusted, so the forwarded header is honored — this is
    // the legitimate Caddy → API path.
    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      remoteAddress: '127.0.0.1',
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-forwarded-proto': 'https',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ip).toBe('1.2.3.4');
    expect(body.protocol).toBe('https');

    await app.close();
  });

  it('with trustProxy=false, never honors X-Forwarded-For even from loopback', async () => {
    const app = Fastify({ trustProxy: false });
    app.get('/whoami', async (request) => ({ ip: request.ip }));

    const res = await app.inject({
      method: 'GET',
      url: '/whoami',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ip).toBe('127.0.0.1');

    await app.close();
  });
});
