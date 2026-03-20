import { create } from 'zustand';
import { getTokens } from '@/api/client';
import { API_BASE } from '@/constants';
import type { SSEEvent } from '@homer-io/shared';

export interface NLOpsToolActivity {
  toolCallId: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  summary?: string;
  durationMs?: number;
}

export interface NLOpsConfirmation {
  actionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  explanation: string;
  preview: unknown;
}

export interface NLOpsMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  toolActivities?: NLOpsToolActivity[];
  confirmation?: NLOpsConfirmation;
  actionResult?: { actionId: string; success: boolean; summary: string };
  errorCode?: string;
  timestamp: number;
}

interface NLOpsState {
  messages: NLOpsMessage[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  loading: boolean;
  abortController: AbortController | null;

  send: (message: string) => Promise<void>;
  confirm: (actionId: string) => Promise<void>;
  deny: (actionId: string) => void;
  clear: () => void;
}

let msgCounter = 0;
function nextId() { return `nlops-${++msgCounter}-${Date.now()}`; }

export const useNLOpsStore = create<NLOpsState>()((set, get) => ({
  messages: [],
  history: [],
  loading: false,
  abortController: null,

  send: async (message: string) => {
    get().abortController?.abort();
    const controller = new AbortController();
    const userMsg: NLOpsMessage = { id: nextId(), role: 'user', content: message, timestamp: Date.now() };
    set((s) => ({
      messages: [...s.messages, userMsg],
      loading: true,
      abortController: controller,
    }));
    await streamOps(get, set, { message, history: get().history }, controller.signal);
  },

  confirm: async (actionId: string) => {
    get().abortController?.abort();
    const controller = new AbortController();
    set({ loading: true, abortController: controller });
    set((s) => ({
      messages: s.messages.map((m) =>
        m.confirmation?.actionId === actionId
          ? { ...m, confirmation: undefined, content: `Confirmed: ${m.confirmation?.toolName}` }
          : m,
      ),
    }));
    await streamOps(get, set, { message: '', history: get().history, confirm: { actionId } }, controller.signal);
  },

  deny: (actionId: string) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.confirmation?.actionId === actionId
          ? { ...m, confirmation: undefined, content: 'Cancelled.' }
          : m,
      ),
    }));
  },

  clear: () => {
    get().abortController?.abort();
    set({ messages: [], history: [], abortController: null });
  },
}));

// --- SSE streaming ---

async function streamOps(
  get: () => NLOpsState,
  set: (partial: Partial<NLOpsState> | ((s: NLOpsState) => Partial<NLOpsState>)) => void,
  body: { message: string; history: Array<{ role: 'user' | 'assistant'; content: string }>; confirm?: { actionId: string } },
  signal?: AbortSignal,
) {
  const { accessToken } = await getTokens();

  const assistantMsgId = nextId();
  const assistantMsg: NLOpsMessage = {
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    toolActivities: [],
    timestamp: Date.now(),
  };
  set((s) => ({ messages: [...s.messages, assistantMsg] }));

  try {
    const res = await fetch(`${API_BASE}/ai/ops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => 'Request failed');
      updateAssistant(set, assistantMsgId, { content: `Error: ${err}` });
      if (!signal?.aborted) set({ loading: false });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as SSEEvent;
            handleSSEEvent(set, assistantMsgId, event);
          } catch {
            // Malformed JSON — skip
          }
        }
      }
    }

    // Update history
    const finalMsg = get().messages.find((m) => m.id === assistantMsgId);
    if (finalMsg?.content && !body.confirm) {
      set((s) => ({
        history: [
          ...s.history,
          { role: 'user' as const, content: body.message },
          { role: 'assistant' as const, content: finalMsg.content || '' },
        ].slice(-20),
      }));
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    updateAssistant(set, assistantMsgId, {
      content: `Connection error: ${err instanceof Error ? err.message : 'Unknown'}`,
    });
  }

  if (!signal?.aborted) set({ loading: false });
}

function handleSSEEvent(
  set: (partial: Partial<NLOpsState> | ((s: NLOpsState) => Partial<NLOpsState>)) => void,
  msgId: string,
  event: SSEEvent,
) {
  switch (event.type) {
    case 'thinking':
      updateAssistant(set, msgId, (msg) => ({
        content: (msg.content || '') + (msg.content ? '\n' : '') + event.content,
      }));
      break;
    case 'tool_start':
      updateAssistant(set, msgId, (msg) => ({
        toolActivities: [
          ...(msg.toolActivities || []),
          { toolCallId: event.toolCallId, name: event.name, input: event.input, status: 'running' as const },
        ],
      }));
      break;
    case 'tool_result':
      updateAssistant(set, msgId, (msg) => ({
        toolActivities: (msg.toolActivities || []).map((ta) =>
          ta.toolCallId === event.toolCallId
            ? { ...ta, status: 'done' as const, summary: event.summary, durationMs: event.durationMs }
            : ta,
        ),
      }));
      break;
    case 'message':
      updateAssistant(set, msgId, { content: event.content });
      break;
    case 'confirmation':
      set((s) => ({
        messages: [...s.messages, {
          id: nextId(),
          role: 'system' as const,
          confirmation: {
            actionId: event.actionId,
            toolName: event.toolName,
            toolInput: event.toolInput,
            explanation: event.explanation,
            preview: event.preview,
          },
          timestamp: Date.now(),
        }],
      }));
      break;
    case 'action_result':
      set((s) => ({
        messages: [...s.messages, {
          id: nextId(),
          role: 'system' as const,
          actionResult: { actionId: event.actionId, success: event.success, summary: event.summary },
          timestamp: Date.now(),
        }],
      }));
      break;
    case 'error':
      updateAssistant(set, msgId, (msg) => ({
        content: (msg.content ? msg.content + '\n' : '') + `Error: ${event.message}`,
        errorCode: event.code,
      }));
      break;
    case 'done':
      break;
  }
}

function updateAssistant(
  set: (fn: (s: NLOpsState) => Partial<NLOpsState>) => void,
  msgId: string,
  update: Partial<NLOpsMessage> | ((msg: NLOpsMessage) => Partial<NLOpsMessage>),
) {
  set((s) => ({
    messages: s.messages.map((m) => {
      if (m.id !== msgId) return m;
      const patch = typeof update === 'function' ? update(m) : update;
      return { ...m, ...patch };
    }),
  }));
}
