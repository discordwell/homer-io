import { describe, it, expect } from 'vitest';
import { aiChatRequestSchema, aiChatMessageSchema } from '@homer-io/shared';

// Unit tests for AI schema validation (no DB required)

describe('AI - Chat Request Schema', () => {
  it('parses valid request with message and history', () => {
    const request = {
      message: 'How many deliveries today?',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
      ],
    };
    expect(aiChatRequestSchema.parse(request)).toEqual(request);
  });

  it('defaults history to empty array when omitted', () => {
    const result = aiChatRequestSchema.parse({ message: 'Hello' });
    expect(result.history).toEqual([]);
  });

  it('rejects empty message', () => {
    expect(() => aiChatRequestSchema.parse({ message: '' })).toThrow();
  });

  it('accepts message at max length (5000 chars)', () => {
    const result = aiChatRequestSchema.parse({ message: 'x'.repeat(5000) });
    expect(result.message).toHaveLength(5000);
  });

  it('rejects message exceeding 5000 characters', () => {
    expect(() => aiChatRequestSchema.parse({
      message: 'x'.repeat(5001),
    })).toThrow();
  });

  it('accepts history at max length (50 entries)', () => {
    const history = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message ${i}`,
    }));
    const result = aiChatRequestSchema.parse({ message: 'test', history });
    expect(result.history).toHaveLength(50);
  });

  it('rejects history exceeding 50 entries', () => {
    const history = Array.from({ length: 51 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message ${i}`,
    }));
    expect(() => aiChatRequestSchema.parse({
      message: 'test',
      history,
    })).toThrow();
  });

  it('rejects request with no message field', () => {
    expect(() => aiChatRequestSchema.parse({})).toThrow();
  });
});

describe('AI - Chat Message Schema', () => {
  it('validates user role', () => {
    const msg = aiChatMessageSchema.parse({ role: 'user', content: 'hi' });
    expect(msg.role).toBe('user');
  });

  it('validates assistant role', () => {
    const msg = aiChatMessageSchema.parse({ role: 'assistant', content: 'hello' });
    expect(msg.role).toBe('assistant');
  });

  it('rejects invalid role "system"', () => {
    expect(() => aiChatMessageSchema.parse({ role: 'system', content: 'hi' })).toThrow();
  });

  it('rejects invalid role "admin"', () => {
    expect(() => aiChatMessageSchema.parse({ role: 'admin', content: 'hi' })).toThrow();
  });

  it('rejects missing content', () => {
    expect(() => aiChatMessageSchema.parse({ role: 'user' })).toThrow();
  });

  it('rejects missing role', () => {
    expect(() => aiChatMessageSchema.parse({ content: 'hello' })).toThrow();
  });
});
