import { describe, it, expect } from 'vitest';
import { sendMessageSchema, messageListQuerySchema, messageResponseSchema } from '@homer-io/shared';

describe('Messages - Send Schema', () => {
  it('accepts a simple message', () => {
    const result = sendMessageSchema.parse({
      body: 'Hello from dispatch!',
    });
    expect(result.body).toBe('Hello from dispatch!');
    expect(result.routeId).toBeUndefined();
    expect(result.recipientId).toBeUndefined();
  });

  it('accepts message with route ID', () => {
    const result = sendMessageSchema.parse({
      routeId: '550e8400-e29b-41d4-a716-446655440000',
      body: 'Route update',
    });
    expect(result.routeId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts message with recipient ID', () => {
    const result = sendMessageSchema.parse({
      recipientId: '550e8400-e29b-41d4-a716-446655440000',
      body: 'Direct message',
    });
    expect(result.recipientId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts message with attachment URL', () => {
    const result = sendMessageSchema.parse({
      body: 'See attached',
      attachmentUrl: 'https://example.com/file.pdf',
    });
    expect(result.attachmentUrl).toBe('https://example.com/file.pdf');
  });

  it('rejects empty body', () => {
    expect(() => sendMessageSchema.parse({
      body: '',
    })).toThrow();
  });

  it('rejects body exceeding 2000 characters', () => {
    expect(() => sendMessageSchema.parse({
      body: 'x'.repeat(2001),
    })).toThrow();
  });

  it('accepts body at exactly 2000 characters', () => {
    const result = sendMessageSchema.parse({
      body: 'x'.repeat(2000),
    });
    expect(result.body).toHaveLength(2000);
  });

  it('rejects non-UUID route ID', () => {
    expect(() => sendMessageSchema.parse({
      routeId: 'not-a-uuid',
      body: 'Test',
    })).toThrow();
  });

  it('rejects non-UUID recipient ID', () => {
    expect(() => sendMessageSchema.parse({
      recipientId: 'not-a-uuid',
      body: 'Test',
    })).toThrow();
  });

  it('rejects invalid attachment URL', () => {
    expect(() => sendMessageSchema.parse({
      body: 'Test',
      attachmentUrl: 'not-a-url',
    })).toThrow();
  });
});

describe('Messages - List Query Schema', () => {
  it('accepts empty query with defaults', () => {
    const result = messageListQuerySchema.parse({});
    expect(result.limit).toBe(50);
  });

  it('accepts query with route filter', () => {
    const result = messageListQuerySchema.parse({
      routeId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.routeId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts query with cursor', () => {
    const result = messageListQuerySchema.parse({
      cursor: '2026-03-15T00:00:00Z',
    });
    expect(result.cursor).toBe('2026-03-15T00:00:00Z');
  });

  it('accepts custom limit', () => {
    const result = messageListQuerySchema.parse({
      limit: 25,
    });
    expect(result.limit).toBe(25);
  });

  it('rejects limit below 1', () => {
    expect(() => messageListQuerySchema.parse({
      limit: 0,
    })).toThrow();
  });

  it('rejects limit above 100', () => {
    expect(() => messageListQuerySchema.parse({
      limit: 101,
    })).toThrow();
  });

  it('rejects non-UUID route ID in query', () => {
    expect(() => messageListQuerySchema.parse({
      routeId: 'bad',
    })).toThrow();
  });
});

describe('Messages - Response Schema', () => {
  it('validates a complete message response', () => {
    const result = messageResponseSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      routeId: '660e8400-e29b-41d4-a716-446655440001',
      senderId: '770e8400-e29b-41d4-a716-446655440002',
      senderName: 'Dispatcher',
      recipientId: null,
      body: 'Hello',
      attachmentUrl: null,
      readAt: null,
      createdAt: '2026-03-15T12:00:00.000Z',
    });
    expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.senderName).toBe('Dispatcher');
    expect(result.readAt).toBeNull();
  });

  it('validates message with readAt timestamp', () => {
    const result = messageResponseSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      routeId: null,
      senderId: '770e8400-e29b-41d4-a716-446655440002',
      recipientId: '880e8400-e29b-41d4-a716-446655440003',
      body: 'Read message',
      attachmentUrl: null,
      readAt: '2026-03-15T12:05:00.000Z',
      createdAt: '2026-03-15T12:00:00.000Z',
    });
    expect(result.readAt).toBe('2026-03-15T12:05:00.000Z');
  });
});
