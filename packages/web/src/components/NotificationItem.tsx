import { C, F } from '../theme.js';

interface NotificationItemProps {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  onMarkRead: (id: string) => void;
}

const typeIcons: Record<string, string> = {
  delivery_completed: '\u2705',
  delivery_failed: '\u274C',
  route_started: '\u{1F6E3}\uFE0F',
  route_completed: '\u{1F3C1}',
  driver_offline: '\u{1F6D1}',
  system: '\u2699\uFE0F',
  team_invite: '\u{1F465}',
  order_received: '\u{1F4E6}',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationItem({ id, type, title, body, readAt, createdAt, onMarkRead }: NotificationItemProps) {
  const isUnread = !readAt;
  const icon = typeIcons[type] || '\u{1F514}';

  return (
    <div
      onClick={() => { if (isUnread) onMarkRead(id); }}
      style={{
        display: 'flex', gap: 12, padding: '12px 16px',
        borderLeft: isUnread ? `3px solid ${C.accent}` : '3px solid transparent',
        background: isUnread ? `${C.accent}08` : 'transparent',
        cursor: isUnread ? 'pointer' : 'default',
        transition: 'background 0.15s ease',
        borderBottom: `1px solid ${C.border}`,
      }}
      onMouseEnter={e => { if (isUnread) e.currentTarget.style.background = `${C.accent}12`; }}
      onMouseLeave={e => { e.currentTarget.style.background = isUnread ? `${C.accent}08` : 'transparent'; }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: F.body, fontSize: 13, fontWeight: isUnread ? 600 : 400,
            color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
          <span style={{ fontFamily: F.body, fontSize: 11, color: C.dim, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {timeAgo(createdAt)}
          </span>
        </div>
        <p style={{
          fontFamily: F.body, fontSize: 12, color: C.dim, margin: '4px 0 0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {body}
        </p>
      </div>
    </div>
  );
}
