import type { z } from 'zod';
import type { ToolRiskLevel, NLOpsRole } from '@homer-io/shared';

/**
 * NLOps tool contract.
 *
 * Tools are invoked by the LLM with a free-form `input: Record<string, unknown>`.
 * The LLM is instructed via `inputSchema` (JSON Schema) but does not always obey it.
 * Runtime type-safety therefore depends on `zodSchema`, which the tool registry
 * wrapper (see `tools/index.ts`) `.parse()`s before `execute()` / `preview()` ever
 * see the payload. After parsing, `execute()` receives a precisely-typed
 * `z.infer<typeof zodSchema>` object — no `as any` casts required.
 */
export interface NLOpsTool<TInput = unknown> {
  name: string;
  description: string;
  /** JSON Schema handed to the LLM for tool_use prompt construction (Anthropic/OpenAI). */
  inputSchema: Record<string, unknown>;
  /** Zod schema used at runtime to validate the LLM-provided input before `execute()` runs. */
  zodSchema: z.ZodType<TInput>;
  riskLevel: ToolRiskLevel;
  requiredRole: NLOpsRole;
  /** Whether this mutation can be undone via the undo system */
  undoable?: boolean;
  /**
   * Execute the tool. MUST receive an input that has already been validated against
   * `zodSchema` (the registry wrapper enforces this). MUST scope every DB query by
   * `ctx.tenantId` — see {@link ToolContext}.
   */
  execute: (input: TInput, ctx: ToolContext) => Promise<unknown>;
  /** For mutations: generate a human-readable preview before execution. Same input contract as `execute`. */
  preview?: (input: TInput, ctx: ToolContext) => Promise<unknown>;
}

/**
 * Context threaded through every tool invocation.
 *
 * IMPORTANT — Tenant scope contract:
 * Every tool MUST use `ctx.tenantId` as a WHERE filter in every database query it
 * issues, whether directly or through a service function. The `nlops` agent is
 * shared across tenants, so omitting the filter leaks cross-tenant data.
 *
 * Static enforcement is hard with Drizzle; the registry provides a best-effort
 * debug-mode runtime check, but the primary guarantee is code review + this contract.
 * If you add a tool that touches the DB directly, audit its query carefully.
 */
export interface ToolContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

/**
 * Structured error produced when LLM-provided tool input fails Zod validation or
 * exceeds the size cap. The agent loop surfaces this back to the model (with
 * `is_error: true`) so it can retry with a corrected payload rather than crashing.
 */
export interface ToolInputError {
  error: 'invalid_input' | 'input_too_large';
  message: string;
  details?: Array<{ path: string; message: string }>;
}

export function isToolInputError(value: unknown): value is ToolInputError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { error?: unknown }).error !== undefined &&
    ((value as ToolInputError).error === 'invalid_input' ||
      (value as ToolInputError).error === 'input_too_large')
  );
}

/** Summarize a tool result for the thought overlay (keep it short) */
export function summarizeResult(toolName: string, result: unknown): string {
  if (result === null || result === undefined) return 'No results';
  if (typeof result === 'string') return result.slice(0, 120);

  const r = result as Record<string, unknown>;

  // Structured validation error from the registry wrapper
  if (isToolInputError(r)) {
    return `Invalid input: ${r.message}`;
  }

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
