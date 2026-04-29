import { randomBytes, randomUUID, createHash } from 'crypto';
import { config } from '../../config.js';
import { cacheSet, cacheGetAndDelete } from '../cache.js';
import { logActivity } from '../activity.js';
import { getProvider, toProviderTools, type ProviderMessage, type ProviderContentBlock } from './providers.js';
import {
  getToolsForRole,
  getTool,
  summarizeResult,
  executeToolSafely,
  type ToolContext,
} from './tools/index.js';
import { saveMutationSnapshot } from './undo.js';
import type { SSEEvent } from '@homer-io/shared';

// Max size for serialized tool results to prevent context blowup (finding #8)
const MAX_TOOL_RESULT_SIZE = 8192;

export interface AgentParams {
  tenantId: string;
  userId: string;
  userRole: string;
  orgName: string;
  timezone: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Resume a confirmation — execute the pending action */
  confirm?: { actionId: string; confirmationToken: string };
  /** Client IP for audit logging on confirm (finding M1) */
  ipAddress?: string;
  /** Abort signal for client disconnect detection (finding #2) */
  signal?: AbortSignal;
}

export interface PendingAction {
  actionId: string;
  tenantId: string;  // (finding #1) bind to tenant
  userId: string;    // (finding #1) bind to user
  toolName: string;
  toolCallId: string;
  input: Record<string, unknown>;
  preview: unknown;
  /**
   * SHA-256 hex of the single-use confirmation token. The raw token is only
   * sent once (in the `confirmation` SSE event) and never persisted. Replay
   * protection for finding M1.
   */
  confirmationTokenHash: string;
  /**
   * Iteration count at the moment the agent paused for confirmation. On
   * resume we restore this counter so maxIterations spans the entire arc
   * (finding M2 — confirm-act-confirm loops can no longer bypass the valve).
   */
  iterationCount: number;
  /** Serialized messages up to the confirmation point, for resumption */
  messages: ProviderMessage[];
  assistantContent: ProviderContentBlock[];
}

// Redis-backed pending confirmations (finding #4 / #10 / M1)
// TTL reduced from 15 min → 2 min (finding M1). Pending mutations should not
// linger; users who wait longer should re-issue the request.
export const PENDING_KEY_PREFIX = 'nlops:pending:';
export const PENDING_TTL = 120; // 2 minutes

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function storePendingAction(action: PendingAction): Promise<void> {
  await cacheSet(`${PENDING_KEY_PREFIX}${action.actionId}`, action, PENDING_TTL);
}

/**
 * Atomically fetch + delete the pending action. Single-use by construction:
 * a second concurrent caller observes null and is rejected (finding M1).
 */
async function consumePendingAction(actionId: string): Promise<PendingAction | null> {
  return cacheGetAndDelete<PendingAction>(`${PENDING_KEY_PREFIX}${actionId}`);
}

function buildSystemPrompt(params: AgentParams): string {
  // (finding #7) Don't leak userId — use role only
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return `You are HOMER, the AI operations assistant for ${params.orgName}'s delivery fleet.

Today: ${today}, timezone: ${params.timezone}. The user's role is: ${params.userRole}.

You can query and operate the fleet through your tools. For questions, use query tools freely. For actions that change data, explain what you'll do and call the appropriate tool — the system will ask the user to confirm before executing.

Guidelines:
- Be concise and operational. This is a dispatch console, not a chatbot.
- When results are ambiguous (multiple matches), present the options and ask which one.
- IMPORTANT: Date filters use the start of the day (midnight UTC). To include all of today, set dateTo to TOMORROW (${tomorrow}). For "this week", use dateFrom 7 days ago and dateTo ${tomorrow}.
- Never fabricate data. If a tool returns no results, say so.
- You cannot access external systems directly — only HOMER's database through your tools.
- When a user mentions a driver or customer by name, use find_driver or search_orders to look them up before acting.
- For multi-step operations (like reassigning a route), gather all needed info with query tools first, then call the mutation tool.`;
}

