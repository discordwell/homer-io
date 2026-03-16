import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from '../../config.js';
import type { NLOpsTool } from './tools/types.js';

function safeParse(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

// --- Unified types ---

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string | ProviderContentBlock[];
}

export type ProviderContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ProviderToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderResponse {
  stopReason: 'end_turn' | 'tool_use';
  content: ProviderContentBlock[];
}

// --- Provider interface ---

export interface AIProvider {
  createMessage(params: {
    system: string;
    messages: ProviderMessage[];
    tools: ProviderToolDef[];
    maxTokens: number;
  }): Promise<ProviderResponse>;
}

// --- Anthropic Provider (Claude Opus 4.6) ---

class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.model = config.nlops.anthropicModel;
  }

  async createMessage(params: {
    system: string;
    messages: ProviderMessage[];
    tools: ProviderToolDef[];
    maxTokens: number;
  }): Promise<ProviderResponse> {
    const anthropicMessages = params.messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }
      // Convert content blocks to Anthropic format
      const blocks = m.content.map((b) => {
        if (b.type === 'text') return { type: 'text' as const, text: b.text };
        if (b.type === 'tool_use') return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input };
        if (b.type === 'tool_result') return { type: 'tool_result' as const, tool_use_id: b.tool_use_id, content: b.content, is_error: b.is_error };
        return b;
      });
      return { role: m.role as 'user' | 'assistant', content: blocks as any };
    });

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: anthropicMessages,
      tools: params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as any,
      })),
    });

    const content: ProviderContentBlock[] = response.content.map((block) => {
      if (block.type === 'text') return { type: 'text', text: block.text };
      if (block.type === 'tool_use') return { type: 'tool_use', id: block.id, name: block.name, input: block.input as Record<string, unknown> };
      return { type: 'text', text: '' };
    });

    return {
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
      content,
    };
  }
}

// --- OpenAI Provider (GPT-5.4) ---

class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.nlops.openaiModel;
  }

  async createMessage(params: {
    system: string;
    messages: ProviderMessage[];
    tools: ProviderToolDef[];
    maxTokens: number;
  }): Promise<ProviderResponse> {
    // Convert to OpenAI message format
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
    ];

    for (const m of params.messages) {
      if (typeof m.content === 'string') {
        openaiMessages.push({ role: m.role, content: m.content });
        continue;
      }

      // Handle mixed content blocks
      const toolResults = m.content.filter((b) => b.type === 'tool_result');
      const toolUses = m.content.filter((b) => b.type === 'tool_use');
      const texts = m.content.filter((b) => b.type === 'text');

      if (toolUses.length > 0) {
        // Assistant message with tool calls
        const textContent = texts.map((t) => t.type === 'text' ? t.text : '').join('\n').trim();
        openaiMessages.push({
          role: 'assistant',
          content: textContent || null,
          tool_calls: toolUses.map((t) => t.type === 'tool_use' ? ({
            id: t.id,
            type: 'function' as const,
            function: { name: t.name, arguments: JSON.stringify(t.input) },
          }) : undefined).filter(Boolean) as any,
        });
      } else if (toolResults.length > 0) {
        // Tool result messages
        for (const tr of toolResults) {
          if (tr.type === 'tool_result') {
            openaiMessages.push({
              role: 'tool',
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            });
          }
        }
      } else if (texts.length > 0) {
        openaiMessages.push({
          role: m.role,
          content: texts.map((t) => t.type === 'text' ? t.text : '').join('\n'),
        });
      }
    }

    // Convert tools to OpenAI function format
    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
        strict: true,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: params.maxTokens,
      messages: openaiMessages,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
    });

    const choice = response.choices[0];
    const content: ProviderContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.type === 'function') {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: safeParse(tc.function.arguments),
          });
        }
      }
    }

    return {
      stopReason: choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      content,
    };
  }
}

// --- Factory ---

let cachedProvider: AIProvider | null = null;

export function getProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  if (config.nlops.provider === 'openai') {
    if (!config.openai.apiKey) throw new Error('OPENAI_API_KEY required when NLOPS_PROVIDER=openai');
    cachedProvider = new OpenAIProvider();
  } else {
    if (!config.anthropic.apiKey) throw new Error('ANTHROPIC_API_KEY required for NLOps');
    cachedProvider = new AnthropicProvider();
  }

  return cachedProvider;
}

/** Reset the cached provider singleton — for test setup (finding #17) */
export function resetProvider(): void {
  cachedProvider = null;
}

// Convert NLOpsTool[] to ProviderToolDef[]
export function toProviderTools(tools: NLOpsTool[]): ProviderToolDef[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}
