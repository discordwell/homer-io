import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config.js';

export function createClaudeClient(): Anthropic | null {
  if (!config.anthropic.apiKey) {
    return null;
  }
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

export async function chatWithClaude(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const client = createClaudeClient();
  if (!client) {
    return 'AI features require an Anthropic API key. Please set the ANTHROPIC_API_KEY environment variable to enable AI-powered features.';
  }

  try {
    const response = await client.messages.create({
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
