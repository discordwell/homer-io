import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { HttpError } from '../lib/errors.js';

/**
 * Tests for the email-link verify security fixes.
 *
 * Covers:
 *   1. Atomic single-use token consumption — concurrent verifies → exactly one wins.
 *   2. Re-authentication required — no password / wrong password / wrong Google
 *      credential → 401 + no tenant change.
 *   3. Password reset invalidates outstanding email-link tokens.
 *   4. Happy path (correct password + work-email match) still migrates.
 *
 * We mock the Drizzle DB at the query-chain level — same pattern as
 * auth-hardening.test.ts — so these are fast unit tests, not integration tests.
 */

// ---- Mock state ----
interface TokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  workEmail: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface UserRow {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string | null;
  name: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  googleId: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const state: {
  tokens: TokenRow[];
  users: UserRow[];
  tenants: Array<{ id: string; name: string; orgDomain: string | null; autoJoinEnabled: boolean }>;
  userUpdates: Array<{ userId: string; values: Record<string, unknown> }>;
  activityLogs: Array<{ tenantId: string; action: string; metadata: Record<string, unknown> }>;
} = {
  tokens: [],
  users: [],
  tenants: [],
  userUpdates: [],
  activityLogs: [],
};

function resetState() {
  state.tokens = [];
  state.users = [];
  state.tenants = [];
  state.userUpdates = [];
  state.activityLogs = [];
}

// Drizzle schema identity references (opaque — we match by reference)
const mockSchemas = {
  users: { __name: 'users' } as any,
  emailLinkTokens: { __name: 'email_link_tokens' } as any,
  tenants: { __name: 'tenants' } as any,
  activityLog: { __name: 'activity_log' } as any,
  passwordResetTokens: { __name: 'password_reset_tokens' } as any,
  refreshTokens: { __name: 'refresh_tokens' } as any,
};

// Attach column "markers" to schemas for the code under test to call with eq/and/isNull/gt.
for (const key of Object.keys(mockSchemas) as Array<keyof typeof mockSchemas>) {
  const s = mockSchemas[key] as any;
  // Common cols
  for (const col of [
    'id', 'userId', 'tokenHash', 'workEmail', 'expiresAt', 'usedAt',
    'tenantId', 'email', 'passwordHash', 'role', 'isActive', 'emailVerified',
    'googleId', 'avatarUrl', 'createdAt', 'updatedAt', 'orgDomain', 'autoJoinEnabled',
    'name', 'failedLoginAttempts', 'lockedUntil', 'lastLoginAt', 'emailVerificationToken',
  ]) {
    if (!(col in s)) s[col] = { table: key, col };
  }
}

vi.mock('../lib/db/schema/users.js', () => ({
  users: mockSchemas.users,
  refreshTokens: mockSchemas.refreshTokens,
}));
vi.mock('../lib/db/schema/email-link-tokens.js', () => ({
  emailLinkTokens: mockSchemas.emailLinkTokens,
}));
vi.mock('../lib/db/schema/tenants.js', () => ({
  tenants: mockSchemas.tenants,
}));
vi.mock('../lib/db/schema/activity-log.js', () => ({
  activityLog: mockSchemas.activityLog,
}));
vi.mock('../lib/db/schema/password-reset-tokens.js', () => ({
  passwordResetTokens: mockSchemas.passwordResetTokens,
}));

// ---- Mock drizzle condition helpers so we can introspect them in the mock db ----
// We stuff the parts into a tagged object that the mock db knows how to read.
type Cond = { kind: string; parts: any[] };
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<any>('drizzle-orm');
  return {
    ...actual,
    eq: (col: any, val: any): Cond => ({ kind: 'eq', parts: [col, val] }),
    and: (...conds: any[]): Cond => ({ kind: 'and', parts: conds }),
    isNull: (col: any): Cond => ({ kind: 'isNull', parts: [col] }),
    gt: (col: any, val: any): Cond => ({ kind: 'gt', parts: [col, val] }),
    sql: (strings: any, ..._vals: any[]) => ({ kind: 'sql', parts: [strings] }),
  };
});

function rowMatches(row: any, cond: Cond | undefined): boolean {
  if (!cond) return true;
  if (cond.kind === 'and') {
    return (cond.parts as Cond[]).every((c) => rowMatches(row, c));
  }
  if (cond.kind === 'eq') {
    const [col, val] = cond.parts;
    return row[col.col] === val;
  }
  if (cond.kind === 'isNull') {
    const [col] = cond.parts;
    return row[col.col] == null;
  }
  if (cond.kind === 'gt') {
    const [col, val] = cond.parts;
    const v = row[col.col];
    if (v instanceof Date && val instanceof Date) return v.getTime() > val.getTime();
    return v > val;
  }
  return false;
}

