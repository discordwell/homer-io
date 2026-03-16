import { useState, useEffect, useRef } from 'react';
import { C, F } from '../theme.js';

interface RiskFactor {
  name: string;
  points: number;
  detail: string;
}

interface RiskBadgeProps {
  score: number;
  factors?: RiskFactor[];
}

export function getRiskLevel(score: number): { label: string; color: string } | null {
  if (score >= 80) return { label: 'Critical', color: C.red };
  if (score >= 60) return { label: 'High Risk', color: C.orange };
  if (score >= 40) return { label: 'Medium Risk', color: C.yellow };
  if (score < 20) return { label: 'Low Risk', color: C.green };
  return null; // 20-39: normal, no badge
}

export function RiskBadge({ score, factors }: RiskBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const level = getRiskLevel(score);

  // Close popover on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  if (!level) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (factors && factors.length > 0) setExpanded(!expanded);
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 999, fontSize: 11,
          fontWeight: 600, fontFamily: F.body,
          background: `${level.color}18`, color: level.color,
          border: `1px solid ${level.color}30`,
          textTransform: 'uppercase', letterSpacing: '0.5px',
          cursor: factors && factors.length > 0 ? 'pointer' : 'default',
        }}
      >
        {score} {level.label}
      </span>

      {/* Expandable factors popover */}
      {expanded && factors && factors.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            background: C.bg2, border: `1px solid ${C.muted}`, borderRadius: 8,
            padding: 12, minWidth: 240, zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontFamily: F.display, fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            Risk Factors
          </div>
          {factors.map((f, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: 8, padding: '4px 0',
              borderBottom: i < factors.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ fontSize: 12, color: C.dim, lineHeight: 1.4 }}>{f.detail}</span>
              <span style={{
                fontSize: 11, fontFamily: F.mono, color: level.color,
                flexShrink: 0, fontWeight: 600,
              }}>+{f.points}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Summarize risk scores for a set of stops. Returns null if no high-risk stops. */
export function riskSummary(scores: { score: number }[]): string | null {
  const high = scores.filter(s => s.score >= 60).length;
  const medium = scores.filter(s => s.score >= 40 && s.score < 60).length;
  if (high === 0 && medium === 0) return null;
  const parts: string[] = [];
  if (high > 0) parts.push(`${high} high-risk stop${high !== 1 ? 's' : ''}`);
  if (medium > 0) parts.push(`${medium} medium-risk`);
  return parts.join(', ');
}
