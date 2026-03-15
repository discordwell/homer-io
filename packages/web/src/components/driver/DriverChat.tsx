import { useEffect, useRef, useState } from 'react';
import { useMessagesStore } from '../../stores/messages.js';
import { useDriverStore } from '../../stores/driver.js';
import { useAuthStore } from '../../stores/auth.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { C, F } from '../../theme.js';

interface DriverChatProps {
  onClose: () => void;
}

export function DriverChat({ onClose }: DriverChatProps) {
  const { messages, loading, fetchMessages, sendMessage } = useMessagesStore();
  const currentRoute = useDriverStore((s) => s.currentRoute);
  const userId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const routeId = currentRoute?.id;

  useEffect(() => {
    if (routeId) {
      fetchMessages(routeId);
    }
  }, [routeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !routeId) return;
    setSending(true);
    try {
      await sendMessage({ routeId, body: text.trim() });
      setText('');
    } finally {
      setSending(false);
    }
  }

  if (!routeId) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h3 style={{ fontFamily: F.display, fontSize: 15, margin: 0, color: C.text }}>Chat</h3>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontSize: 13, padding: 16 }}>
          No active route to chat on.
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ fontFamily: F.display, fontSize: 15, margin: 0, color: C.text }}>
          Chat - {currentRoute?.name || 'Route'}
        </h3>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {/* Messages */}
      <div style={messagesContainerStyle}>
        {loading && messages.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}><LoadingSpinner /></div>
        ) : messages.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.dim, fontSize: 13 }}>
            No messages yet. Send one to your dispatcher.
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === userId;
            return (
              <div key={msg.id} style={{
                display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                marginBottom: 8,
              }}>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 10,
                  background: isMine ? C.accent : C.bg3,
                  color: isMine ? '#fff' : C.text,
                }}>
                  {!isMine && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 2 }}>
                      {msg.senderName || 'Dispatch'}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.body}</div>
                  <div style={{
                    fontSize: 10, marginTop: 4, textAlign: 'right',
                    color: isMine ? 'rgba(255,255,255,0.5)' : C.dim,
                  }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={inputBarStyle}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message dispatcher..."
          style={inputStyle}
        />
        <button type="submit" disabled={!text.trim() || sending} style={{
          ...sendBtnStyle,
          opacity: !text.trim() || sending ? 0.5 : 1,
        }}>
          Send
        </button>
      </form>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0,
  height: '70vh', maxHeight: 500,
  display: 'flex', flexDirection: 'column',
  background: C.bg2, borderTop: `2px solid ${C.accent}`,
  borderRadius: '16px 16px 0 0',
  zIndex: 100,
  boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.dim,
  fontSize: 22, cursor: 'pointer', lineHeight: 1,
};

const messagesContainerStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '12px 16px',
};

const inputBarStyle: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '10px 16px',
  borderTop: `1px solid ${C.border}`,
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '10px 14px', borderRadius: 10,
  background: C.bg3, border: `1px solid ${C.muted}`,
  color: C.text, fontSize: 14, fontFamily: F.body, outline: 'none',
};

const sendBtnStyle: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 10, background: C.accent,
  border: 'none', color: '#fff', cursor: 'pointer',
  fontFamily: F.body, fontWeight: 600, fontSize: 14,
};
