import { C, F } from '../../theme.js';
import type { Insight } from '@homer-io/shared';
import { useNLOpsStore } from '../../stores/nlops.js';

interface InsightCardProps {
  insight: Insight;
}

const TYPE_CONFIG: Record<string, { borderColor: string; icon: string }> = {
  positive: { borderColor: C.green, icon: '\u2714' },
  warning: { borderColor: C.red, icon: '\u26A0' },
  anomaly: { borderColor: C.orange, icon: '\u26A1' },
  suggestion: { borderColor: C.accent, icon: '\uD83D\uDCA1' },
};

export function InsightCard({ insight }: InsightCardProps) {
  const { setOpen, send } = useNLOpsStore();
  const config = TYPE_CONFIG[insight.type] ?? TYPE_CONFIG.suggestion;

  const handleAsk = () => {
    if (insight.action?.type === 'copilot_query' && insight.action.payload) {
      setOpen(true);
      send(insight.action.payload);
    }
  };

  return (
    <div style={{
      background: C.bg2, borderRadius: 10, border: `1px solid ${C.muted}`,
      borderLeft: `3px solid ${config.borderColor}`,
      padding: '14px 16px', minWidth: 260, maxWidth: 320, flex: '0 0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{config.icon}</span>
        <span style={{ fontFamily: F.display, fontSize: 13, fontWeight: 600, color: C.text }}>
          {insight.headline}
        </span>
      </div>
      <div style={{ fontSize: 12, color: C.dim, fontFamily: F.body, lineHeight: 1.5, marginBottom: 10 }}>
        {insight.detail}
      </div>
      {insight.action?.type === 'copilot_query' && (
        <button
          onClick={handleAsk}
          style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.muted}`,
            background: 'transparent', color: C.accent, cursor: 'pointer',
            fontFamily: F.body, fontSize: 11, fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = `${C.bg3}`}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          Ask HOMER
        </button>
      )}
    </div>
  );
}
