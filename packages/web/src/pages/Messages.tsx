import { useEffect } from 'react';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { useMessagesStore } from '../stores/messages.js';
import { C, F, alpha } from '../theme.js';

export function MessagesPage() {
  const {
    messages,
    loading,
    fetchMessages,
    fetchUnreadCount,
    markAsRead,
  } = useMessagesStore();

  useEffect(() => {
    void fetchMessages();
    void fetchUnreadCount();
  }, [fetchMessages, fetchUnreadCount]);

  if (loading && messages.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: F.display, fontSize: 28, color: C.text }}>
          Messages
        </h1>
        <p style={{ margin: 0, color: C.dim, fontSize: 14 }}>
          Review tenant conversations in one place. Route-specific replies still belong in the route detail flow.
        </p>
      </header>

      {messages.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No messages yet"
          description="Messages from route activity will appear here as dispatch and driver conversations start."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {messages.map((message) => (
            <article
              key={message.id}
              style={{
                display: 'grid',
                gap: 10,
                padding: 18,
                borderRadius: 12,
                background: C.bg2,
                border: `1px solid ${message.readAt ? C.border : alpha(C.accent, 0.32)}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ color: C.text, fontSize: 14 }}>
                    {message.senderName || 'Unknown sender'}
                  </strong>
                  <span style={{ color: C.dim, fontSize: 12 }}>
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {message.routeId && (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: alpha(C.accent, 0.14),
                        color: C.accent,
                      }}
                    >
                      Route thread
                    </span>
                  )}
                  {!message.readAt && (
                    <button
                      onClick={() => void markAsRead(message.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: `1px solid ${C.border}`,
                        background: C.bg3,
                        color: C.text,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: F.body,
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>

              <p style={{ margin: 0, color: C.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {message.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
