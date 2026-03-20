import { useState } from 'react';
import { C, F, alpha } from '../../theme.js';
import type { HeatmapCell } from '@homer-io/shared';

interface DeliveryHeatmapProps {
  data: HeatmapCell[];
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function DeliveryHeatmap({ data }: DeliveryHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; count: number; x: number; y: number } | null>(null);

  const maxCount = Math.max(...data.map(c => c.count), 1);

  // Build lookup
  const lookup = new Map<string, number>();
  for (const cell of data) {
    lookup.set(`${cell.dayOfWeek}-${cell.hour}`, cell.count);
  }

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 20, position: 'relative',
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, margin: '0 0 16px 0', color: C.text }}>
        Delivery Heatmap
      </h3>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 12, fontFamily: F.body }}>
        Deliveries by day &amp; hour
      </div>

      {/* Hour labels across top */}
      <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(24, 1fr)', gap: 1, marginBottom: 2 }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} style={{
            fontSize: 9, color: C.dim, textAlign: 'center', fontFamily: F.mono,
          }}>
            {h % 4 === 0 ? `${h}` : ''}
          </div>
        ))}
      </div>

      {/* Grid rows: one per day */}
      {DAYS.map((dayLabel, dayIdx) => (
        <div key={dayIdx} style={{
          display: 'grid', gridTemplateColumns: '36px repeat(24, 1fr)', gap: 1, marginBottom: 1,
        }}>
          <div style={{
            fontSize: 10, color: C.dim, fontFamily: F.mono,
            display: 'flex', alignItems: 'center',
          }}>
            {dayLabel}
          </div>
          {Array.from({ length: 24 }, (_, hour) => {
            const count = lookup.get(`${dayIdx}-${hour}`) ?? 0;
            const intensity = maxCount > 0 ? count / maxCount : 0;
            return (
              <div
                key={hour}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltip({ day: dayIdx, hour, count, x: rect.left, y: rect.top });
                }}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  aspectRatio: '1',
                  borderRadius: 2,
                  background: count > 0
                    ? alpha(C.accent, 0.1 + intensity * 0.8)
                    : alpha(C.text, 0.03),
                  cursor: 'default',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  ...(tooltip?.day === dayIdx && tooltip?.hour === hour ? {
                    transform: 'scale(1.15)',
                    boxShadow: `0 0 8px ${alpha(C.accent, 0.4)}`,
                    zIndex: 2,
                    position: 'relative' as const,
                  } : {}),
                }}
              />
            );
          })}
        </div>
      ))}

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x - 40, top: tooltip.y - 44,
          background: C.bg, border: `1px solid ${C.muted}`, borderRadius: 6,
          padding: '4px 10px', fontSize: 11, fontFamily: F.body, color: C.text,
          pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap',
          boxShadow: `0 4px 12px ${alpha(C.text, 0.1)}`,
        }}>
          <strong>{DAYS[tooltip.day]}</strong> {tooltip.hour}:00 — <strong>{tooltip.count}</strong> deliveries
        </div>
      )}
    </div>
  );
}
