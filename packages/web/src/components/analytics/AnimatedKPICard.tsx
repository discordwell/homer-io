import { useEffect, useRef, useState } from 'react';
import { C, F, alpha } from '../../theme.js';
import { Sparkline } from './Sparkline.js';

interface AnimatedKPICardProps {
  icon: string;
  label: string;
  value: number;
  suffix?: string;
  sparkline: number[];
  delta: number;
  color?: string;
  delay?: number;
}

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCurrent(Math.round(from + (target - from) * ease(progress)));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return current;
}

export function AnimatedKPICard({
  icon, label, value, suffix = '', sparkline, delta, color = C.accent, delay = 0,
}: AnimatedKPICardProps) {
  const displayValue = useCountUp(value);
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  // For success/on-time rate, color based on value
  const valueColor = suffix === '%'
    ? (value >= 95 ? C.green : value >= 90 ? C.yellow : value < 90 ? C.red : C.text)
    : C.text;

  return (
    <div style={{
      background: `radial-gradient(ellipse at top left, ${alpha(color, 0.08)} 0%, ${C.bg2} 70%)`,
      borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.muted}`,
      opacity: 0, animation: `kpi-fade-in 400ms ease-out ${delay}ms forwards`,
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body, whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <Sparkline data={sparkline} width={48} height={16} color={color} />
      </div>

      {/* Value */}
      <div style={{
        fontSize: 26, fontWeight: 700, fontFamily: F.display, color: valueColor,
        lineHeight: 1.1, marginBottom: 6,
      }}>
        {displayValue}{suffix}
      </div>

      {/* Delta */}
      <div style={{
        fontSize: 11, fontFamily: F.mono, fontWeight: 500,
        color: isPositive ? C.green : isNegative ? C.red : C.dim,
        display: 'flex', alignItems: 'center', gap: 3,
      }}>
        {isPositive ? '\u25B2' : isNegative ? '\u25BC' : '\u2014'}
        {delta !== 0 && <span>{Math.abs(delta)}% vs prev</span>}
      </div>
    </div>
  );
}
