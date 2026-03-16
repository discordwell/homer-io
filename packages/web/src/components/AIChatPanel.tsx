import { useState, useRef, useEffect } from 'react';
import { useNLOpsStore, type NLOpsMessage, type NLOpsToolActivity, type NLOpsConfirmation } from '../stores/nlops.js';
import { C, F } from '../theme.js';

// --- Tool name → friendly label ---
const TOOL_LABELS: Record<string, string> = {
  get_operational_summary: 'Checking fleet status',
  search_orders: 'Searching orders',
  get_order_details: 'Looking up order',
  get_route_details: 'Loading route details',
  list_routes: 'Listing routes',
  find_driver: 'Finding driver',
  get_available_drivers: 'Checking available drivers',
  get_driver_performance: 'Loading driver metrics',
  get_analytics: 'Pulling analytics',
  assign_order_to_route: 'Assigning orders',
  update_order_status: 'Updating order status',
  change_driver_status: 'Changing driver status',
  create_route: 'Creating route',
  reassign_orders: 'Reassigning orders',
  optimize_route: 'Optimizing route',
  auto_dispatch: 'Running auto-dispatch',
  cancel_route: 'Cancelling route',
  transition_route_status: 'Updating route status',
  send_customer_notification: 'Sending notification',
  get_address_intelligence: 'Looking up address history',
  get_intelligence_insights: 'Analyzing delivery intelligence',
  get_route_risk: 'Assessing delivery risks',
};