/** Truncate serialized tool result to prevent LLM context blowup */
function truncateResult(json: string): string {
  if (json.length <= MAX_TOOL_RESULT_SIZE) return json;
  return json.slice(0, MAX_TOOL_RESULT_SIZE) + '...(truncated)';
}

/** Check if the client has disconnected */
function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

/**
 * Run the NLOps agent loop. Yields SSE events as the agent thinks, calls tools,
 * and generates responses. Pauses on mutations for user confirmation.
 */
export async function* runAgentLoop(params: AgentParams): AsyncGenerator<SSEEvent> {
  const provider = getProvider();
  const tools = getToolsForRole(params.userRole);
  const providerTools = toProviderTools(tools);
  const systemPrompt = buildSystemPrompt(params);
  const toolCtx: ToolContext = {
    tenantId: params.tenantId,
    userId: params.userId,
    userRole: params.userRole,
  };

  const maxIterations = config.nlops.maxLoopIterations;
  let iterations = 0;
  let messages: ProviderMessage[];

  // --- Handle confirmation resume ---
  if (params.confirm) {
    const { actionId, confirmationToken } = params.confirm;

    // (finding M1) Token is required. Schema already enforces this, but
    // double-check defensively — helpful error for legacy clients that
    // might bypass the shared schema.
    if (!confirmationToken || typeof confirmationToken !== 'string') {
      yield {
        type: 'error',
        message: 'Missing confirmationToken. The client must echo the token received in the confirmation event.',
        code: 'CONFIRMATION_TOKEN_REQUIRED',
      };
      yield { type: 'done' };
      return;
    }

    // (finding M1) Atomically fetch and delete — prevents concurrent replay.
    // If two requests arrive simultaneously, only the first gets the
    // snapshot; the second sees null and is rejected below.
    const pending = await consumePendingAction(actionId);
    if (!pending) {
      yield {
        type: 'error',
        message: 'Confirmation expired, already used, or not found. Please try the action again.',
        code: 'CONFIRMATION_EXPIRED',
      };
      yield { type: 'done' };
      return;
    }

    // (finding #1) Verify tenant and user match
    if (pending.tenantId !== params.tenantId || pending.userId !== params.userId) {
      yield { type: 'error', message: 'Permission denied. This action belongs to a different user.' };
      yield { type: 'done' };
      return;
    }

    // (finding M1) Verify confirmation token. The raw token is only
    // transmitted in the one-time SSE event; we store the SHA-256 hash.
    // Attacker replaying only `{ actionId, confirm: true }` cannot fabricate
    // a matching token.
    const providedHash = hashToken(confirmationToken);
    if (providedHash !== pending.confirmationTokenHash) {
      yield {
        type: 'error',
        message: 'Invalid confirmation token. This action has been invalidated for security reasons.',
        code: 'CONFIRMATION_TOKEN_MISMATCH',
      };
      yield { type: 'done' };
      return;
    }

    // Execute the confirmed tool
    const tool = getTool(pending.toolName);
    if (!tool) {
      yield { type: 'error', message: `Tool "${pending.toolName}" not found` };
      yield { type: 'done' };
      return;
    }

    // (finding M1) Audit: record every successful confirmation.
    try {
      await logActivity({
        tenantId: params.tenantId,
        userId: params.userId,
        action: 'ai_mutation_confirmed',
        entityType: 'ai',
        entityId: pending.actionId,
        metadata: {
          toolName: pending.toolName,
          ipAddress: params.ipAddress ?? null,
        },
      });
    } catch {
      // Non-fatal: audit log failure shouldn't block the tool execution.
    }

    yield { type: 'tool_start', toolCallId: pending.toolCallId, name: pending.toolName, input: pending.input };
    const start = Date.now();
    let executionSucceeded = false;
    let executionResult: unknown = null;
    try {
      // Run through the validation wrapper even on resume — the pending action was stored
      // from the original (pre-validation) LLM payload. Reject malformed / oversized payloads
      // with a structured error instead of throwing.
      const safe = await executeToolSafely(tool, pending.input, toolCtx);
      if (!safe.ok) {
        const duration = Date.now() - start;
        yield {
          type: 'tool_result',
          toolCallId: pending.toolCallId,
          name: pending.toolName,
          summary: `Invalid input: ${safe.error.message}`,
          durationMs: duration,
        };
        yield { type: 'action_result', actionId: pending.actionId, success: false, summary: safe.error.message };
        yield { type: 'done' };
        return;
      }
      executionResult = safe.result;
      const duration = Date.now() - start;
      const resultSummary = summarizeResult(pending.toolName, executionResult);
      yield { type: 'tool_result', toolCallId: pending.toolCallId, name: pending.toolName, summary: resultSummary, durationMs: duration };
      yield { type: 'action_result', actionId: pending.actionId, success: true, summary: resultSummary };
      executionSucceeded = true;

      // Save undo snapshot for undoable mutations
      if (tool.undoable && pending.preview) {
        try {
          const snapshot = await saveMutationSnapshot({
            tenantId: params.tenantId,
            userId: params.userId,
            toolName: pending.toolName,
            toolInput: pending.input,
            beforeState: pending.preview,
            summary: resultSummary,
          });
          yield { type: 'undoable', snapshotId: snapshot.snapshotId, toolName: pending.toolName, summary: resultSummary } as SSEEvent;
        } catch {
          // Non-fatal: undo snapshot save failure shouldn't break the flow
        }
      }
    } catch (err) {
      yield { type: 'action_result', actionId: pending.actionId, success: false, summary: err instanceof Error ? err.message : 'Unknown error' };
      yield { type: 'done' };
      return;
    }

    if (!executionSucceeded) {
      yield { type: 'done' };
      return;
    }

    // (finding #2) Check for client disconnect before continuing.
    if (isAborted(params.signal)) return;

    // (finding M2) Restore iteration counter from the pause point so the
    // maxIterations safety valve spans the full conversational arc, not
    // just the post-resume segment. A misbehaving model cannot drive an
    // unbounded confirm-act-confirm chain anymore.
    iterations = pending.iterationCount;

    // Seed the conversation with the full pre-confirmation history plus
    // the tool_result so the loop continues naturally and can trigger more
    // confirmations (each of which will again persist the counter).
    messages = [
      ...pending.messages,
      { role: 'assistant', content: pending.assistantContent },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: pending.toolCallId, content: truncateResult(JSON.stringify(executionResult)) }] },
    ];
  } else {
    // --- Normal conversation flow ---

    // Build messages from history
    messages = params.history.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    messages.push({ role: 'user', content: params.message });
  }

  while (iterations < maxIterations) {
    iterations++;

    // (finding #2) Check for client disconnect before each LLM call
    if (isAborted(params.signal)) {
      yield { type: 'error', message: 'Client disconnected' };
      yield { type: 'done' };
      return;
    }

    let response;
    try {
      response = await provider.createMessage({
        system: systemPrompt,
        messages,
        tools: providerTools,
        maxTokens: config.nlops.maxTokens,
      });
    } catch (err) {
      yield { type: 'error', message: `AI provider error: ${err instanceof Error ? err.message : 'Unknown'}` };
      yield { type: 'done' };
      return;
    }

    // Process response blocks
    if (response.stopReason === 'end_turn') {
      // Agent is done — emit text blocks as messages
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          yield { type: 'message', content: block.text };
        }
      }
      yield { type: 'done' };
      return;
    }

    if (response.stopReason === 'tool_use') {
      // Extract text thinking and tool calls
      const textBlocks = response.content.filter((b) => b.type === 'text' && b.text.trim());
      const toolCalls = response.content.filter((b) => b.type === 'tool_use');

      // Emit any thinking text
      for (const block of textBlocks) {
        if (block.type === 'text') {
          yield { type: 'thinking', content: block.text };
        }
      }

      // (finding #12) Process read-only tools first, then pause on first mutation
      const toolResults: ProviderContentBlock[] = [];
      let pendingMutation: { call: ProviderContentBlock & { type: 'tool_use' }; tool: ReturnType<typeof getTool> } | null = null;

      for (const call of toolCalls) {
        if (call.type !== 'tool_use') continue;

        const tool = getTool(call.name);
        if (!tool) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
            is_error: true,
          });
          continue;
        }

        // Check RBAC
        const roleRank: Record<string, number> = { owner: 4, admin: 3, dispatcher: 2, driver: 1 };
        if ((roleRank[params.userRole] ?? 0) < (roleRank[tool.requiredRole] ?? 0)) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify({ error: `Permission denied. Requires ${tool.requiredRole} role.` }),
            is_error: true,
          });
          continue;
        }

        // Mutation tools: defer to after all reads (finding #12)
        if (tool.riskLevel !== 'read') {
          if (!pendingMutation) {
            pendingMutation = { call: call as ProviderContentBlock & { type: 'tool_use' }, tool };
          }
          // Additional mutations after the first are silently skipped — model will retry
          continue;
        }

        // Read-only tool — execute immediately
        if (isAborted(params.signal)) return;
        yield { type: 'tool_start', toolCallId: call.id, name: call.name, input: call.input };
        const start = Date.now();

        try {
          const result = await tool.execute(call.input, toolCtx);
          const duration = Date.now() - start;
          yield { type: 'tool_result', toolCallId: call.id, name: call.name, summary: summarizeResult(call.name, result), durationMs: duration };
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: truncateResult(JSON.stringify(result)),
          });
        } catch (err) {
          const duration = Date.now() - start;
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          yield { type: 'tool_result', toolCallId: call.id, name: call.name, summary: `Error: ${errMsg}`, durationMs: duration };
          toolResults.push({
            type: 'tool_result',
            tool_use_id: call.id,
            content: JSON.stringify({ error: errMsg }),
            is_error: true,
          });
        }
      }

      // Now handle the pending mutation (if any) — after all reads are done
      if (pendingMutation) {
        const { call, tool } = pendingMutation;
        const actionId = randomUUID();
        // (finding M1) 32-byte single-use confirmation token. Raw token is
        // transmitted once (in the SSE event) and never persisted. We store
        // only the SHA-256 hash so a leaked snapshot/cache dump can't be
        // turned into a replayable confirm body.
        const confirmationToken = randomBytes(32).toString('hex');
        let preview: unknown = null;
        try {
          preview = tool!.preview ? await tool!.preview(call.input, toolCtx) : { tool: call.name, input: call.input };
        } catch (err) {
          preview = { tool: call.name, input: call.input, previewError: err instanceof Error ? err.message : 'Unknown' };
        }

        // (finding #1) Store tenant and user with pending action
        // (finding M2) Persist the iteration counter so resume continues it
        await storePendingAction({
          actionId,
          tenantId: params.tenantId,
          userId: params.userId,
          toolName: call.name,
          toolCallId: call.id,
          input: call.input,
          preview,
          confirmationTokenHash: hashToken(confirmationToken),
          iterationCount: iterations,
          messages: [...messages],
          assistantContent: response.content,
        });

        const explanation = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n').trim()
          || `I'd like to execute: ${call.name}`;

        yield {
          type: 'confirmation',
          actionId,
          confirmationToken,
          toolName: call.name,
          toolInput: call.input,
          explanation,
          preview,
        };
        yield { type: 'done' };
        return;
      }

      // Append assistant response + tool results to conversation and continue loop
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  // Max iterations reached
  yield { type: 'error', message: 'Reached maximum reasoning steps. Please try a simpler request.' };
  yield { type: 'done' };
}
