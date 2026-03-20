import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { aiChatRequestSchema, nlopsRequestSchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { handleAiChat } from './service.js';
import { runAgentLoop } from '../../lib/ai/agent.js';
import { recordMeteredUsage } from '../billing/service.js';
import { cacheIncr, cacheDecr, cacheGet, cacheSet } from '../../lib/cache.js';
import { isAIConfigured } from '../../lib/ai/providers.js';
import { db } from '../../lib/db/index.js';
import { tenants } from '../../lib/db/schema/tenants.js';

const AI_NOT_CONFIGURED_MESSAGE =
  'AI Copilot is not available. An AI provider API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) must be configured on the server. Contact your administrator.';

// Per-tenant NLOps rate limiting (finding #5)
const NLOPS_MAX_CONCURRENT = 3;
const NLOPS_MAX_PER_MINUTE = 20;

async function checkTenantRateLimit(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Atomic concurrency check: INCR first, then check limit
  const activeKey = `nlops:active:${tenantId}`;
  const active = await cacheIncr(activeKey, 120); // 2-min safety TTL
  if (active > NLOPS_MAX_CONCURRENT) {
    await cacheDecr(activeKey); // Roll back
    return { allowed: false, reason: `Too many concurrent requests (max ${NLOPS_MAX_CONCURRENT}). Please wait for current operations to finish.` };
  }

  // Atomic rate check: INCR first, then check limit
  const minute = Math.floor(Date.now() / 60000);
  const rateKey = `nlops:rate:${tenantId}:${minute}`;
  const count = await cacheIncr(rateKey, 60);
  if (count > NLOPS_MAX_PER_MINUTE) {
    await cacheDecr(activeKey); // Roll back concurrency
    return { allowed: false, reason: `Rate limit exceeded (max ${NLOPS_MAX_PER_MINUTE}/minute). Please slow down.` };
  }

  return { allowed: true };
}

async function releaseTenantConcurrency(tenantId: string): Promise<void> {
  await cacheDecr(`nlops:active:${tenantId}`);
}

/** Check if tenant is a demo tenant (cached 60s) */
async function checkIsDemo(tenantId: string): Promise<boolean> {
  const cacheKey = `tenant:isDemo:${tenantId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;

  const [row] = await db
    .select({ isDemo: tenants.isDemo })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const isDemo = row?.isDemo ?? false;
  await cacheSet(cacheKey, isDemo, 60);
  return isDemo;
}

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Legacy plain-text chat (kept for backward compat)
  app.post('/chat', async (request, reply) => {
    if (!isAIConfigured()) {
      reply.status(503);
      return { error: AI_NOT_CONFIGURED_MESSAGE, code: 'AI_NOT_CONFIGURED' };
    }
    const { message, history } = aiChatRequestSchema.parse(request.body);
    const result = await handleAiChat(request.user.tenantId, message, history);
    return { reply: result };
  });

  // NLOps SSE endpoint — agentic loop with tool_use
  app.post('/ops', async (request, reply) => {
    const { message, history, confirm } = nlopsRequestSchema.parse(request.body);

    // Check AI provider configuration before proceeding
    if (!isAIConfigured()) {
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      const raw = reply.raw;
      raw.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: AI_NOT_CONFIGURED_MESSAGE, code: 'AI_NOT_CONFIGURED' })}\n\n`);
      raw.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
      raw.end();
      return reply;
    }

    // Per-tenant rate limiting (finding #5)
    const rateCheck = await checkTenantRateLimit(request.user.tenantId);
    if (!rateCheck.allowed) {
      reply.status(429);
      return { error: rateCheck.reason };
    }

    // Meter per-interaction (not per-tool-call) — skip for confirmations (already metered) and demo tenants
    const isDemo = await checkIsDemo(request.user.tenantId);
    if (!confirm && !isDemo) {
      const meter = await recordMeteredUsage(request.user.tenantId, 'aiChatMessages');
      if (!meter.allowed) {
        await releaseTenantConcurrency(request.user.tenantId);
        reply.header('Content-Type', 'text/event-stream');
        reply.header('Cache-Control', 'no-cache');
        reply.header('Connection', 'keep-alive');
        const raw = reply.raw;
        raw.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: meter.reason || 'AI quota exceeded. Enable Pay-as-you-go in Settings > Billing.' })}\n\n`);
        raw.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
        raw.end();
        return reply;
      }
    }

    // Get org context for system prompt
    let orgName = 'your company';
    let timezone = 'UTC';
    try {
      const { getOrgSettings } = await import('../settings/service.js');
      const settings = await getOrgSettings(request.user.tenantId);
      if (settings) {
        orgName = (settings as any).companyName || (settings as any).name || orgName;
        timezone = (settings as any).timezone || timezone;
      }
    } catch {
      // Settings not configured yet — use defaults
    }

    // Set up SSE
    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.header('X-Accel-Buffering', 'no'); // Disable Caddy/nginx buffering
    const raw = reply.raw;

    // (finding #2) Client disconnect detection — abort agent loop when client leaves
    const abortController = new AbortController();
    request.raw.on('close', () => abortController.abort());

    try {
      const agentStream = runAgentLoop({
        tenantId: request.user.tenantId,
        userId: request.user.id,
        userRole: request.user.role,
        orgName,
        timezone,
        message,
        history,
        confirm,
        signal: abortController.signal,
      });

      for await (const event of agentStream) {
        if (abortController.signal.aborted) break;
        raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const errMsg = err instanceof Error ? err.message : 'Internal error';
        raw.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
        raw.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
      }
    }

    await releaseTenantConcurrency(request.user.tenantId);
    raw.end();
    return reply;
  });
}
