import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { aiChatRequestSchema, nlopsRequestSchema, ttsRequestSchema } from '@homer-io/shared';
import { authenticate, checkIsDemo } from '../../plugins/auth.js';
import { handleAiChat } from './service.js';
import { runAgentLoop } from '../../lib/ai/agent.js';
import { recordMeteredUsage } from '../billing/service.js';
import { cacheIncr, cacheDecr } from '../../lib/cache.js';
import { isAIConfigured } from '../../lib/ai/providers.js';
import { transcribeAudio, synthesizeSpeech, isVoiceConfigured, validateAudioMimeType, validateAudioSize } from './voice.js';
import { getRecentSnapshots } from '../../lib/ai/undo.js';
import { undoMutation } from './undo-service.js';

const AI_NOT_CONFIGURED_MESSAGE =
  'AI Copilot is not available. An AI provider API key (ANTHROPIC_API_KEY or OPENAI_API_KEY) must be configured on the server. Contact your administrator.';

// Per-tenant NLOps rate limiting (finding #5)
const NLOPS_MAX_CONCURRENT = 3;
const NLOPS_MAX_PER_MINUTE = 20;

// Per-user confirm rate limit (finding M1) — defends against
// confirmation-token brute-force on a leaked actionId. A legitimate user
// confirms far fewer than this many actions per minute; anything above this
// is almost certainly an attack.
const CONFIRM_MAX_PER_MINUTE = 10;

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

/**
 * Per-user confirmation rate limit (finding M1). Applied separately from
 * the general NLOps quota so a leaked actionId can't be used to brute-force
 * the 256-bit confirmation token in a window. Note: NLOPS_MAX_PER_MINUTE
 * already bounds this too (since confirms are NLOps calls), but this is a
 * tighter per-user bucket specifically for the confirm path.
 */
async function checkConfirmRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const minute = Math.floor(Date.now() / 60000);
  const rateKey = `nlops:confirm:${userId}:${minute}`;
  const count = await cacheIncr(rateKey, 60);
  if (count > CONFIRM_MAX_PER_MINUTE) {
    return {
      allowed: false,
      reason: `Too many confirmation attempts (max ${CONFIRM_MAX_PER_MINUTE}/minute). Please slow down.`,
    };
  }
  return { allowed: true };
}

async function releaseTenantConcurrency(tenantId: string): Promise<void> {
  await cacheDecr(`nlops:active:${tenantId}`);
}

export async function aiRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
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

    // Per-user confirmation rate limit (finding M1). Reject overly-frequent
    // confirm attempts before we even look at the snapshot — this blocks
    // token brute-force via a leaked actionId.
    if (confirm) {
      const confirmRateCheck = await checkConfirmRateLimit(request.user.id);
      if (!confirmRateCheck.allowed) {
        await releaseTenantConcurrency(request.user.tenantId);
        reply.status(429);
        return { error: confirmRateCheck.reason };
      }
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
        ipAddress: request.ip,
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

  // --- Voice endpoints ---

  // POST /transcribe — audio file -> text via Whisper
  app.post('/transcribe', async (request, reply) => {
    if (!isVoiceConfigured()) {
      reply.status(503);
      return { error: 'Voice features require OPENAI_API_KEY to be configured' };
    }

    const data = await request.file();
    if (!data) {
      reply.status(400);
      return { error: 'No audio file provided. Send multipart form with an "audio" field.' };
    }

    if (!validateAudioMimeType(data.mimetype)) {
      reply.status(400);
      return { error: `Unsupported audio format: ${data.mimetype}. Supported: webm, mp4, mp3, wav, ogg, m4a.` };
    }

    const buffer = await data.toBuffer();
    if (!validateAudioSize(buffer.length)) {
      reply.status(400);
      return { error: 'Audio file is empty or exceeds 10 MB limit.' };
    }

    const text = await transcribeAudio(buffer, data.mimetype);
    return { text };
  });

  // POST /tts — text -> audio/mpeg via OpenAI TTS
  app.post('/tts', async (request, reply) => {
    if (!isVoiceConfigured()) {
      reply.status(503);
      return { error: 'Voice features require OPENAI_API_KEY to be configured' };
    }

    const parsed = ttsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { error: parsed.error.errors.map((e) => e.message).join('; ') };
    }
    const { text, voice } = parsed.data;

    const audioBuffer = await synthesizeSpeech(text, voice);
    reply.header('Content-Type', 'audio/mpeg');
    reply.header('Content-Length', audioBuffer.length);
    return reply.send(audioBuffer);
  });

  // --- Undo endpoints ---

  // GET /undo/recent — list recent undoable actions
  app.get('/undo/recent', async (request) => {
    const snapshots = await getRecentSnapshots(request.user.tenantId);
    return {
      items: snapshots.map((s) => ({
        snapshotId: s.snapshotId,
        toolName: s.toolName,
        summary: s.summary,
        timestamp: s.timestamp,
      })),
    };
  });

  // POST /undo — undo a specific mutation
  app.post('/undo', async (request, reply) => {
    const body = request.body as { snapshotId?: string };
    if (!body?.snapshotId || typeof body.snapshotId !== 'string') {
      reply.status(400);
      return { error: 'Request body must include a "snapshotId" field.' };
    }
    // [C1] Validate snapshotId is a UUID to prevent cache key injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.snapshotId)) {
      reply.status(400);
      return { error: 'Invalid snapshotId format.' };
    }

    const result = await undoMutation(request.user.tenantId, request.user.id, body.snapshotId);
    if (!result.success) {
      reply.status(400);
      return { error: result.error };
    }

    return result;
  });
}
