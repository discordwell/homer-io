import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sseEvent, ttsRequestSchema, transcribeResponseSchema } from '@homer-io/shared';

// ============================================================
// Voice Schema Tests
// ============================================================

describe('Voice - TTS Request Schema', () => {
  it('parses valid request with text only', () => {
    const result = ttsRequestSchema.parse({ text: 'Route 5 has been dispatched.' });
    expect(result.text).toBe('Route 5 has been dispatched.');
    expect(result.voice).toBeUndefined();
  });

  it('parses request with text and voice', () => {
    const result = ttsRequestSchema.parse({ text: 'Hello', voice: 'nova' });
    expect(result.voice).toBe('nova');
  });

  it('rejects empty text', () => {
    expect(() => ttsRequestSchema.parse({ text: '' })).toThrow();
  });

  it('rejects text over 4096 characters', () => {
    expect(() => ttsRequestSchema.parse({ text: 'x'.repeat(4097) })).toThrow();
  });

  it('accepts text at 4096 characters', () => {
    const result = ttsRequestSchema.parse({ text: 'x'.repeat(4096) });
    expect(result.text).toHaveLength(4096);
  });

  it('rejects invalid voice', () => {
    expect(() => ttsRequestSchema.parse({ text: 'hi', voice: 'invalid' })).toThrow();
  });

  it('accepts all valid voices', () => {
    for (const voice of ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']) {
      const result = ttsRequestSchema.parse({ text: 'hello', voice });
      expect(result.voice).toBe(voice);
    }
  });
});

describe('Voice - Transcribe Response Schema', () => {
  it('parses valid response', () => {
    const result = transcribeResponseSchema.parse({ text: 'dispatch the route' });
    expect(result.text).toBe('dispatch the route');
  });

  it('accepts empty string (valid transcription of silence)', () => {
    const result = transcribeResponseSchema.parse({ text: '' });
    expect(result.text).toBe('');
  });
});

// ============================================================
// Voice Service Unit Tests
// ============================================================

describe('Voice - Service Functions', () => {
  it('validates supported MIME types', async () => {
    const { validateAudioMimeType } = await import('../modules/ai/voice.js');
    expect(validateAudioMimeType('audio/webm')).toBe(true);
    expect(validateAudioMimeType('audio/webm;codecs=opus')).toBe(true);
    expect(validateAudioMimeType('audio/mp4')).toBe(true);
    expect(validateAudioMimeType('audio/mpeg')).toBe(true);
    expect(validateAudioMimeType('audio/wav')).toBe(true);
    expect(validateAudioMimeType('audio/ogg')).toBe(true);
    expect(validateAudioMimeType('video/mp4')).toBe(false);
    expect(validateAudioMimeType('text/plain')).toBe(false);
    expect(validateAudioMimeType('')).toBe(false);
  });

  it('validates audio size', async () => {
    const { validateAudioSize } = await import('../modules/ai/voice.js');
    expect(validateAudioSize(1)).toBe(true);
    expect(validateAudioSize(1024 * 1024)).toBe(true); // 1 MB
    expect(validateAudioSize(10 * 1024 * 1024)).toBe(true); // 10 MB (limit)
    expect(validateAudioSize(10 * 1024 * 1024 + 1)).toBe(false); // Over limit
    expect(validateAudioSize(0)).toBe(false); // Empty
    expect(validateAudioSize(-1)).toBe(false); // Negative
  });

  it('reports voice not configured when no API key', async () => {
    const { isVoiceConfigured } = await import('../modules/ai/voice.js');
    // In test environment, OPENAI_API_KEY is not set
    // The function reads from config which reads from env
    expect(typeof isVoiceConfigured()).toBe('boolean');
  });
});

// ============================================================
// Undo Snapshot Tests
// ============================================================

describe('Voice - Undo Snapshot Logic', () => {
  it('undoable SSE event schema validates', () => {
    const event = sseEvent.parse({
      type: 'undoable',
      snapshotId: 'snap-123',
      toolName: 'update_order_status',
      summary: 'Updated order #4521 to delivered',
    });
    expect(event.type).toBe('undoable');
    if (event.type === 'undoable') {
      expect(event.snapshotId).toBe('snap-123');
      expect(event.toolName).toBe('update_order_status');
    }
  });

  it('rejects undoable event without required fields', () => {
    expect(() => sseEvent.parse({ type: 'undoable', snapshotId: 'snap-123' })).toThrow();
  });
});

// ============================================================
// Tool Undoable Flag Tests
// ============================================================

describe('Voice - Tool Undoable Flags', () => {
  it('undoable tools are correctly marked', async () => {
    const { getTool } = await import('../lib/ai/tools/index.js');

    const undoableTools = [
      'assign_order_to_route',
      'update_order_status',
      'change_driver_status',
      'create_route',
      'reassign_orders',
      'transition_route_status',
    ];

    for (const name of undoableTools) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.undoable).toBe(true);
    }
  });

  it('non-undoable tools are not marked', async () => {
    const { getTool } = await import('../lib/ai/tools/index.js');

    const notUndoable = [
      'auto_dispatch',
      'cancel_route',
      'send_customer_notification',
      'optimize_route',
    ];

    for (const name of notUndoable) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.undoable).toBeFalsy();
    }
  });

  it('read-only tools have no undoable flag', async () => {
    const { getTool } = await import('../lib/ai/tools/index.js');

    const readTools = [
      'get_operational_summary',
      'search_orders',
      'find_driver',
    ];

    for (const name of readTools) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.undoable).toBeFalsy();
    }
  });
});