export function AIChatPanel() {
  const { messages, loading, isOpen, showThought, send, confirm, deny, toggle, toggleThought } = useNLOpsStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    await send(msg);
  }

  // --- Thought Overlay (full-screen) ---
  const thoughtOverlay = showThought && (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(3,8,15,0.95)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '16px 24px', borderBottom: `1px solid ${C.muted}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, color: C.text }}>
          HOMER — Agent Thought Process
        </div>
        <button onClick={toggleThought} style={{
          background: C.bg3, border: `1px solid ${C.muted}`, color: C.text,
          padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: F.body, fontSize: 13,
        }}>
          Close
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {messages.filter((m) => m.role === 'assistant' || m.role === 'system').map((msg) => (
          <ThoughtEntry key={msg.id} msg={msg} />
        ))}
        {loading && (
          <div style={{ color: C.dim, fontFamily: F.mono, fontSize: 13, marginTop: 12 }}>
            <Spinner /> Processing...
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {thoughtOverlay}

      {/* Toggle button */}
      <button onClick={toggle} style={{
        position: 'fixed', bottom: 24, right: 24, width: 48, height: 48,
        borderRadius: '50%', background: C.accent, border: 'none',
        color: '#fff', fontSize: 16, cursor: 'pointer', zIndex: 999,
        boxShadow: C.accentGlow, display: isOpen ? 'none' : 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: F.display, fontWeight: 700, letterSpacing: 1,
      }}>
        H
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          width: 400, background: C.bg2, borderLeft: `1px solid ${C.muted}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: `1px solid ${C.muted}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.text }}>HOMER</div>
              <div style={{ fontSize: 11, color: C.dim }}>Operations Assistant</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={toggleThought} title="Toggle thought process" style={{
                background: showThought ? C.accent : 'none', border: `1px solid ${showThought ? C.accent : C.muted}`,
                color: showThought ? '#fff' : C.dim, cursor: 'pointer',
                padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: F.mono,
              }}>
                {'{ }'}
              </button>
              <button onClick={toggle} style={{
                background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
                fontSize: 18, padding: 4,
              }}>&times;</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: C.dim, fontSize: 13 }}>
                <p style={{ fontFamily: F.display, fontSize: 15, color: C.text, marginBottom: 8 }}>
                  What do you need?
                </p>
                <p>"Dispatch today's orders"</p>
                <p>"Marcus called in sick, reassign his route"</p>
                <p>"How's the fleet doing this week?"</p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onConfirm={confirm} onDeny={deny} />
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 10,
                background: C.bg3, color: C.dim, fontSize: 13,
              }}>
                <Spinner /> Working...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: 12, borderTop: `1px solid ${C.muted}`,
            display: 'flex', gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Tell HOMER what to do..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: C.bg, border: `1px solid ${C.muted}`,
                color: C.text, fontSize: 14, outline: 'none', fontFamily: F.body,
              }}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} style={{
              padding: '10px 16px', borderRadius: 8, background: C.accent,
              border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body,
              opacity: loading || !input.trim() ? 0.5 : 1, fontSize: 14,
            }}>
              Go
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// --- Sub-components ---

function MessageBubble({ msg, onConfirm, onDeny }: {
  msg: NLOpsMessage;
  onConfirm: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  // User message
  if (msg.role === 'user') {
    return (
      <div style={{
        alignSelf: 'flex-end', background: C.accent, color: '#fff',
        padding: '10px 14px', borderRadius: 12, fontSize: 14,
        maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    );
  }

  // Confirmation card
  if (msg.confirmation) {
    return <ConfirmationCard conf={msg.confirmation} onConfirm={onConfirm} onDeny={onDeny} />;
  }

  // Action result
  if (msg.actionResult) {
    const ar = msg.actionResult;
    return (
      <div style={{
        padding: '10px 14px', borderRadius: 10,
        background: ar.success ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
        border: `1px solid ${ar.success ? C.green : C.red}`,
        fontSize: 13, color: C.text,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: ar.success ? C.green : C.red }}>
          {ar.success ? 'Done' : 'Failed'}
        </div>
        {ar.summary}
      </div>
    );
  }

  // Assistant message
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '92%' }}>
      {/* Tool activity indicators */}
      {msg.toolActivities && msg.toolActivities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {msg.toolActivities.map((ta) => (
            <ToolActivityBadge key={ta.toolCallId} activity={ta} />
          ))}
        </div>
      )}
      {/* Text content */}
      {msg.content && (
        <div style={{
          background: C.bg3, color: C.text,
          padding: '10px 14px', borderRadius: 10, fontSize: 14,
          lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </div>
      )}
    </div>
  );
}

function ToolActivityBadge({ activity }: { activity: NLOpsToolActivity }) {
  const label = TOOL_LABELS[activity.name] || activity.name;
  const isRunning = activity.status === 'running';

  return (
    <div style={{
      fontSize: 12, color: C.dim, padding: '4px 10px',
      borderRadius: 6, background: C.bg,
      border: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: F.mono,
    }}>
      {isRunning ? <Spinner /> : <span style={{ color: C.green }}>&#10003;</span>}
      {label}
      {activity.durationMs !== undefined && (
        <span style={{ marginLeft: 'auto', color: C.muted }}>
          {activity.durationMs}ms
        </span>
      )}
    </div>
  );
}

function ConfirmationCard({ conf, onConfirm, onDeny }: {
  conf: NLOpsConfirmation;
  onConfirm: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const preview = conf.preview as Record<string, unknown> | null;
  const isDestructive = conf.toolName.includes('reassign') || conf.toolName.includes('cancel') || conf.toolName.includes('auto_dispatch');

  return (
    <div style={{
      background: C.bg3, borderRadius: 10, overflow: 'hidden',
      border: `1px solid ${isDestructive ? C.orange : C.accent}`,
    }}>
      <div style={{
        padding: '10px 14px',
        background: isDestructive ? 'rgba(251,146,60,0.08)' : 'rgba(91,164,245,0.08)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          fontFamily: F.display, fontSize: 13, fontWeight: 600,
          color: isDestructive ? C.orange : C.accent,
        }}>
          {isDestructive ? 'Confirm Action' : 'Confirm'}
        </div>
      </div>
      <div style={{ padding: '10px 14px', fontSize: 13, color: C.text, lineHeight: 1.5 }}>
        {conf.explanation}
      </div>
      {preview && (
        <div style={{
          padding: '8px 14px', fontSize: 12, color: C.dim,
          borderTop: `1px solid ${C.border}`,
          fontFamily: F.mono, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto',
        }}>
          {formatPreview(preview)}
        </div>
      )}
      <div style={{
        padding: '10px 14px', display: 'flex', gap: 8, justifyContent: 'flex-end',
        borderTop: `1px solid ${C.border}`,
      }}>
        <button onClick={() => onDeny(conf.actionId)} style={{
          padding: '6px 16px', borderRadius: 6,
          background: 'none', border: `1px solid ${C.muted}`,
          color: C.dim, cursor: 'pointer', fontSize: 13, fontFamily: F.body,
        }}>
          Cancel
        </button>
        <button onClick={() => onConfirm(conf.actionId)} style={{
          padding: '6px 16px', borderRadius: 6,
          background: isDestructive ? C.orange : C.accent,
          border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13,
          fontFamily: F.body, fontWeight: 600,
        }}>
          Confirm
        </button>
      </div>
    </div>
  );
}

function formatPreview(preview: Record<string, unknown>): string {
  // Render preview as readable key-value pairs
  const lines: string[] = [];
  for (const [key, val] of Object.entries(preview)) {
    if (key === 'action') continue; // Already shown in header
    if (val === null || val === undefined) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const [k2, v2] of Object.entries(val as Record<string, unknown>)) {
        lines.push(`  ${k2}: ${String(v2)}`);
      }
    } else if (Array.isArray(val)) {
      lines.push(`${key}: ${val.length} items`);
      for (const item of val.slice(0, 5)) {
        if (typeof item === 'object' && item !== null) {
          const label = (item as any).recipient || (item as any).name || (item as any).id || JSON.stringify(item);
          lines.push(`  - ${label}`);
        } else {
          lines.push(`  - ${String(item)}`);
        }
      }
      if (val.length > 5) lines.push(`  ... and ${val.length - 5} more`);
    } else {
      lines.push(`${key}: ${String(val)}`);
    }
  }
  return lines.join('\n');
}

function ThoughtEntry({ msg }: { msg: NLOpsMessage }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Tool activities */}
      {msg.toolActivities?.map((ta) => (
        <div key={ta.toolCallId} style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 6,
          background: C.bg3, border: `1px solid ${C.border}`,
          fontFamily: F.mono, fontSize: 13, color: C.text,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: ta.status === 'done' ? C.green : ta.status === 'error' ? C.red : C.yellow }}>
              {ta.status === 'done' ? '&#10003;' : ta.status === 'error' ? '&#10007;' : '&#9679;'}
            </span>
            <span style={{ fontWeight: 600 }}>{ta.name}</span>
            {ta.durationMs !== undefined && (
              <span style={{ color: C.dim, marginLeft: 'auto' }}>{ta.durationMs}ms</span>
            )}
          </div>
          {ta.summary && (
            <div style={{ color: C.dim, marginTop: 4, paddingLeft: 20 }}>{ta.summary}</div>
          )}
          <div style={{ color: C.muted, marginTop: 4, paddingLeft: 20, fontSize: 11 }}>
            {JSON.stringify(ta.input, null, 2).slice(0, 200)}
          </div>
        </div>
      ))}

      {/* Thinking / response text */}
      {msg.content && (
        <div style={{
          padding: '8px 12px', fontSize: 14, color: C.text,
          lineHeight: 1.6, whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </div>
      )}

      {/* Confirmation */}
      {msg.confirmation && (
        <div style={{
          padding: '8px 12px', borderRadius: 6,
          background: 'rgba(251,146,60,0.08)', border: `1px solid ${C.orange}`,
          fontSize: 13, color: C.orange, fontFamily: F.mono,
        }}>
          AWAITING CONFIRMATION: {msg.confirmation.toolName}
        </div>
      )}

      {/* Action result */}
      {msg.actionResult && (
        <div style={{
          padding: '8px 12px', borderRadius: 6,
          background: msg.actionResult.success ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
          border: `1px solid ${msg.actionResult.success ? C.green : C.red}`,
          fontSize: 13, color: msg.actionResult.success ? C.green : C.red,
          fontFamily: F.mono,
        }}>
          {msg.actionResult.success ? 'EXECUTED' : 'FAILED'}: {msg.actionResult.summary}
        </div>
      )}
    </div>
  );
}

// (finding #14) Inject @keyframes once at module level to avoid duplicate <style> tags
let spinStyleInjected = false;
function ensureSpinStyle() {
  if (spinStyleInjected) return;
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
  spinStyleInjected = true;
}

function Spinner() {
  ensureSpinStyle();
  return (
    <span style={{
      display: 'inline-block', width: 10, height: 10,
      border: `2px solid ${C.muted}`, borderTopColor: C.accent,
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}
