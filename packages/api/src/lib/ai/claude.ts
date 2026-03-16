import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../../config.js';

export function createClaudeClient(): Anthropic | null {
  if (!config.anthropic.apiKey) {
    return null;
  }
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

function createOpenAIClient(): OpenAI | null {
  if (!config.openai.apiKey) {
    return null;
  }
  return new OpenAI({ apiKey: config.openai.apiKey });
}

/**
 * Chat with an LLM. Tries Anthropic first, falls back to OpenAI.
 */
export async function chatWithClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  // Try Anthropic first
  const claude = createClaudeClient();
  if (claude) {
    try {
      const response = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.text ?? 'No response generated.';
    } catch {
      return 'Sorry, the AI service is temporarily unavailable. Please try again later.';
    }
  }

  // Fall back to OpenAI
  const openai = createOpenAIClient();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: config.nlops.openaiModel,
        max_completion_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        ],
      });
      return response.choices[0]?.message?.content ?? 'No response generated.';
    } catch {
      return 'Sorry, the AI service is temporarily unavailable. Please try again later.';
    }
  }

  return 'AI features require an API key. Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable AI-powered features.';
}
