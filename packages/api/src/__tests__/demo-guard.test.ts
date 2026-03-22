import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../lib/cache.js', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();

const chainedSelect = { from: mockFrom };
const chainedFrom = { where: mockWhere };
const chainedWhere = { limit: mockLimit };
const chainedInsert = { values: mockValues };
const chainedValues = { returning: mockReturning };

mockSelect.mockReturnValue(chainedSelect);
mockFrom.mockReturnValue(chainedFrom);
mockWhere.mockReturnValue(chainedWhere);
mockInsert.mockReturnValue(chainedInsert);
mockValues.mockReturnValue(chainedValues);

vi.mock('../lib/db/index.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
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
    passwordHash: 'password_hash',
    name: 'name',
    role: 'role',
    tenantId: 'tenant_id',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('argon2', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password'),
}));

vi.mock('../lib/activity.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/email.js', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
  escapeHtml: vi.fn((s: string) => s),
}));

vi.mock('../config.js', () => ({
  config: {
    app: { frontendUrl: 'http://localhost:3001' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
  },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('checkIsDemo', () => {
  let checkIsDemo: typeof import('../plugins/auth.js').checkIsDemo;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../plugins/auth.js');
    checkIsDemo = mod.checkIsDemo;
  });

  it('returns true for demo tenant (cache miss → DB hit)', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockLimit.mockResolvedValue([{ isDemo: true }]);

    const result = await checkIsDemo('demo-tenant-id');

    expect(result).toBe(true);
    expect(mockCacheGet).toHaveBeenCalledWith('tenant:isDemo:demo-tenant-id');
    expect(mockCacheSet).toHaveBeenCalledWith('tenant:isDemo:demo-tenant-id', true, 60);
  });

  it('returns cached value on second call', async () => {
    mockCacheGet.mockResolvedValue(true);

    const result = await checkIsDemo('demo-tenant-id');

    expect(result).toBe(true);
    expect(mockLimit).not.toHaveBeenCalled(); // No DB hit
    expect(mockCacheSet).not.toHaveBeenCalled(); // No cache write
  });

  it('returns false for non-demo tenant', async () => {
    mockCacheGet.mockResolvedValue(null);
    mockLimit.mockResolvedValue([{ isDemo: false }]);

    const result = await checkIsDemo('real-tenant-id');

    expect(result).toBe(false);
    expect(mockCacheSet).toHaveBeenCalledWith('tenant:isDemo:real-tenant-id', false, 60);
  });
});

describe('denyDemo', () => {
  let denyDemo: typeof import('../plugins/auth.js').denyDemo;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../plugins/auth.js');
    denyDemo = mod.denyDemo;
  });

  it('returns 403 for demo tenant', async () => {
    mockCacheGet.mockResolvedValue(true); // cached as demo

    const mockForbidden = vi.fn().mockReturnValue('forbidden-response');
    const request = {
      user: { tenantId: 'demo-tenant-id', id: 'u1', email: 'demo@test.com', role: 'owner' },
    } as unknown as FastifyRequest;
    const reply = { forbidden: mockForbidden } as unknown as FastifyReply;

    const result = await denyDemo(request, reply);

    expect(mockForbidden).toHaveBeenCalledWith('This action is not available in demo mode');
    expect(result).toBe('forbidden-response');
  });

  it('passes through when no user/tenantId', async () => {
    const mockForbidden = vi.fn();
    const request = { user: undefined } as unknown as FastifyRequest;
    const reply = { forbidden: mockForbidden } as unknown as FastifyReply;

    const result = await denyDemo(request, reply);

    expect(mockForbidden).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('passes through for non-demo tenant', async () => {
    mockCacheGet.mockResolvedValue(false);

    const mockForbidden = vi.fn();
    const request = {
      user: { tenantId: 'real-tenant-id', id: 'u1', email: 'real@test.com', role: 'owner' },
    } as unknown as FastifyRequest;
    const reply = { forbidden: mockForbidden } as unknown as FastifyReply;

    const result = await denyDemo(request, reply);

    expect(mockForbidden).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe('Team invite tempPassword leak', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire default chains
    mockSelect.mockReturnValue(chainedSelect);
    mockFrom.mockReturnValue(chainedFrom);
    mockWhere.mockReturnValue(chainedWhere);
    mockInsert.mockReturnValue(chainedInsert);
    mockValues.mockReturnValue(chainedValues);
  });

  it('inviteUser response does NOT contain tempPassword', async () => {
    const fakeUser = {
      id: 'new-user-id',
      email: 'invited@test.com',
      name: 'Test User',
      role: 'dispatcher',
      isActive: true,
      createdAt: new Date('2026-01-01'),
    };

    // First limit call: check existing email → no match
    // Second limit call: tenant lookup for email (fire-and-forget)
    mockLimit
      .mockResolvedValueOnce([]) // no existing user
      .mockResolvedValue([{ name: 'Test Corp' }]); // tenant for email
    mockReturning.mockResolvedValueOnce([fakeUser]);

    const { inviteUser } = await import('../modules/team/service.js');
    const result = await inviteUser('tenant-1', {
      email: 'invited@test.com',
      name: 'Test User',
      role: 'dispatcher',
    });

    expect(result).not.toHaveProperty('tempPassword');
    expect(result).toHaveProperty('email', 'invited@test.com');
    expect(result).toHaveProperty('createdAt', '2026-01-01T00:00:00.000Z');
  });
});
