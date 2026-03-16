import { describe, it, expect } from 'vitest';
import { nlopsRequestSchema, sseEvent } from '@homer-io/shared';
import { getToolsForRole, getTool, TOTAL_TOOL_COUNT } from '../lib/ai/tools/index.js';
import { summarizeResult } from '../lib/ai/tools/types.js';

// ============================================================
// NLOps Schema Tests
// ============================================================

describe('NLOps - Request Schema', () => {
  it('parses valid request with message', () => {
    const result = nlopsRequestSchema.parse({ message: 'dispatch today' });
    expect(result.message).toBe('dispatch today');
    expect(result.history).toEqual([]);
    expect(result.confirm).toBeUndefined();
  });

  it('parses request with history and confirm', () => {
    const result = nlopsRequestSchema.parse({
      message: 'yes, confirm',
      history: [{ role: 'user', content: 'hi' }],
      confirm: { actionId: 'abc-123' },
    });
    expect(result.confirm?.actionId).toBe('abc-123');
  });

  it('rejects empty message', () => {
    expect(() => nlopsRequestSchema.parse({ message: '' })).toThrow();
  });

  it('accepts message at max length (10000 chars)', () => {
    const result = nlopsRequestSchema.parse({ message: 'x'.repeat(10000) });
    expect(result.message).toHaveLength(10000);
  });

  it('rejects message exceeding 10000 characters', () => {
    expect(() => nlopsRequestSchema.parse({ message: 'x'.repeat(10001) })).toThrow();
  });
});

describe('NLOps - SSE Event Schema', () => {
  it('validates thinking event', () => {
    const event = sseEvent.parse({ type: 'thinking', content: 'Looking up...' });
    expect(event.type).toBe('thinking');
  });

  it('validates tool_start event', () => {
    const event = sseEvent.parse({
      type: 'tool_start', toolCallId: 'tc1', name: 'find_driver', input: { search: 'Marcus' },
    });
    expect(event.type).toBe('tool_start');
  });

  it('validates confirmation event', () => {
    const event = sseEvent.parse({
      type: 'confirmation', actionId: 'a1', toolName: 'cancel_route',
      toolInput: { routeId: 'r1' }, explanation: 'Will cancel', preview: { stops: 5 },
    });
    expect(event.type).toBe('confirmation');
  });

  it('validates done event', () => {
    const event = sseEvent.parse({ type: 'done' });
    expect(event.type).toBe('done');
  });

  it('rejects unknown event type', () => {
    expect(() => sseEvent.parse({ type: 'unknown' })).toThrow();
  });
});

// ============================================================
// Tool Registry Tests
// ============================================================

describe('NLOps - Tool Registry', () => {
  it('has 22 tools total', () => {
    expect(TOTAL_TOOL_COUNT).toBe(22);
  });

  it('returns all tools for owner role', () => {
    const tools = getToolsForRole('owner');
    expect(tools.length).toBe(TOTAL_TOOL_COUNT);
  });

  it('returns all tools for dispatcher role', () => {
    const tools = getToolsForRole('dispatcher');
    // Dispatcher can access everything since all tools require dispatcher or driver
    expect(tools.length).toBe(TOTAL_TOOL_COUNT);
  });

  it('returns fewer tools for driver role', () => {
    const tools = getToolsForRole('driver');
    // Driver only gets tools with requiredRole='driver'
    const driverToolCount = tools.length;
    expect(driverToolCount).toBeLessThan(TOTAL_TOOL_COUNT);
    expect(driverToolCount).toBeGreaterThan(0);

    // Driver should have read-only context tools
    expect(tools.some((t) => t.name === 'get_operational_summary')).toBe(true);
    expect(tools.some((t) => t.name === 'get_route_details')).toBe(true);

    // Driver should NOT have dispatch tools
    expect(tools.some((t) => t.name === 'auto_dispatch')).toBe(false);
    expect(tools.some((t) => t.name === 'reassign_orders')).toBe(false);
  });

  it('returns no tools for unknown role', () => {
    const tools = getToolsForRole('guest');
    expect(tools.length).toBe(0);
  });

  it('finds tool by name', () => {
    const tool = getTool('find_driver');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('find_driver');
    expect(tool!.riskLevel).toBe('read');
  });

  it('returns undefined for unknown tool name', () => {
    expect(getTool('nonexistent')).toBeUndefined();
  });

  it('all tools have valid input schemas', () => {
    const tools = getToolsForRole('owner');
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('all mutation tools have preview functions', () => {
    const tools = getToolsForRole('owner');
    for (const tool of tools) {
      if (tool.riskLevel !== 'read') {
        expect(tool.preview).toBeDefined();
        expect(typeof tool.preview).toBe('function');
      }
    }
  });

  it('read tools do not have preview functions or have optional ones', () => {
    const tools = getToolsForRole('owner');
    const readTools = tools.filter((t) => t.riskLevel === 'read');
    expect(readTools.length).toBeGreaterThan(0);
  });

  it('all tools have descriptions', () => {
    const tools = getToolsForRole('owner');
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});

// ============================================================
// Result Summarizer Tests
// ============================================================

describe('NLOps - Result Summarizer', () => {
  it('handles null/undefined', () => {
    expect(summarizeResult('test', null)).toBe('No results');
    expect(summarizeResult('test', undefined)).toBe('No results');
  });

  it('handles string results', () => {
    expect(summarizeResult('test', 'hello')).toBe('hello');
  });

  it('handles paginated results', () => {
    expect(summarizeResult('test', { items: [1, 2, 3], total: 10 })).toBe('Found 3 of 10 results');
  });

  it('handles named entities', () => {
    expect(summarizeResult('test', { name: 'Route Alpha' })).toBe('Found: Route Alpha');
  });

  it('handles success/failure', () => {
    expect(summarizeResult('test', { success: true })).toBe('Success');
    expect(summarizeResult('test', { success: false })).toBe('Failed');
  });

  it('truncates long strings', () => {
    const long = 'x'.repeat(200);
    expect(summarizeResult('test', long).length).toBe(120);
  });
});

// ============================================================
// Risk Level Tests
// ============================================================

describe('NLOps - Tool Risk Levels', () => {
  it('query tools are read-only', () => {
    const readTools = [
      'get_operational_summary', 'search_orders', 'get_order_details',
      'get_route_details', 'list_routes', 'find_driver',
      'get_available_drivers', 'get_driver_performance', 'get_analytics',
      'get_address_intelligence', 'get_intelligence_insights', 'get_route_risk',
    ];
    for (const name of readTools) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.riskLevel).toBe('read');
    }
  });

  it('mutation tools require confirmation', () => {
    const mutateTools = [
      'assign_order_to_route', 'update_order_status', 'change_driver_status',
      'create_route', 'optimize_route', 'transition_route_status', 'send_customer_notification',
    ];
    for (const name of mutateTools) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.riskLevel).toBe('mutate');
    }
  });

  it('destructive tools require full confirmation', () => {
    const destructiveTools = ['reassign_orders', 'auto_dispatch', 'cancel_route'];
    for (const name of destructiveTools) {
      const tool = getTool(name);
      expect(tool).toBeDefined();
      expect(tool!.riskLevel).toBe('destructive');
    }
  });
});
