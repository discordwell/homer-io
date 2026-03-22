import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheDelete = vi.fn();

vi.mock('../lib/cache.js', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
  cacheDelete: (...args: unknown[]) => mockCacheDelete(...args),
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockInnerJoin = vi.fn();
const mockTransaction = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();

const chainedSelect = { from: mockFrom, innerJoin: mockInnerJoin };
const chainedFrom = { where: mockWhere, innerJoin: mockInnerJoin };
const chainedInnerJoin = { where: mockWhere };
const chainedWhere = { limit: mockLimit };
const chainedInsert = { values: mockValues };
const chainedValues = { returning: mockReturning };
const chainedDelete = { where: mockDeleteWhere };

mockSelect.mockReturnValue(chainedSelect);
mockFrom.mockReturnValue(chainedFrom);
mockInnerJoin.mockReturnValue(chainedInnerJoin);
mockWhere.mockReturnValue(chainedWhere);
mockInsert.mockReturnValue(chainedInsert);
mockValues.mockReturnValue(chainedValues);
mockDelete.mockReturnValue(chainedDelete);

vi.mock('../lib/db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('../lib/db/schema/tenants.js', () => ({
  tenants: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    isDemo: 'is_demo',
  },
}));

vi.mock('../lib/db/schema/users.js', () => ({
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
    role: 'role',
    tenantId: 'tenant_id',
  },
}));

vi.mock('../modules/auth/demo-seed.js', () => ({
  seedDemoOrg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/geocoding.js', () => ({
  getNearestCity: vi.fn().mockReturnValue({ city: 'Test City' }),
}));

const mockGenerateAuthResponse = vi.fn();
vi.mock('../modules/auth/service.js', () => ({
  generateAuthResponse: (...args: unknown[]) => mockGenerateAuthResponse(...args),
}));

vi.mock('../lib/errors.js', async () => {
  class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return { HttpError };
});

// ── Schema Tests ─────────────────────────────────────────────────────────────

describe('demoSessionSchema', () => {
  let demoSessionSchema: z.ZodType;

  beforeEach(async () => {
    const mod = await import('../modules/auth/demo-session.js');
    demoSessionSchema = mod.demoSessionSchema;
  });

  it('rejects request without email', () => {
    expect(() => demoSessionSchema.parse({})).toThrow();
    expect(() => demoSessionSchema.parse({ lat: 40.7, lng: -74.0 })).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() => demoSessionSchema.parse({ email: 'not-an-email' })).toThrow();
    expect(() => demoSessionSchema.parse({ email: '@missing-local.com' })).toThrow();
    expect(() => demoSessionSchema.parse({ email: 'missing-domain@' })).toThrow();
  });

  it('lowercases email via transform', () => {
    const result = demoSessionSchema.parse({ email: 'User@HOMER.IO' });
    expect(result.email).toBe('user@homer.io');
  });

  it('accepts valid email with optional fields', () => {
    const result = demoSessionSchema.parse({
      email: 'test@company.com',
      lat: 40.7128,
      lng: -74.006,
    });
    expect(result.email).toBe('test@company.com');
    expect(result.lat).toBe(40.7128);
  });

  it('rejects email over 255 chars', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(() => demoSessionSchema.parse({ email: longEmail })).toThrow();
  });
});

// ── Handler Tests ────────────────────────────────────────────────────────────

