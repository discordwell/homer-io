import { chatWithClaude } from '../../lib/ai/claude.js';
import { recordMeteredUsage } from '../billing/service.js';

const SYSTEM_PROMPT =
  'You are HOMER, an AI assistant for a logistics and delivery management platform. ' +
  'Help users with fleet management, route planning, order tracking, and delivery optimization. ' +
  'Be concise and helpful.';

export async function handleAiChat(
  tenantId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  // Check metered quota for AI chat
  const meter = await recordMeteredUsage(tenantId, 'aiChatMessages');
  if (!meter.allowed) {
    return meter.reason || 'AI chat quota exceeded. Enable Pay-as-you-go in Settings > Billing to continue.';
  }

  const messages = [...history, { role: 'user' as const, content: message }];
  return chatWithClaude(SYSTEM_PROMPT, messages);
}
