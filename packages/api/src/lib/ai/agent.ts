import { randomUUID } from 'crypto';
import { config } from '../../config.js';
import { getProvider, toProviderTools, type ProviderMessage, type ProviderContentBlock } from './providers.js';
import { getToolsForRole, getTool, summarizeResult, type ToolContext } from './tools/index.js';
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
  confirm?: { actionId: string };
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
  /** Serialized messages up to the confirmation point, for resumption */
  messages: ProviderMessage[];
  assistantContent: ProviderContentBlock[];
}

// In-memory store for pending confirmations (keyed by actionId)
// TODO: Move to Redis for multi-instance deployments (finding #4)
const pendingActions = new Map<string, PendingAction>();

// Auto-expire pending actions after 5 minutes
function storePendingAction(action: PendingAction) {
  pendingActions.set(action.actionId, action);
  setTimeout(() => pendingActions.delete(action.actionId), 5 * 60 * 1000);
}

function buildSystemPrompt(params: AgentParams): string {
  // (finding #7) Don't leak userId — use role only
  return `You are HOMER, the AI operations assistant for ${params.orgName}'s delivery fleet.

Today: ${new Date().toISOString().slice(0, 10)}, timezone: ${params.timezone}. The user's role is: ${params.userRole}.

You can query and operate the fleet through your tools. For questions, use query tools freely. For actions that change data, explain what you'll do and call the appropriate tool — the system will ask the user to confirm before executing.

Guidelines:
- Be concise and operational. This is a dispatch console, not a chatbot.
- When results are ambiguous (multiple matches), present the options and ask which one.
- For "today's" queries, use today's date. For "this week", use the last 7 days.
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

  // --- Handle confirmation resume ---
  if (params.confirm) {
    const pending = pendingActions.get(params.confirm.actionId);
    if (!pending) {
      yield { type: 'error', message: 'Confirmation expired or not found. Please try the action again.' };
      yield { type: 'done' };
      return;
    }

    // (finding #1) Verify tenant and user match
    if (pending.tenantId !== params.tenantId || pending.userId !== params.userId) {
      yield { type: 'error', message: 'Permission denied. This action belongs to a different user.' };
      yield { type: 'done' };
      return;
    }

    pendingActions.delete(pending.actionId);

    // Execute the confirmed tool
    const tool = getTool(pending.toolName);
    if (!tool) {
      yield { type: 'error', message: `Tool "${pending.toolName}" not found` };
      yield { type: 'done' };
      return;
    }

    yield { type: 'tool_start', toolCallId: pending.toolCallId, name: pending.toolName, input: pending.input };
    const start = Date.now();
    try {
      const result = await tool.execute(pending.input, toolCtx);
      const duration = Date.now() - start;
      yield { type: 'tool_result', toolCallId: pending.toolCallId, name: pending.toolName, summary: summarizeResult(pending.toolName, result), durationMs: duration };
      yield { type: 'action_result', actionId: pending.actionId, success: true, summary: summarizeResult(pending.toolName, result) };

      // (finding #2) Check for client disconnect before making another LLM call
      if (isAborted(params.signal)) return;

      // Continue the conversation with tool result so the model can summarize
      const resumeMessages: ProviderMessage[] = [
        ...pending.messages,
        { role: 'assistant', content: pending.assistantContent },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: pending.toolCallId, content: truncateResult(JSON.stringify(result)) }] },
      ];

      const response = await provider.createMessage({
        system: systemPrompt,
        messages: resumeMessages,
        tools: providerTools,
        maxTokens: config.nlops.maxTokens,
      });

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          yield { type: 'message', content: block.text };
        }
      }
    } catch (err) {
      yield { type: 'action_result', actionId: pending.actionId, success: false, summary: err instanceof Error ? err.message : 'Unknown error' };
    }
    yield { type: 'done' };
    return;
  }

  // --- Normal conversation flow ---

  // Build messages from history
  const messages: ProviderMessage[] = params.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: 'user', content: params.message });

  let iterations = 0;
  const maxIterations = config.nlops.maxLoopIterations;

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
        let preview: unknown = null;
        try {
          preview = tool!.preview ? await tool!.preview(call.input, toolCtx) : { tool: call.name, input: call.input };
        } catch (err) {
          preview = { tool: call.name, input: call.input, previewError: err instanceof Error ? err.message : 'Unknown' };
        }

        // (finding #1) Store tenant and user with pending action
        storePendingAction({
          actionId,
          tenantId: params.tenantId,
          userId: params.userId,
          toolName: call.name,
          toolCallId: call.id,
          input: call.input,
          preview,
          messages: [...messages],
          assistantContent: response.content,
        });

        const explanation = textBlocks.map((b) => b.type === 'text' ? b.text : '').join('\n').trim()
          || `I'd like to execute: ${call.name}`;

        yield {
          type: 'confirmation',
          actionId,
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