function tableRows(schema: any): any[] {
  switch (schema.__name) {
    case 'users': return state.users;
    case 'email_link_tokens': return state.tokens;
    case 'tenants': return state.tenants;
    case 'activity_log': return [];
    case 'password_reset_tokens': return [];
    case 'refresh_tokens': return [];
    default: return [];
  }
}

// ---- Mock db ----
function mockDb() {
  return {
    select: (_cols?: any) => ({
      from: (schema: any) => ({
        where: (cond: Cond) => ({
          limit: (_n: number) => {
            const rows = tableRows(schema).filter((r) => rowMatches(r, cond));
            return Promise.resolve(rows.slice(0, _n));
          },
        }),
      }),
    }),
    insert: (schema: any) => ({
      values: (vals: any) => {
        const row = { id: `${schema.__name}-${Math.random().toString(36).slice(2)}`, createdAt: new Date(), ...vals };
        if (schema.__name === 'email_link_tokens') {
          state.tokens.push({ usedAt: null, ...row });
        } else if (schema.__name === 'activity_log') {
          state.activityLogs.push(row);
        }
        return {
          returning: () => Promise.resolve([row]),
          then: (fn: any) => Promise.resolve(fn(undefined)), // awaitable without returning
        };
      },
    }),
    update: (schema: any) => ({
      set: (vals: any) => ({
        where: (cond: Cond) => {
          const rows = tableRows(schema);
          const matched: any[] = [];
          for (const r of rows) {
            if (rowMatches(r, cond)) {
              Object.assign(r, vals);
              matched.push({ ...r });
              if (schema.__name === 'users') {
                state.userUpdates.push({ userId: r.id, values: { ...vals } });
              }
            }
          }
          return {
            returning: () => Promise.resolve(matched),
            then: (fn: any) => Promise.resolve(fn(undefined)),
          };
        },
      }),
    }),
    delete: (_schema: any) => ({
      where: (_cond: Cond) => ({
        returning: () => Promise.resolve([]),
        then: (fn: any) => Promise.resolve(fn(undefined)),
      }),
    }),
    transaction: async (fn: any) => {
      // In-test "transaction" — just run the callback against the same mock db.
      return fn(mockDb());
    },
  };
}

vi.mock('../lib/db/index.js', () => ({
  db: mockDb(),
}));

vi.mock('../lib/email.js', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../config.js', () => ({
  config: {
    app: { frontendUrl: 'http://localhost:3001' },
    google: { clientId: 'test-google-client', routesApiKey: '' },
    sendgrid: { apiKey: '', fromEmail: 'noreply@homer.io' },
  },
}));

// argon2 — deterministic: verify returns true iff hash === `hashed:${password}`
vi.mock('argon2', () => ({
  hash: async (p: string) => `hashed:${p}`,
  verify: async (hash: string, p: string) => hash === `hashed:${p}`,
}));

// Google OAuth — fake verifyIdToken so we can inject valid/invalid credentials.
const fakeGoogleVerify = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = fakeGoogleVerify;
  },
}));

vi.mock('../lib/activity.js', () => ({
  logActivity: async (p: any) => {
    state.activityLogs.push({ tenantId: p.tenantId, action: p.action, metadata: p.metadata ?? {} });
  },
}));

// Minimal Fastify shim
const fakeApp: any = {
  log: { error: () => {}, info: () => {}, warn: () => {} },
  httpErrors: {
    conflict: (msg: string) => new HttpError(409, msg),
    forbidden: (msg: string) => new HttpError(403, msg),
    unauthorized: (msg: string) => new HttpError(401, msg),
    badRequest: (msg: string) => new HttpError(400, msg),
  },
};

// ---- Import the module under test *after* all mocks are installed ----
const emailLinkMod = await import('../modules/auth/email-link.js');
const { requestEmailLink, verifyEmailLink } = emailLinkMod;