describe('handleDemoSession', () => {
  let handleDemoSession: typeof import('../modules/auth/demo-session.js').handleDemoSession;

  const mockApp = { jwt: { sign: vi.fn() } } as any;
  const mockAuthResponse = {
    accessToken: 'jwt-token',
    refreshToken: 'refresh-token',
    user: { id: 'u1', email: 'test@company.com', name: 'Demo User', role: 'owner', tenantId: 't1', createdAt: '2026-01-01T00:00:00Z' },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset chains
    mockSelect.mockReturnValue(chainedSelect);
    mockFrom.mockReturnValue(chainedFrom);
    mockInnerJoin.mockReturnValue(chainedInnerJoin);
    mockWhere.mockReturnValue(chainedWhere);
    mockInsert.mockReturnValue(chainedInsert);
    mockValues.mockReturnValue(chainedValues);
    mockDelete.mockReturnValue(chainedDelete);

    const mod = await import('../modules/auth/demo-session.js');
    handleDemoSession = mod.handleDemoSession;
  });

  it('rejects disposable email with 422', async () => {
    try {
      await handleDemoSession(mockApp, {
        email: 'test@mailinator.com',
      });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
      expect(err.message).toContain('Disposable email');
    }
  });

  it('rejects yopmail.com with 422', async () => {
    try {
      await handleDemoSession(mockApp, {
        email: 'test@yopmail.com',
      });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
    }
  });

  it('rejects subdomain of disposable domain', async () => {
    try {
      await handleDemoSession(mockApp, {
        email: 'test@sub.mailinator.com',
      });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(422);
    }
  });

  it('returns existing demo session from cache (isNew: false)', async () => {
    // Cache hit for email key
    mockCacheGet.mockImplementation((key: string) => {
      if (key.startsWith('demo:email:')) return Promise.resolve({ tenantId: 't1', userId: 'u1' });
      return Promise.resolve(null);
    });
    // tenantExists → found
    mockLimit.mockResolvedValueOnce([{ id: 't1' }]);
    // user lookup
    mockLimit.mockResolvedValueOnce([{ id: 'u1', email: 'test@company.com', name: 'Demo User', role: 'owner', tenantId: 't1' }]);
    mockGenerateAuthResponse.mockResolvedValue(mockAuthResponse);

    const result = await handleDemoSession(mockApp, {
      email: 'test@company.com',
    });

    expect(result.isNew).toBe(false);
    expect(result.auth).toEqual(mockAuthResponse);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('creates new tenant on first request with email (isNew: true)', async () => {
    // No cache hit for any key
    mockCacheGet.mockResolvedValue(null);
    // DB slow-path: no existing demo
    mockLimit.mockResolvedValueOnce([]);
    // Transaction creates tenant+user
    const fakeTenant = { id: 'new-t1', name: 'Demo — Demo', slug: 'demo-abc123' };
    const fakeUser = { id: 'new-u1', email: 'fresh@company.com', name: 'Demo User', role: 'owner', tenantId: 'new-t1' };
    const txReturning = vi.fn()
      .mockResolvedValueOnce([fakeTenant])
      .mockResolvedValueOnce([fakeUser]);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: () => ({ values: () => ({ returning: txReturning }) }),
      };
      return fn(tx);
    });
    mockGenerateAuthResponse.mockResolvedValue(mockAuthResponse);

    const result = await handleDemoSession(mockApp, {
      email: 'fresh@company.com',
    });

    expect(result.isNew).toBe(true);
    expect(result.auth).toEqual(mockAuthResponse);
    expect(mockTransaction).toHaveBeenCalled();
    // Cache should be set with 7-day TTL (604800s)
    expect(mockCacheSet).toHaveBeenCalledWith(
      'demo:email:fresh@company.com',
      expect.objectContaining({ tenantId: 'new-t1', userId: 'new-u1' }),
      604800,
    );
    // Lock should be released
    expect(mockCacheDelete).toHaveBeenCalledWith('demo:lock:fresh@company.com');
  });

  it('allows new creation after tenant was cleaned up', async () => {
    // Cache hit for email key but tenant gone; no lock
    mockCacheGet.mockImplementation((key: string) => {
      if (key.startsWith('demo:email:')) return Promise.resolve({ tenantId: 'gone-t1', userId: 'gone-u1' });
      return Promise.resolve(null); // no lock
    });
    // tenantExists → not found
    mockLimit.mockResolvedValueOnce([]);
    // DB slow-path: no live demo found (innerJoin filters out deleted tenant)
    mockLimit.mockResolvedValueOnce([]);

    // Falls through to creation
    const fakeTenant = { id: 'new-t2', name: 'Demo — Demo', slug: 'demo-xyz' };
    const fakeUser = { id: 'new-u2', email: 'reuse@company.com', name: 'Demo User', role: 'owner', tenantId: 'new-t2' };
    const txReturning2 = vi.fn()
      .mockResolvedValueOnce([fakeTenant])
      .mockResolvedValueOnce([fakeUser]);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: () => ({ values: () => ({ returning: txReturning2 }) }),
      };
      return fn(tx);
    });
    mockGenerateAuthResponse.mockResolvedValue(mockAuthResponse);

    const result = await handleDemoSession(mockApp, {
      email: 'reuse@company.com',
    });

    expect(result.isNew).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
    // Stale cache should have been deleted
    expect(mockCacheDelete).toHaveBeenCalledWith('demo:email:reuse@company.com');
  });

  it('different emails create different cache keys', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockLimit.mockResolvedValue([]);

    const fakeTenant = { id: 't-a', name: 'Demo', slug: 'demo-a' };
    const fakeUser = { id: 'u-a', email: 'alice@co.com', name: 'Demo User', role: 'owner', tenantId: 't-a' };
    const txRetA = vi.fn().mockResolvedValueOnce([fakeTenant]).mockResolvedValueOnce([fakeUser]);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: () => ({ values: () => ({ returning: txRetA }) }),
      };
      return fn(tx);
    });
    mockGenerateAuthResponse.mockResolvedValue(mockAuthResponse);

    await handleDemoSession(mockApp, { email: 'alice@co.com' });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'demo:email:alice@co.com',
      expect.anything(),
      expect.anything(),
    );

    mockCacheSet.mockClear();
    mockCacheGet.mockResolvedValue(null);
    mockLimit.mockResolvedValue([]);

    const fakeTenant2 = { id: 't-b', name: 'Demo', slug: 'demo-b' };
    const fakeUser2 = { id: 'u-b', email: 'bob@co.com', name: 'Demo User', role: 'owner', tenantId: 't-b' };
    const txRetB = vi.fn().mockResolvedValueOnce([fakeTenant2]).mockResolvedValueOnce([fakeUser2]);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: () => ({ values: () => ({ returning: txRetB }) }),
      };
      return fn(tx);
    });

    await handleDemoSession(mockApp, { email: 'bob@co.com' });

    expect(mockCacheSet).toHaveBeenCalledWith(
      'demo:email:bob@co.com',
      expect.anything(),
      expect.anything(),
    );
  });

  it('allows gmail.com (not disposable)', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockLimit.mockResolvedValue([]);

    const fakeTenant = { id: 't-g', name: 'Demo', slug: 'demo-g' };
    const fakeUser = { id: 'u-g', email: 'user@gmail.com', name: 'Demo User', role: 'owner', tenantId: 't-g' };
    const txRetG = vi.fn().mockResolvedValueOnce([fakeTenant]).mockResolvedValueOnce([fakeUser]);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        insert: () => ({ values: () => ({ returning: txRetG }) }),
      };
      return fn(tx);
    });
    mockGenerateAuthResponse.mockResolvedValue(mockAuthResponse);

    const result = await handleDemoSession(mockApp, {
      email: 'user@gmail.com',
    });
    expect(result.auth).toEqual(mockAuthResponse);
  });

  it('returns 409 if creation lock is held', async () => {
    // No cache hit for email
    mockCacheGet.mockImplementation((key: string) => {
      if (key.startsWith('demo:lock:')) return Promise.resolve(true);
      return Promise.resolve(null);
    });
    // DB slow-path: no existing demo
    mockLimit.mockResolvedValue([]);

    try {
      await handleDemoSession(mockApp, { email: 'locked@co.com' });
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(409);
      expect(err.message).toContain('being created');
    }
  });
});
