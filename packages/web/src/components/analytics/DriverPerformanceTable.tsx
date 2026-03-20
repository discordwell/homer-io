import { useState } from 'react';
import { C, F, alpha } from '../../theme.js';
import { Sparkline } from './Sparkline.js';
import type { EnhancedDriverPerformance } from '@homer-io/shared';

interface DriverPerformanceTableProps {
  drivers: EnhancedDriverPerformance[];
}

const MEDALS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

function rateColor(rate: number): string {
  if (rate >= 95) return C.green;
  if (rate >= 90) return C.yellow;
  return C.red;
}

export function DriverPerformanceTable({ drivers }: DriverPerformanceTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr 70px 80px 80px 70px 60px',
        gap: 8, padding: '10px 16px',
        background: alpha(C.text, 0.03), fontFamily: F.body, fontSize: 11,
        color: C.dim, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
      }}>
        <span>#</span>
        <span>Driver</span>
        <span>Trend</span>
        <span>Deliveries</span>
        <span>Success</span>
        <span>Avg Time</span>
        <span>Score</span>
      </div>

      {/* Rows */}
      {drivers.map((d, i) => (
        <div key={d.driverId}>
          <div
            onClick={() => setExpanded(expanded === d.driverId ? null : d.driverId)}
            style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 70px 80px 80px 70px 60px',
              gap: 8, padding: '12px 16px', cursor: 'pointer',
              background: expanded === d.driverId ? alpha(C.accent, 0.04) : 'transparent',
              borderBottom: `1px solid ${alpha(C.text, 0.05)}`,
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = alpha(C.accent, 0.04)}
            onMouseOut={(e) => e.currentTarget.style.background = expanded === d.driverId ? alpha(C.accent, 0.04) : 'transparent'}
          >
            {/* Rank */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {i < 3 ? (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: MEDALS[i], color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: F.mono,
                }}>
                  {i + 1}
                </div>
              ) : (
                <span style={{ color: C.dim, fontFamily: F.mono, fontSize: 13 }}>{i + 1}</span>
              )}
            </div>

            {/* Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: C.text, fontFamily: F.body, fontSize: 13, fontWeight: 500 }}>
                {d.driverName}
              </span>
              {d.vsFleetAvg !== 0 && (
                <span style={{
                  fontSize: 10, fontFamily: F.mono, padding: '1px 6px', borderRadius: 4,
                  background: d.vsFleetAvg > 0 ? alpha(C.green, 0.1) : alpha(C.red, 0.1),
                  color: d.vsFleetAvg > 0 ? C.green : C.red,
                }}>
                  {d.vsFleetAvg > 0 ? '+' : ''}{d.vsFleetAvg}%
                </span>
              )}
            </div>

            {/* Sparkline */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Sparkline data={d.sparkline} width={56} height={18} color={rateColor(d.successRate)} />
            </div>

            {/* Deliveries */}
            <span style={{ color: C.text, fontFamily: F.mono, fontSize: 13, display: 'flex', alignItems: 'center' }}>
              {d.totalDeliveries}
            </span>

            {/* Success Rate */}
            <span style={{
              color: rateColor(d.successRate), fontWeight: 600,
              fontFamily: F.mono, fontSize: 13, display: 'flex', alignItems: 'center',
            }}>
              {d.successRate}%
            </span>

            {/* Avg Time */}
            <span style={{ color: C.dim, fontFamily: F.mono, fontSize: 13, display: 'flex', alignItems: 'center' }}>
              {d.avgDeliveryTime != null ? `${d.avgDeliveryTime}m` : '\u2014'}
            </span>

            {/* Efficiency Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 6, borderRadius: 3,
                background: alpha(C.text, 0.1), overflow: 'hidden',
              }}>
                <div style={{
                  width: `${d.efficiencyScore}%`, height: '100%', borderRadius: 3,
                  background: d.efficiencyScore >= 80 ? C.green : d.efficiencyScore >= 60 ? C.yellow : C.red,
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: F.mono, color: C.dim }}>{d.efficiencyScore}</span>
            </div>
          </div>

          {/* Expanded detail */}
          {expanded === d.driverId && (
            <div style={{
              padding: '12px 16px 16px 56px',
              background: alpha(C.accent, 0.02),
              borderBottom: `1px solid ${alpha(C.text, 0.05)}`,
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
            }}>
              <div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: 'uppercase' as const }}>Total Distance</div>
                <div style={{ fontSize: 14, fontFamily: F.mono, color: C.text }}>
                  {d.totalDistance != null ? `${Math.round(d.totalDistance)} km` : '\u2014'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: 'uppercase' as const }}>Efficiency Score</div>
                <div style={{ fontSize: 14, fontFamily: F.mono, color: C.text }}>{d.efficiencyScore}/100</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: 'uppercase' as const }}>vs Fleet Avg</div>
                <div style={{
                  fontSize: 14, fontFamily: F.mono,
                  color: d.vsFleetAvg > 0 ? C.green : d.vsFleetAvg < 0 ? C.red : C.dim,
                }}>
                  {d.vsFleetAvg > 0 ? '+' : ''}{d.vsFleetAvg}% success rate
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
