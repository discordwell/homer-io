import { ZodError } from 'zod';
import type { NLOpsTool, ToolContext, ToolInputError } from './types.js';
import { queryTools } from './query.js';
import { mutationTools } from './mutations.js';

export type { NLOpsTool, ToolContext, ToolInputError } from './types.js';
export { summarizeResult, isToolInputError } from './types.js';

// Role hierarchy: owner > admin > dispatcher > driver
const ROLE_RANK: Record<string, number> = {
  owner: 4,
  admin: 3,
  dispatcher: 2,
  driver: 1,
};

// Cap the size of LLM-provided tool input to prevent memory abuse (finding: HIGH type-safety audit).
// This is independent of the result cap enforced in `agent.ts` (8KB).
export const MAX_TOOL_INPUT_BYTES = 50 * 1024; // 50KB

const allTools: NLOpsTool[] = [...queryTools, ...mutationTools];

/** Get all tools available for a given user role */
export function getToolsForRole(role: string): NLOpsTool[] {
  const rank = ROLE_RANK[role] ?? 0;
  return allTools.filter((t) => {
    const required = ROLE_RANK[t.requiredRole] ?? 0;
    return rank >= required;
  });
}

/** Look up a tool by name */
export function getTool(name: string): NLOpsTool | undefined {
  return allTools.find((t) => t.name === name);
}

/** Total tool count */
export const TOTAL_TOOL_COUNT = allTools.length;

/**
 * Validate LLM-provided input against the tool's Zod schema + a size cap.
 * Returns the parsed, precisely-typed input on success, or a `ToolInputError`
 * that the agent loop surfaces back to the model (with `is_error: true`).
 *
 * Never throws — all failure modes are reported as structured errors so the
 * SSE stream stays healthy and the model can self-correct on the next turn.
 */
export function validateToolInput(
  tool: NLOpsTool,
  input: Record<string, unknown>,
): { ok: true; value: unknown } | { ok: false; error: ToolInputError } {
  // 1. Size cap — prevent unbounded LLM payloads from exhausting memory.
  let serializedSize: number;
  try {
    serializedSize = JSON.stringify(input ?? {}).length;
  } catch {
    return {
      ok: false,
      error: {
        error: 'invalid_input',
        message: 'Tool input is not JSON-serializable (contains cycles or BigInt).',
      },
    };
  }
  if (serializedSize > MAX_TOOL_INPUT_BYTES) {
    return {
      ok: false,
      error: {
        error: 'input_too_large',
        message: `Tool input exceeds maximum size of ${MAX_TOOL_INPUT_BYTES} bytes (got ${serializedSize} bytes). Pass less data per call.`,
      },
    };
  }

  // 2. Zod validation — schema is the single source of runtime type-truth.
  try {
    const value = tool.zodSchema.parse(input ?? {});
    return { ok: true, value };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        ok: false,
        error: {
          error: 'invalid_input',
          message: `Tool "${tool.name}" received invalid input.`,
          details: err.errors.map((e) => ({
            path: e.path.join('.') || '(root)',
            message: e.message,
          })),
        },
      };
    }
    return {
      ok: false,
      error: {
        error: 'invalid_input',
        message: err instanceof Error ? err.message : 'Unknown validation error',
      },
    };
  }
}

/**
 * Execute a tool safely: validate input, then invoke `tool.execute`.
 *
 * On validation failure, returns the structured `ToolInputError` — the caller
 * (agent loop) should feed this back to the LLM as an error tool_result so it
 * can retry with corrected arguments.
 *
 * On execution failure, rethrows — upstream wraps that in an `is_error` tool_result.
 */
export async function executeToolSafely(
  tool: NLOpsTool,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: true; result: unknown } | { ok: false; error: ToolInputError }> {
  const validation = validateToolInput(tool, input);
  if (!validation.ok) return { ok: false, error: validation.error };
  const result = await tool.execute(validation.value, ctx);
  return { ok: true, result };
}

/**
 * Preview a tool safely (same validation contract as `executeToolSafely`).
 * If the tool has no `preview`, returns a minimal default.
 */
export async function previewToolSafely(
  tool: NLOpsTool,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: true; preview: unknown } | { ok: false; error: ToolInputError }> {
  const validation = validateToolInput(tool, input);
  if (!validation.ok) return { ok: false, error: validation.error };
  if (!tool.preview) {
    return { ok: true, preview: { tool: tool.name, input: validation.value } };
  }
  const preview = await tool.preview(validation.value, ctx);
  return { ok: true, preview };
}
