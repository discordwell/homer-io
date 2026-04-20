import { useEffect, useRef, useState } from 'react';
import { useNotificationsStore } from '../stores/notifications.js';
import { useAuthStore } from '../stores/auth.js';
import { NotificationItem } from './NotificationItem.js';
import { usePollingWithBackoff } from '../hooks/usePollingWithBackoff.js';
import { C, F } from '../theme.js';

export function NotificationCenter() {
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead } = useNotificationsStore();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Poll unread count with exponential backoff on error.
  usePollingWithBackoff(fetchUnreadCount, { enabled: isAuthenticated });

  // Fetch notifications when panel opens
  useEffect(() => {
    if (open && isAuthenticated) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  if (!isAuthenticated) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'none', border: 'none',
          color: C.dim, cursor: 'pointer',
          padding: 8, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = C.text)}
        onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: C.red, color: '#fff',
            fontSize: 10, fontWeight: 700, fontFamily: F.body,
            minWidth: 16, height: 16, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className="notification-dropdown"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 380, maxHeight: 480,
            background: C.bg2, borderRadius: 12,
            border: `1px solid ${C.muted}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            overflow: 'hidden', zIndex: 500,
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontFamily: F.display, fontSize: 15, color: C.text, fontWeight: 600 }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                style={{
                  background: 'none', border: 'none', color: C.accent,
                  cursor: 'pointer', fontSize: 12, fontFamily: F.body,
                  padding: '4px 8px',
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: C.dim, fontSize: 14,
                fontFamily: F.body,
              }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  id={n.id}
                  type={n.type}
                  title={n.title}
                  body={n.body}
                  readAt={n.readAt}
                  createdAt={n.createdAt}
                  onMarkRead={markAsRead}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
