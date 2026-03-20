import { C, F, alpha } from '../../theme.js';
import { Badge } from '../Badge.js';

interface StopCardProps {
  recipientName: string;
  address: string;
  status: string;
  packageCount: number;
  stopSequence: number | null;
  isNextStop: boolean;
  onClick: () => void;
}

const statusColors: Record<string, string> = {
  assigned: 'blue',
  in_transit: 'yellow',
  delivered: 'green',
  failed: 'red',
  received: 'dim',
};

export function StopCard({
  recipientName,
  address,
  status,
  packageCount,
  stopSequence,
  isNextStop,
  onClick,
}: StopCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '14px 16px',
        background: isNextStop ? alpha(C.accent, 0.06) : C.bg2,
        border: `1px solid ${isNextStop ? C.accent : C.border}`,
        borderLeft: isNextStop ? `3px solid ${C.accent}` : `1px solid ${isNextStop ? C.accent : C.border}`,
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'left',
        color: C.text,
        fontFamily: F.body,
        minHeight: 44,
        transition: 'background 0.15s',
      }}
    >
      {/* Stop number */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: isNextStop ? C.accent : C.muted,
        color: isNextStop ? C.bg : C.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {stopSequence ?? '?'}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recipientName}
        </div>
        <div style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {address}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <Badge color={statusColors[status] || 'dim'}>{status.replace('_', ' ')}</Badge>
        <span style={{ fontSize: 11, color: C.dim }}>
          {packageCount} pkg{packageCount !== 1 ? 's' : ''}
        </span>
      </div>
    </button>
  );
}