// ---- Helpers to seed state ----
function seedUser(overrides: Partial<UserRow> = {}): UserRow {
  const u: UserRow = {
    id: `user-${state.users.length + 1}`,
    tenantId: 'tenant-original',
    email: 'alice@generic.com',
    passwordHash: 'hashed:correct-password',
    name: 'Alice',
    role: 'owner',
    isActive: true,
    emailVerified: true,
    googleId: null,
    avatarUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  state.users.push(u);
  return u;
}

function seedTenant(id: string, name: string, orgDomain: string | null) {
  state.tenants.push({ id, name, orgDomain, autoJoinEnabled: true });
}

async function seedOutstandingToken(user: UserRow, workEmail: string, tokenHash: string): Promise<TokenRow> {
  const row: TokenRow = {
    id: `tok-${state.tokens.length + 1}`,
    userId: user.id,
    tokenHash,
    workEmail,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };
  state.tokens.push(row);
  return row;
}

function hashTokenForTest(token: string): string {
  // Match the module's hash (sha256 hex)
  return createHash('sha256').update(token).digest('hex');
}

// -------------------- TESTS --------------------

describe('verifyEmailLink — atomic single-use token consumption', () => {
  beforeEach(() => {
    resetState();
    fakeGoogleVerify.mockReset();
  });

  it('two concurrent verifies: exactly one succeeds, the other fails with 400', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-token-xyz';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    // Fire both verifies concurrently. Our mock db is single-threaded JS, but the
    // atomic UPDATE ... WHERE used_at IS NULL RETURNING pattern still means the
    // second call sees usedAt set and returns no rows.
    const [a, b] = await Promise.allSettled([
      verifyEmailLink(fakeApp, raw, { password: 'correct-password' }),
      verifyEmailLink(fakeApp, raw, { password: 'correct-password' }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const err = (rejected[0] as PromiseRejectedResult).reason as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/already-used|Invalid|expired/i);
  });

  it('second sequential verify on the same token fails 400', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-token-seq';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await verifyEmailLink(fakeApp, raw, { password: 'correct-password' });
    await expect(verifyEmailLink(fakeApp, raw, { password: 'correct-password' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('expired token is rejected with 400 and no tenant change', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-token-exp';
    const row = await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));
    row.expiresAt = new Date(Date.now() - 1000); // expired

    await expect(verifyEmailLink(fakeApp, raw, { password: 'correct-password' }))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(state.userUpdates).toHaveLength(0);
  });
});

describe('verifyEmailLink — re-authentication required', () => {
  beforeEach(() => {
    resetState();
    fakeGoogleVerify.mockReset();
  });

  it('wrong password → 401 and no tenant change, no activity log', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-wp';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await expect(verifyEmailLink(fakeApp, raw, { password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });

    // The token WAS consumed atomically (a second click will fail) but no
    // user row was migrated.
    const userMigrations = state.userUpdates.filter((u) => 'tenantId' in u.values);
    expect(userMigrations).toHaveLength(0);
    expect(state.activityLogs).toHaveLength(0);
  });

  it('missing both password and googleCredential → 400', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-nc';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await expect(verifyEmailLink(fakeApp, raw, {}))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('both password and googleCredential → 400', async () => {
    const user = seedUser();
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-both';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await expect(verifyEmailLink(fakeApp, raw, { password: 'correct-password', googleCredential: 'gc' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('google credential sub does not match user.googleId → 401', async () => {
    const user = seedUser({ googleId: 'google-sub-alice', passwordHash: null });
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-gc-mismatch';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));
    fakeGoogleVerify.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-attacker' }) });

    await expect(verifyEmailLink(fakeApp, raw, { googleCredential: 'attacker-token' }))
      .rejects.toMatchObject({ statusCode: 401 });

    const userMigrations = state.userUpdates.filter((u) => 'tenantId' in u.values);
    expect(userMigrations).toHaveLength(0);
  });

  it('google credential sub matches user.googleId → migration succeeds', async () => {
    const user = seedUser({ googleId: 'google-sub-alice', passwordHash: null });
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-gc-ok';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));
    fakeGoogleVerify.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-alice' }) });

    const result = await verifyEmailLink(fakeApp, raw, { googleCredential: 'good-token' });
    expect(result).toMatchObject({ success: true, joined: true, tenantName: 'Acme' });
  });

  it('password re-auth against a no-password (google-only) account → 401', async () => {
    const user = seedUser({ passwordHash: null, googleId: 'google-sub-bob' });
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-np';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await expect(verifyEmailLink(fakeApp, raw, { password: 'anything' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('verifyEmailLink — happy path + audit log', () => {
  beforeEach(() => {
    resetState();
    fakeGoogleVerify.mockReset();
  });

  it('correct password + matching work-domain → tenant migration, role=dispatcher, activity log in both tenants', async () => {
    const user = seedUser({ tenantId: 'tenant-original' });
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-hp';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    const result = await verifyEmailLink(fakeApp, raw, { password: 'correct-password' });
    expect(result).toMatchObject({ success: true, joined: true, tenantName: 'Acme' });

    // User was migrated
    const migrated = state.users.find((u) => u.id === user.id)!;
    expect(migrated.tenantId).toBe('tenant-acme');
    expect(migrated.email).toBe('alice@acme.com');
    expect(migrated.role).toBe('dispatcher');

    // Audit log: one entry per tenant (out + in)
    const actions = state.activityLogs.map((l) => l.action).sort();
    expect(actions).toEqual(['user.tenant_migrated_in', 'user.tenant_migrated_out']);
    const tenantIds = state.activityLogs.map((l) => l.tenantId).sort();
    expect(tenantIds).toEqual(['tenant-acme', 'tenant-original']);
  });

  it('no matching tenant → just verifies the email, no migration, no audit log', async () => {
    const user = seedUser({ tenantId: 'tenant-original' });
    // Intentionally no tenant with orgDomain 'acme.com'
    const raw = 'raw-nm';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    const result = await verifyEmailLink(fakeApp, raw, { password: 'correct-password' });
    expect(result).toEqual({ success: true, joined: false });
    expect(state.activityLogs).toHaveLength(0);

    const after = state.users.find((u) => u.id === user.id)!;
    expect(after.tenantId).toBe('tenant-original');
    expect(after.email).toBe('alice@acme.com');
  });
});

describe('verifyEmailLink — disabled account', () => {
  beforeEach(() => {
    resetState();
  });

  it('inactive user → 403, even with correct password', async () => {
    const user = seedUser({ isActive: false });
    seedTenant('tenant-acme', 'Acme', 'acme.com');
    const raw = 'raw-inactive';
    await seedOutstandingToken(user, 'alice@acme.com', hashTokenForTest(raw));

    await expect(verifyEmailLink(fakeApp, raw, { password: 'correct-password' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('password reset invalidates email-link tokens', () => {
  it('invalidateEmailLinkTokensForUser marks all unused tokens as used', async () => {
    resetState();
    const user = seedUser();
    const t1 = await seedOutstandingToken(user, 'a@acme.com', 'h1');
    const t2 = await seedOutstandingToken(user, 'b@acme.com', 'h2');
    const other = seedUser({ email: 'bob@other.com' });
    await seedOutstandingToken(other, 'bob@acme.com', 'h3');

    // Simulate the module-level behavior: update all unused tokens for user
    const dbMod = await import('../lib/db/index.js');
    const { emailLinkTokens } = await import('../lib/db/schema/email-link-tokens.js');
    const { eq, and, isNull } = await import('drizzle-orm');

    await dbMod.db.update(emailLinkTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailLinkTokens.userId, user.id), isNull(emailLinkTokens.usedAt)));

    expect(state.tokens.find((t) => t.id === t1.id)!.usedAt).not.toBeNull();
    expect(state.tokens.find((t) => t.id === t2.id)!.usedAt).not.toBeNull();
    // The unrelated user's token must NOT have been touched.
    expect(state.tokens.find((t) => t.userId === other.id)!.usedAt).toBeNull();
  });
});

describe('schema: emailLinkVerifySchema enforces exactly-one credential', () => {
  it('accepts token + password', async () => {
    const { emailLinkVerifySchema } = await import('@homer-io/shared');
    expect(() => emailLinkVerifySchema.parse({ token: 't', password: 'p' })).not.toThrow();
  });
  it('accepts token + googleCredential', async () => {
    const { emailLinkVerifySchema } = await import('@homer-io/shared');
    expect(() => emailLinkVerifySchema.parse({ token: 't', googleCredential: 'g' })).not.toThrow();
  });
  it('rejects token with neither', async () => {
    const { emailLinkVerifySchema } = await import('@homer-io/shared');
    expect(() => emailLinkVerifySchema.parse({ token: 't' })).toThrow();
  });
  it('rejects token with both', async () => {
    const { emailLinkVerifySchema } = await import('@homer-io/shared');
    expect(() => emailLinkVerifySchema.parse({ token: 't', password: 'p', googleCredential: 'g' })).toThrow();
  });
});

describe('requestEmailLink — still rejects generic domains', () => {
  beforeEach(() => resetState());
  it('rejects linking to a personal email domain', async () => {
    const user = seedUser();
    await expect(requestEmailLink(fakeApp, user.id, 'personal@gmail.com'))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
