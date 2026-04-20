/**
 * Tests for NLOps confirmation flow hardening (findings M1 + M2).
 *
 * M1: single-use confirmation tokens (replay protection) + 2-min TTL.
 * M2: iteration counter must carry across confirm-resume so maxIterations
 *     spans the full conversational arc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

// Permissive Zod schema used by mock tools — the agent's executeToolSafely
// wrapper requires every tool to expose `zodSchema`, so passthrough() lets
// arbitrary test inputs flow through without rejection.
const passthroughSchema = z.object({}).passthrough();

// ── In-memory cache mock ─────────────────────────────────────────────────────
// We want GET / SET / GETDEL semantics so we can assert single-use behaviour.
interface CacheEntry { value: unknown; ttl: number }
const store = new Map<string, CacheEntry>();
const setCalls: Array<{ key: string; ttl: number }> = [];

vi.mock('../lib/cache.js', () => ({
  cacheGet: vi.fn(async (key: string) => {
    return store.has(key) ? store.get(key)!.value : null;
  }),
  cacheSet: vi.fn(async (key: string, value: unknown, ttl: number) => {
    store.set(key, { value, ttl });
    setCalls.push({ key, ttl });
  }),
  cacheDelete: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  cacheGetAndDelete: vi.fn(async (key: string) => {
    if (!store.has(key)) return null;
    const value = store.get(key)!.value;
    store.delete(key);
    return value;
  }),
  cacheIncr: vi.fn(async () => 1),
  cacheDecr: vi.fn(async () => 0),
  cacheDeletePattern: vi.fn(async () => undefined),
}));

// ── Provider mock ────────────────────────────────────────────────────────────
// A scripted provider that returns queued responses; each `createMessage`
// call pops the next response. The resume path expects exactly one call.
const providerResponses: Array<{ stopReason: 'end_turn' | 'tool_use'; content: unknown[] }> = [];

vi.mock('../lib/ai/providers.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/ai/providers.js')>('../lib/ai/providers.js');
  return {
    ...actual,
    getProvider: () => ({
      createMessage: vi.fn(async () => {
        if (providerResponses.length === 0) {
          return { stopReason: 'end_turn', content: [{ type: 'text', text: 'no more responses' }] };
        }
        return providerResponses.shift()!;
      }),
    }),
  };
});

// ── Tool registry mock ───────────────────────────────────────────────────────
// Override only the lookup — tests register ad-hoc tools via `registerMockTool`.
// Note: we deliberately do NOT use `vi.importActual` here because the real
// tools/index.js transitively imports the DB, which fails to initialize in
// the test env. Re-export just the helpers agent.ts uses.
const mockTools = new Map<string, any>();
function registerMockTool(tool: any) {
  // Inject a permissive zodSchema if the test fixture didn't provide one;
  // the production validation wrapper crashes on missing zodSchema.
  if (!tool.zodSchema) tool.zodSchema = passthroughSchema;
  mockTools.set(tool.name, tool);
}

function summarizeResult(_toolName: string, result: unknown): string {
  if (result === null || result === undefined) return 'No results';
  if (typeof result === 'string') return result.slice(0, 120);
  const r = result as Record<string, unknown>;
  if ('items' in r && Array.isArray(r.items)) return `Found ${r.items.length} of ${r.total ?? '?'} results`;
  if ('success' in r) return r.success ? 'Success' : 'Failed';
  return 'Result';
}

vi.mock('../lib/ai/tools/index.js', () => ({
  getTool: (name: string) => mockTools.get(name),
  getToolsForRole: () => Array.from(mockTools.values()),
  summarizeResult,
  TOTAL_TOOL_COUNT: 0,
  // The agent's confirmation-resume path runs every input through the
  // validation wrapper. Reproduce its shape here so test fixtures with
  // a passthrough zodSchema flow through cleanly.
  executeToolSafely: async (tool: any, input: any, ctx: any) => {
    try {
      const value = tool.zodSchema ? tool.zodSchema.parse(input ?? {}) : (input ?? {});
      const result = await tool.execute(value, ctx);
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: { error: 'invalid_input', message: err instanceof Error ? err.message : 'invalid' } };
    }
  },
  previewToolSafely: async (tool: any, input: any, ctx: any) => {
    try {
      const value = tool.zodSchema ? tool.zodSchema.parse(input ?? {}) : (input ?? {});
      const preview = tool.preview ? await tool.preview(value, ctx) : { tool: tool.name, input: value };
      return { ok: true, preview };
    } catch (err) {
      return { ok: false, error: { error: 'invalid_input', message: err instanceof Error ? err.message : 'invalid' } };
    }
  },
}));

// ── Activity log mock (audit trail) ─────────────────────────────────────────
const logActivityMock = vi.fn((..._args: unknown[]) => Promise.resolve());
vi.mock('../lib/activity.js', () => ({
  logActivity: (...args: unknown[]) => logActivityMock(...args),
}));

// ── Undo mock — don't hit the DB ────────────────────────────────────────────
vi.mock('../lib/ai/undo.js', () => ({
  saveMutationSnapshot: vi.fn(async () => ({ snapshotId: 'snap-1' })),
}));

// ── Config mock — small iteration ceiling so M2 tests are cheap ─────────────
vi.mock('../config.js', () => ({
  config: {
    nlops: {
      provider: 'anthropic',
      maxLoopIterations: 10,
      maxTokens: 1024,
      anthropicModel: 'test-model',
      openaiModel: 'test-model',
    },
    anthropic: { apiKey: 'test' },
    openai: { apiKey: 'test' },
  },
}));

// ── Imports under test (must come AFTER mocks) ──────────────────────────────
import { runAgentLoop, PENDING_KEY_PREFIX, PENDING_TTL } from '../lib/ai/agent.js';

// SSE events are a discriminated union from `@homer-io/shared`. In tests we
// keep narrowing simple with `any` since we assert shape at runtime.
type AnyEvent = Record<string, unknown> & { type: string };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function collect(gen: AsyncGenerator<any>): Promise<AnyEvent[]> {
  const out: AnyEvent[] = [];
  for await (const ev of gen) out.push(ev as AnyEvent);
  return out;
}

/**
 * Seed a pending snapshot directly in the mock cache, bypassing the
 * normal flow. Returns { actionId, confirmationToken }.
 */
