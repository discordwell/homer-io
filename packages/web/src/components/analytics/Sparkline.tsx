import { C } from '../../theme.js';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  animate?: boolean;
}

export function Sparkline({
  data,
  width = 60,
  height = 20,
  color = C.accent,
  strokeWidth = 1.5,
  animate = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padY + ((max - v) / range) * (height - padY * 2);
    return `${x},${y}`;
  }).join(' ');

  const totalLen = data.length * 15; // approximate path length

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        style={animate ? {
          strokeDasharray: totalLen,
          strokeDashoffset: totalLen,
          animation: 'sparkline-draw 600ms ease-out forwards',
        } : undefined}
      />
    </svg>
  );
}
