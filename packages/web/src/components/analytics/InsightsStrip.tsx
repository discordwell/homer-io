import { C, F } from '../../theme.js';
import type { Insight } from '@homer-io/shared';
import { InsightCard } from './InsightCard.js';

interface InsightsStripProps {
  insights: Insight[];
}

export function InsightsStrip({ insights }: InsightsStripProps) {
  if (insights.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontFamily: F.display, fontSize: 15, margin: '0 0 12px 0', color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
        Insights
        <span style={{ fontSize: 11, color: C.dim, fontWeight: 400, fontFamily: F.body }}>
          Auto-detected patterns and recommendations
        </span>
      </h3>
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8,
        scrollbarWidth: 'thin',
        scrollbarColor: `${C.muted} transparent`,
      }}>
        {insights.map((insight, i) => (
          <div key={insight.id} style={{
            opacity: 0,
            animation: `insight-slide-in 300ms ease-out ${i * 80}ms forwards`,
          }}>
            <InsightCard insight={insight} />
          </div>
        ))}
      </div>
    </div>
  );
}