function seedPendingSnapshot(overrides: Partial<{
  iterationCount: number;
  tenantId: string;
  userId: string;
  toolName: string;
}> = {}): { actionId: string; confirmationToken: string } {
  const actionId = 'action-' + Math.random().toString(36).slice(2);
  const confirmationToken = randomBytes(32).toString('hex');
  store.set(`${PENDING_KEY_PREFIX}${actionId}`, {
    value: {
      actionId,
      tenantId: overrides.tenantId ?? 'tenant-1',
      userId: overrides.userId ?? 'user-1',
      toolName: overrides.toolName ?? 'test_mutation',
      toolCallId: 'tc-1',
      input: { foo: 'bar' },
      preview: { before: 'state' },
      confirmationTokenHash: hashToken(confirmationToken),
      iterationCount: overrides.iterationCount ?? 1,
      messages: [{ role: 'user', content: 'do the thing' }],
      assistantContent: [{ type: 'tool_use', id: 'tc-1', name: overrides.toolName ?? 'test_mutation', input: { foo: 'bar' } }],
    },
    ttl: PENDING_TTL,
  });
  return { actionId, confirmationToken };
}

function baseParams() {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    userRole: 'owner',
    orgName: 'Test Co',
    timezone: 'UTC',
    message: '',
    history: [],
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('NLOps — M1 replay protection', () => {
  beforeEach(() => {
    store.clear();
    setCalls.length = 0;
    providerResponses.length = 0;
    mockTools.clear();
    logActivityMock.mockClear();

    registerMockTool({
      name: 'test_mutation',
      description: 'mutate',
      inputSchema: { type: 'object', properties: {} },
      riskLevel: 'mutate',
      requiredRole: 'dispatcher',
      execute: vi.fn(async () => ({ success: true })),
      preview: vi.fn(async () => ({ before: 'state' })),
    });
  });

  it('PENDING_TTL is 2 minutes (finding M1)', () => {
    expect(PENDING_TTL).toBe(120);
  });

  it('correct token succeeds, and the snapshot is deleted on success', async () => {
    const { actionId, confirmationToken } = seedPendingSnapshot();
    // End_turn after execution so the loop terminates quickly.
    providerResponses.push({ stopReason: 'end_turn', content: [{ type: 'text', text: 'done' }] });

    const events = await collect(
      runAgentLoop({
        ...baseParams(),
        confirm: { actionId, confirmationToken },
      }),
    );

    const ok = events.find((e) => e.type === 'action_result');
    expect(ok).toBeDefined();
    expect(ok!.success).toBe(true);

    // Snapshot must be gone after single-use consume.
    expect(store.has(`${PENDING_KEY_PREFIX}${actionId}`)).toBe(false);

    // Audit log was written.
    expect(logActivityMock).toHaveBeenCalledTimes(1);
    const auditCall = logActivityMock.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(auditCall).toBeDefined();
    expect(auditCall!.action).toBe('ai_mutation_confirmed');
    expect(auditCall!.entityId).toBe(actionId);
  });

  it('replay of same confirm body returns CONFIRMATION_EXPIRED (single-use)', async () => {
    const { actionId, confirmationToken } = seedPendingSnapshot();
    providerResponses.push({ stopReason: 'end_turn', content: [{ type: 'text', text: 'done' }] });

    // First confirm — succeeds.
    await collect(
      runAgentLoop({ ...baseParams(), confirm: { actionId, confirmationToken } }),
    );

    // Second confirm (replay) — must be rejected, snapshot is gone.
    const replayEvents = await collect(
      runAgentLoop({ ...baseParams(), confirm: { actionId, confirmationToken } }),
    );

    const err = replayEvents.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(err!.code).toBe('CONFIRMATION_EXPIRED');
  });

  it('wrong token returns CONFIRMATION_TOKEN_MISMATCH', async () => {
    const { actionId } = seedPendingSnapshot();

    const events = await collect(
      runAgentLoop({
        ...baseParams(),
        confirm: { actionId, confirmationToken: 'wrong-' + randomBytes(16).toString('hex') },
      }),
    );

    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(err!.code).toBe('CONFIRMATION_TOKEN_MISMATCH');

    // A wrong-token attempt consumes the snapshot atomically (single-use
    // via cacheGetAndDelete happens before token comparison). This is the
    // intended trade-off: a token brute-force attempt destroys the pending
    // action on the first miss, forcing the user to re-issue. Better than
    // allowing an attacker unbounded attempts against a long-lived record.
    expect(store.has(`${PENDING_KEY_PREFIX}${actionId}`)).toBe(false);
  });

  it('token-less confirm (legacy client) returns CONFIRMATION_TOKEN_REQUIRED', async () => {
    const { actionId } = seedPendingSnapshot();

    // Bypass the shared schema by calling runAgentLoop directly with an
    // empty-string token (what an old client might send).
    const events = await collect(
      runAgentLoop({
        ...baseParams(),
        confirm: { actionId, confirmationToken: '' as string },
      }),
    );

    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(err!.code).toBe('CONFIRMATION_TOKEN_REQUIRED');
    expect(String(err!.message)).toMatch(/confirmationToken/i);

    // Legacy-client rejection must NOT consume the snapshot — otherwise a
    // bad actor could DoS legitimate confirms by spamming empty-token
    // requests for every leaked actionId.
    expect(store.has(`${PENDING_KEY_PREFIX}${actionId}`)).toBe(true);
  });

  it('storePendingAction uses the 2-minute TTL', async () => {
    // Drive the agent through a normal turn that pauses on a mutation.
    providerResponses.push({
      stopReason: 'tool_use',
      content: [
        { type: 'text', text: 'about to mutate' },
        { type: 'tool_use', id: 'tc-1', name: 'test_mutation', input: { foo: 'bar' } },
      ],
    });

    const events = await collect(
      runAgentLoop({ ...baseParams(), message: 'mutate please' }),
    );

    const conf = events.find((e) => e.type === 'confirmation');
    expect(conf).toBeDefined();

    // Exactly one pending snapshot was stored, and its TTL is 120.
    const pendingSet = setCalls.find((c) => c.key.startsWith(PENDING_KEY_PREFIX));
    expect(pendingSet).toBeDefined();
    expect(pendingSet!.ttl).toBe(120);
  });

  it('confirmation event exposes a 32-byte hex token (not stored plainly)', async () => {
    providerResponses.push({
      stopReason: 'tool_use',
      content: [
        { type: 'text', text: 'about to mutate' },
        { type: 'tool_use', id: 'tc-1', name: 'test_mutation', input: { foo: 'bar' } },
      ],
    });

    const events = await collect(
      runAgentLoop({ ...baseParams(), message: 'mutate please' }),
    );

    const conf = events.find((e) => e.type === 'confirmation');
    expect(conf).toBeDefined();
    const token = String(conf!.confirmationToken);
    // 32 bytes = 64 hex chars.
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // The raw token must never equal the hash stored server-side.
    const keys = Array.from(store.keys()).filter((k) => k.startsWith(PENDING_KEY_PREFIX));
    expect(keys).toHaveLength(1);
    const stored = store.get(keys[0])!.value as Record<string, unknown>;
    expect(stored.confirmationTokenHash).toBe(hashToken(token));
    expect(stored.confirmationTokenHash).not.toBe(token);
  });
});

describe('NLOps — M2 iteration counter bypass', () => {
  beforeEach(() => {
    store.clear();
    setCalls.length = 0;
    providerResponses.length = 0;
    mockTools.clear();
    logActivityMock.mockClear();

    registerMockTool({
      name: 'test_mutation',
      description: 'mutate',
      inputSchema: { type: 'object', properties: {} },
      riskLevel: 'mutate',
      requiredRole: 'dispatcher',
      execute: vi.fn(async () => ({ success: true })),
      preview: vi.fn(async () => ({ before: 'state' })),
    });
  });

  it('snapshot carries the iteration counter forward', async () => {
    providerResponses.push({
      stopReason: 'tool_use',
      content: [
        { type: 'tool_use', id: 'tc-1', name: 'test_mutation', input: { foo: 'bar' } },
      ],
    });

    await collect(runAgentLoop({ ...baseParams(), message: 'mutate' }));

    // Exactly one pending snapshot was written; iterationCount should be >=1.
    const keys = Array.from(store.keys()).filter((k) => k.startsWith(PENDING_KEY_PREFIX));
    expect(keys).toHaveLength(1);
    const snap = store.get(keys[0])!.value as Record<string, unknown>;
    expect(snap.iterationCount).toBe(1);
  });

  it('resume honours the saved iteration counter — exhaustion aborts', async () => {
    // Seed a snapshot that's already at the iteration ceiling. After the
    // tool runs, the main loop will see `iterations === maxIterations`
    // and immediately emit the safety-valve error without another LLM call.
    const { actionId, confirmationToken } = seedPendingSnapshot({ iterationCount: 10 });

    const events = await collect(
      runAgentLoop({ ...baseParams(), confirm: { actionId, confirmationToken } }),
    );

    // Tool still executed (we were past the LLM call that triggered it).
    const actionResult = events.find((e) => e.type === 'action_result');
    expect(actionResult).toBeDefined();

    // But the post-resume LLM loop should immediately bail via the safety
    // valve because iterations is already at max — no further provider
    // calls should have been consumed.
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(String(err!.message)).toMatch(/maximum reasoning steps/i);
  });

  it('cross-arc chain of 11 turns triggers safety valve on the 11th (M2 regression)', async () => {
    // Simulate: 5 pre-confirmation turns → pause → resume → 6 more turns
    // tries (10 + 1 = crosses ceiling). The pre-pause counter is restored
    // so iterations at the end of the post-resume chain exceeds 10.
    //
    // Simplest observable assertion: seed an `iterationCount: 9` snapshot
    // (one turn before the ceiling). After resume, exactly one more
    // provider tool_use→end_turn cycle is allowed; beyond that the valve
    // must fire.

    const { actionId, confirmationToken } = seedPendingSnapshot({ iterationCount: 9 });

    // After resume, the loop will tick iterations from 9 → 10 on the
    // first LLM call. We queue a tool_use response to force another
    // iteration — which should then hit the valve at 10.
    providerResponses.push({
      stopReason: 'tool_use',
      content: [
        { type: 'tool_use', id: 'tc-read-1', name: 'test_read', input: {} },
      ],
    });

    // Register the read tool (so the post-resume call doesn't error on
    // RBAC / unknown-tool paths).
    registerMockTool({
      name: 'test_read',
      description: 'read',
      inputSchema: { type: 'object', properties: {} },
      riskLevel: 'read',
      requiredRole: 'driver',
      execute: vi.fn(async () => ({ items: [], total: 0 })),
    });

    const events = await collect(
      runAgentLoop({ ...baseParams(), confirm: { actionId, confirmationToken } }),
    );

    // We should see the safety valve error (the 11th turn would be
    // needed, but maxIterations is 10).
    const err = events.find(
      (e) => e.type === 'error' && typeof e.message === 'string' && /maximum reasoning steps/i.test(e.message),
    );
    expect(err).toBeDefined();
  });
});
