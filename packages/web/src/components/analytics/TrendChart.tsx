import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { C, F } from '../../theme.js';
import type { TrendPoint } from '@homer-io/shared';

interface TrendChartProps {
  data: TrendPoint[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.muted}`, borderRadius: 8,
      padding: '10px 14px', fontFamily: F.body, fontSize: 13,
    }}>
      <div style={{ color: C.dim, marginBottom: 6, fontSize: 12 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} style={{ color: entry.color, display: 'flex', gap: 8, marginBottom: 2 }}>
          <span>{entry.name}:</span>
          <span style={{ fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TrendChart({ data }: TrendChartProps) {
  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 20,
    }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, margin: '0 0 16px 0', color: C.text }}>
        Delivery Trends
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
              <stop offset="95%" stopColor={C.green} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.red} stopOpacity={0.3} />
              <stop offset="95%" stopColor={C.red} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradAccent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.muted} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke={C.dim}
            tick={{ fill: C.dim, fontSize: 11, fontFamily: F.body }}
            axisLine={{ stroke: C.muted }}
            tickLine={false}
          />
          <YAxis
            stroke={C.dim}
            tick={{ fill: C.dim, fontSize: 11, fontFamily: F.body }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="deliveries"
            name="Deliveries"
            stroke={C.green}
            fill="url(#gradGreen)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="failedDeliveries"
            name="Failed"
            stroke={C.red}
            fill="url(#gradRed)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="newOrders"
            name="New Orders"
            stroke={C.accent}
            fill="url(#gradAccent)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
