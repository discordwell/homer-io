import type { ToolRiskLevel, NLOpsRole } from '@homer-io/shared';

export interface NLOpsTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema for Claude tool_use
  riskLevel: ToolRiskLevel;
  requiredRole: NLOpsRole;
  /** Whether this mutation can be undone via the undo system */
  undoable?: boolean;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** For mutations: generate a human-readable preview before execution */
  preview?: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

/** Summarize a tool result for the thought overlay (keep it short) */
export function summarizeResult(toolName: string, result: unknown): string {
  if (result === null || result === undefined) return 'No results';
  if (typeof result === 'string') return result.slice(0, 120);

  const r = result as Record<string, unknown>;

  // Paginated list
  if ('items' in r && Array.isArray(r.items)) {
    return `Found ${r.items.length} of ${r.total ?? '?'} results`;
  }
  // Single entity with name
  if ('name' in r) return `Found: ${r.name}`;
  // Driver with driverName
  if ('driverName' in r) return `Found: ${r.driverName}`;
  // Success/count patterns
  if ('success' in r) return r.success ? 'Success' : 'Failed';
  if ('count' in r) return `${r.count} items`;
  if ('updated' in r) return `Updated ${r.updated} items`;
  if ('assigned' in r) return `Assigned ${r.assigned} items`;

  // Fallback: key count
  const keys = Object.keys(r);
  return `Result with ${keys.length} fields`;
}
