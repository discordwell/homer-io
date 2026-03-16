import { FastifyInstance } from 'fastify';
import { aiChatRequestSchema, nlopsRequestSchema } from '@homer-io/shared';
import { authenticate } from '../../plugins/auth.js';
import { handleAiChat } from './service.js';
import { runAgentLoop } from '../../lib/ai/agent.js';
import { recordMeteredUsage } from '../billing/service.js';

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

    // Meter per-interaction (not per-tool-call) — skip for confirmations (already metered)
    if (!confirm) {
      const meter = await recordMeteredUsage(request.user.tenantId, 'aiChatMessages');
      if (!meter.allowed) {
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

    raw.end();
    return reply;
  });
}
