import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../stores/chat.js';
import { C, F } from '../theme.js';

export function AIChatPanel() {
  const { messages, loading, isOpen, sendMessage, toggle } = useChatStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    await sendMessage(msg);
  }

  return (
    <>
      {/* Toggle button */}
      <button onClick={toggle} style={{
        position: 'fixed', bottom: 24, right: 24, width: 48, height: 48,
        borderRadius: '50%', background: C.accent, border: 'none',
        color: '#fff', fontSize: 20, cursor: 'pointer', zIndex: 999,
        boxShadow: C.accentGlow, display: isOpen ? 'none' : 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        💬
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          width: 360, background: C.bg2, borderLeft: `1px solid ${C.muted}`,
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${C.muted}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600 }}>HOMER AI</div>
              <div style={{ fontSize: 11, color: C.dim }}>Fleet assistant</div>
            </div>
            <button onClick={toggle} style={{
              background: 'none', border: 'none', color: C.dim, cursor: 'pointer',
              fontSize: 18, padding: 4,
            }}>&times;</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: C.dim, fontSize: 13 }}>
                <p>Ask me about your fleet, routes, or orders.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? C.accent : C.bg3,
                color: msg.role === 'user' ? '#fff' : C.text,
                padding: '10px 14px', borderRadius: 12, fontSize: 14,
                maxWidth: '85%', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', padding: '10px 14px', borderRadius: 12,
                background: C.bg3, color: C.dim, fontSize: 14,
              }}>
                Thinking...
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
              placeholder="Ask HOMER..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 8,
                background: C.bg, border: `1px solid ${C.muted}`,
                color: C.text, fontSize: 14, outline: 'none', fontFamily: F.body,
              }}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} style={{
              padding: '10px 16px', borderRadius: 8, background: C.accent,
              border: 'none', color: '#fff', cursor: 'pointer', fontFamily: F.body,
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
