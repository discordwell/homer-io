import { z } from 'zod';

// --- Tool Risk Levels ---
export const toolRiskLevel = z.enum(['read', 'mutate', 'destructive']);
export type ToolRiskLevel = z.infer<typeof toolRiskLevel>;

// --- Roles ---
export const nlopsRole = z.enum(['owner', 'admin', 'dispatcher', 'driver']);
export type NLOpsRole = z.infer<typeof nlopsRole>;

// --- SSE Event Types ---
export const sseEventType = z.enum([
  'thinking',      // Agent reasoning text
  'tool_start',    // Tool call initiated
  'tool_result',   // Tool call completed
  'message',       // Final text response
  'confirmation',  // Mutation needs user approval
  'action_result', // Confirmed action executed
  'undoable',      // Undo snapshot available for this action
  'error',         // Something went wrong
  'done',          // Stream complete
]);
export type SSEEventType = z.infer<typeof sseEventType>;

// --- SSE Event Payloads ---
export const sseThinkingEvent = z.object({
  type: z.literal('thinking'),
  content: z.string(),
});

export const sseToolStartEvent = z.object({
  type: z.literal('tool_start'),
  toolCallId: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export const sseToolResultEvent = z.object({
  type: z.literal('tool_result'),
  toolCallId: z.string(),
  name: z.string(),
  summary: z.string(),
  durationMs: z.number(),
});

export const sseMessageEvent = z.object({
  type: z.literal('message'),
  content: z.string(),
});

export const sseConfirmationEvent = z.object({
  type: z.literal('confirmation'),
  actionId: z.string(),
  /**
   * Single-use confirmation token (32-byte hex). The client MUST echo this
   * back in the confirm request or the server will reject with 400. Protects
   * against replay of a leaked `{ actionId, confirm: true }` body.
   */
  confirmationToken: z.string(),
  toolName: z.string(),
  toolInput: z.record(z.unknown()),
  explanation: z.string(),
  preview: z.unknown(), // Structured preview data varies by tool
});

export const sseActionResultEvent = z.object({
  type: z.literal('action_result'),
  actionId: z.string(),
  success: z.boolean(),
  summary: z.string(),
});

export const sseErrorEvent = z.object({
  type: z.literal('error'),
  message: z.string(),
  /** Optional error code for structured handling (e.g. 'AI_NOT_CONFIGURED') */
  code: z.string().optional(),
});

export const sseUndoableEvent = z.object({
  type: z.literal('undoable'),
  snapshotId: z.string(),
  toolName: z.string(),
  summary: z.string(),
});

export const sseDoneEvent = z.object({
  type: z.literal('done'),
});

export const sseEvent = z.discriminatedUnion('type', [
  sseThinkingEvent,
  sseToolStartEvent,
  sseToolResultEvent,
  sseMessageEvent,
  sseConfirmationEvent,
  sseActionResultEvent,
  sseUndoableEvent,
  sseErrorEvent,
  sseDoneEvent,
]);
export type SSEEvent = z.infer<typeof sseEvent>;

// --- NLOps Request ---
export const nlopsRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000),
  })).max(50).default([]),
  confirm: z.object({
    actionId: z.string(),
    /**
     * Single-use confirmation token received in the `confirmation` SSE event.
     * Required for resume. Missing token => 400 (legacy-client migration error).
     */
    confirmationToken: z.string(),
  }).optional(),
});
export type NLOpsRequest = z.infer<typeof nlopsRequestSchema>;

// --- Structured Chat Message (frontend) ---
export const chatMessageType = z.enum([
  'text',           // Plain text message
  'tool_activity',  // Tool call indicator
  'confirmation',   // Confirmation card
  'action_result',  // Execution result
]);
export type ChatMessageType = z.infer<typeof chatMessageType>;

// --- Provider Config ---
export const nlopsProviderEnum = z.enum(['anthropic', 'openai']);
export type NLOpsProvider = z.infer<typeof nlopsProviderEnum>;

// --- Voice ---
export const transcribeResponseSchema = z.object({
  text: z.string(),
});
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
});
export type TTSRequest = z.infer<typeof ttsRequestSchema>;
