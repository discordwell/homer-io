import { useEffect, useRef } from 'react';
import { C, F } from '../theme.js';
import { useTrackingStore, type DeliveryEventItem } from '../stores/tracking.js';

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function EventCard({ event }: { event: DeliveryEventItem }) {
  const isDelivered = event.status === 'delivered';

  return (
    <div
      style={{
        padding: '12px 14px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isDelivered ? C.green : C.red,
          marginTop: 6,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 600,
            color: C.text,
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.recipientName}
        </div>
        <div
          style={{
            fontFamily: F.body,
            fontSize: 12,
            color: isDelivered ? C.green : C.red,
            marginBottom: 2,
          }}
        >
          {isDelivered ? 'Delivered' : 'Failed'}
          {event.failureReason && (
            <span style={{ color: C.dim }}> — {event.failureReason}</span>
          )}
        </div>
        <div
          style={{
            fontFamily: F.body,
            fontSize: 11,
            color: C.dim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.routeName}
        </div>
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          color: C.dim,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {formatTime(event.timestamp)}
      </div>
    </div>
  );
}

export function DeliveryEventFeed() {
  const deliveryEvents = useTrackingStore((s) => s.deliveryEvents);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new events arrive (newest first)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [deliveryEvents.length]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${C.border}`,
          fontFamily: F.display,
          fontSize: 14,
          fontWeight: 600,
          color: C.text,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        Delivery Events
        {deliveryEvents.length > 0 && (
          <span
            style={{
              backgroundColor: C.accent,
              color: C.bg,
              fontSize: 11,
              fontFamily: F.mono,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 10,
            }}
          >
            {deliveryEvents.length}
          </span>
        )}
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {deliveryEvents.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontFamily: F.body,
              fontSize: 13,
              color: C.dim,
            }}
          >
            No delivery events yet.
            <br />
            Events will appear here in real time.
          </div>
        ) : (
          deliveryEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
