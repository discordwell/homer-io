import { useEffect, useRef, useState } from 'react';
import { useMessagesStore } from '../stores/messages.js';
import { useAuthStore } from '../stores/auth.js';
import { LoadingSpinner } from './LoadingSpinner.js';
import { C, F } from '../theme.js';

interface MessagePanelProps {
  routeId: string;
  onClose: () => void;
}

export function MessagePanel({ routeId, onClose }: MessagePanelProps) {
  const { messages, loading, fetchMessages, sendMessage } = useMessagesStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages(routeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ routeId, body: text.trim() });
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ fontFamily: F.display, fontSize: 15, margin: 0, color: C.text }}>
          Route Messages
        </h3>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {/* Messages list */}
      <div style={messagesContainerStyle}>
        {loading && messages.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center' }}><LoadingSpinner /></div>
        ) : messages.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: C.dim, fontSize: 13 }}>
            No messages yet. Start a conversation.
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
                  maxWidth: '75%', padding: '8px 12px', borderRadius: 10,
                  background: isMine ? C.accent : C.bg3,
                  color: isMine ? '#fff' : C.text,
                }}>
                  {!isMine && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: isMine ? 'rgba(255,255,255,0.7)' : C.accent, marginBottom: 2 }}>
                      {msg.senderName || 'Unknown'}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.body}</div>
                  <div style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : C.dim, marginTop: 4, textAlign: 'right' }}>
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
          placeholder="Type a message..."
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
  display: 'flex', flexDirection: 'column',
  background: C.bg2, borderRadius: 12,
  border: `1px solid ${C.muted}`,
  height: 420, overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: C.dim,
  fontSize: 20, cursor: 'pointer', lineHeight: 1,
};

const messagesContainerStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '12px 16px',
};

const inputBarStyle: React.CSSProperties = {
  display: 'flex', gap: 8, padding: '10px 16px',
  borderTop: `1px solid ${C.border}`,
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', borderRadius: 8,
  background: C.bg3, border: `1px solid ${C.muted}`,
  color: C.text, fontSize: 13, fontFamily: F.body, outline: 'none',
};

const sendBtnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, background: C.accent,
  border: 'none', color: '#000', cursor: 'pointer',
  fontFamily: F.body, fontWeight: 600, fontSize: 13,
};
