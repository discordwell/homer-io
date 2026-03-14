import { C, F } from '../../theme.js';

interface TimelineEvent {
  action: string;
  createdAt: string;
  metadata?: any;
}

interface StatusTimelineProps {
  currentStatus: string;
  events: TimelineEvent[];
}

const STATUS_STEPS = [
  { key: 'received', label: 'Order Received', icon: '\u{1F4E6}' },
  { key: 'assigned', label: 'Assigned to Driver', icon: '\u{1F464}' },
  { key: 'in_transit', label: 'In Transit', icon: '\u{1F69A}' },
  { key: 'delivered', label: 'Delivered', icon: '\u2705' },
  { key: 'failed', label: 'Delivery Failed', icon: '\u274C' },
];

const STATUS_ORDER: Record<string, number> = {
  received: 0,
  assigned: 1,
  in_transit: 2,
  delivered: 3,
  failed: 3,
  returned: 4,
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getEventForStep(stepKey: string, events: TimelineEvent[]): TimelineEvent | undefined {
  const actionMap: Record<string, string[]> = {
    received: ['order_created', 'order_received'],
    assigned: ['order_assigned'],
    in_transit: ['route_in_progress', 'order_in_transit'],
    delivered: ['order_delivered'],
    failed: ['order_failed'],
  };
  const actions = actionMap[stepKey] || [];
  return events.find((e) => actions.includes(e.action));
}

export function StatusTimeline({ currentStatus, events }: StatusTimelineProps) {
  const currentIdx = STATUS_ORDER[currentStatus] ?? 0;
  const isFailed = currentStatus === 'failed';

  // Filter steps: if not failed, hide the "failed" step; if failed, hide "delivered"
  const steps = STATUS_STEPS.filter((step) => {
    if (isFailed && step.key === 'delivered') return false;
    if (!isFailed && step.key === 'failed') return false;
    return true;
  });

  return (
    <div style={{ padding: '16px 0' }}>
      {steps.map((step, i) => {
        const stepIdx = STATUS_ORDER[step.key];
        const isCompleted = stepIdx < currentIdx;
        const isCurrent = stepIdx === currentIdx;
        const isFuture = stepIdx > currentIdx;
        const event = getEventForStep(step.key, events);

        return (
          <div key={step.key} style={{ display: 'flex', gap: 16, position: 'relative' }}>
            {/* Vertical line */}
            {i < steps.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: 15,
                  top: 32,
                  bottom: -8,
                  width: 2,
                  background: isCompleted ? C.green : C.muted,
                }}
              />
            )}

            {/* Dot */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: isCompleted
                  ? C.green
                  : isCurrent
                    ? C.accent
                    : C.muted,
                boxShadow: isCurrent ? `0 0 12px ${C.accent}` : 'none',
                animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                fontSize: 14,
                zIndex: 1,
              }}
            >
              {step.icon}
            </div>

            {/* Content */}
            <div style={{ paddingBottom: 24, flex: 1 }}>
              <div
                style={{
                  fontFamily: F.body,
                  fontWeight: 600,
                  fontSize: 14,
                  color: isFuture ? C.dim : C.text,
                  lineHeight: '32px',
                }}
              >
                {step.label}
              </div>
              {event && (
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 12,
                    color: C.dim,
                    marginTop: 2,
                  }}
                >
                  {formatTimestamp(event.createdAt)}
                </div>
              )}
              {isFuture && !event && (
                <div
                  style={{
                    fontFamily: F.body,
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 2,
                  }}
                >
                  Pending
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 4px ${C.accent}; }
          50% { box-shadow: 0 0 20px ${C.accent}; }
        }
      `}</style>
    </div>
  );
}
