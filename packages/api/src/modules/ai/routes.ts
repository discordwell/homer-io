import { FastifyInstance } from 'fastify';
import { aiChatRequestSchema, nlopsRequestSchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { handleAiChat } from './service.js';
import { runAgentLoop } from '../../lib/ai/agent.js';
import { recordMeteredUsage } from '../billing/service.js';
import { cacheGet, cacheSet, cacheDelete } from '../../lib/cache.js';

// Per-tenant NLOps rate limiting (finding #5)
const NLOPS_MAX_CONCURRENT = 3;
const NLOPS_MAX_PER_MINUTE = 20;

async function checkTenantRateLimit(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  // Concurrency check: max simultaneous requests per tenant
  const activeKey = `nlops:active:${tenantId}`;
  const active = await cacheGet<number>(activeKey);
  if (active !== null && active >= NLOPS_MAX_CONCURRENT) {
    return { allowed: false, reason: `Too many concurrent requests (max ${NLOPS_MAX_CONCURRENT}). Please wait for current operations to finish.` };
  }

  // Rate check: max requests per minute per tenant
  const minute = Math.floor(Date.now() / 60000);
  const rateKey = `nlops:rate:${tenantId}:${minute}`;
  const count = await cacheGet<number>(rateKey);
  if (count !== null && count >= NLOPS_MAX_PER_MINUTE) {
    return { allowed: false, reason: `Rate limit exceeded (max ${NLOPS_MAX_PER_MINUTE}/minute). Please slow down.` };
  }

  // Increment counters
  await cacheSet(activeKey, (active ?? 0) + 1, 120); // 2-min safety TTL
  await cacheSet(rateKey, (count ?? 0) + 1, 60);

  return { allowed: true };
}

async function releaseTenantConcurrency(tenantId: string): Promise<void> {
  const activeKey = `nlops:active:${tenantId}`;
  const active = await cacheGet<number>(activeKey);
  if (active !== null && active > 1) {
    await cacheSet(activeKey, active - 1, 120);
  } else {
    await cacheDelete(activeKey);
  }
}

export async function aiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Legacy plain-text chat (kept for backward compat)
  app.post('/chat', async (request) => {
    const { message, history } = aiChatRequestSchema.parse(request.body);
    const reply = await handleAiChat(request.user.tenantId, message, history);
    return { reply };
  });

  // NLOps SSE endpoint — agentic loop with tool_use
  app.post('/ops', async (request, reply) => {
    const { message, history, confirm } = nlopsRequestSchema.parse(request.body);

    // Per-tenant rate limiting (finding #5)
    const rateCheck = await checkTenantRateLimit(request.user.tenantId);
    if (!rateCheck.allowed) {
      reply.status(429).header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      const raw = reply.raw;
      raw.write(`event: error\ndata: ${JSON.stringify({ type: 'error', message: rateCheck.reason })}\n\n`);
      raw.write(`event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`);
      raw.end();
      return reply;
    }

    // Meter per-interaction (not per-tool-call) — skip for confirmations (already metered)
    if (!confirm) {
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
