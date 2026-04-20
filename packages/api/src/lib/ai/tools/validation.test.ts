import { describe, it, expect } from 'vitest';
import { validateToolInput, getTool, MAX_TOOL_INPUT_BYTES } from './index.js';

describe('NLOps tool input validation', () => {
  const searchTool = getTool('search_orders');
  if (!searchTool) throw new Error('search_orders tool missing from registry');

  it('accepts valid input and returns precisely typed value', () => {
    const result = validateToolInput(searchTool, { query: 'marcus' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({ query: 'marcus' });
    }
  });

  it('rejects wrong-type input with structured error (no throw)', () => {
    const result = validateToolInput(searchTool, { query: 12345 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('invalid_input');
      expect(result.error.message).toBeDefined();
    }
  });

  it('rejects oversized input past MAX_TOOL_INPUT_BYTES', () => {
    const huge = 'x'.repeat(MAX_TOOL_INPUT_BYTES + 100);
    const result = validateToolInput(searchTool, { query: huge });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('input_too_large');
    }
  });

  it('rejects non-serializable input (cycles / BigInt)', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const result = validateToolInput(searchTool, cyclic);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('invalid_input');
    }
  });

  it('rejects missing-required-field input', () => {
    // get_order_details requires orderId
    const detailTool = getTool('get_order_details');
    if (!detailTool) throw new Error('get_order_details missing');
    const result = validateToolInput(detailTool, {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toBe('invalid_input');
    }
  });
});
