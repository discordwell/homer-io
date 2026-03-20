import { useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceDot,
} from 'recharts';
import { C, F } from '../../theme.js';
import type { EnhancedTrendPoint } from '@homer-io/shared';

interface EnhancedTrendChartProps {
  data: EnhancedTrendPoint[];
  previousData?: EnhancedTrendPoint[];
}

interface TooltipPayloadEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.muted}`, borderRadius: 8,
      padding: '10px 14px', fontFamily: F.body, fontSize: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ color: C.dim, marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((entry: TooltipPayloadEntry) => (
        <div key={entry.dataKey} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
          <span>{entry.name}</span>
          <span style={{ fontWeight: 600, fontFamily: F.mono }}>{entry.value}{entry.dataKey === 'onTimeRate' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Detect anomaly points (>1.5 std dev from rolling avg)
function findAnomalies(data: EnhancedTrendPoint[]): Array<{ index: number; date: string; value: number; label: string }> {
  if (data.length < 5) return [];
  const anomalies: Array<{ index: number; date: string; value: number; label: string }> = [];

  const deliveries = data.map(d => d.deliveries);
  const mean = deliveries.reduce((s, v) => s + v, 0) / deliveries.length;
  const std = Math.sqrt(deliveries.reduce((s, v) => s + (v - mean) ** 2, 0) / deliveries.length) || 1;

  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i].deliveries - mean) > 1.5 * std && data[i].deliveries > 0) {
      anomalies.push({
        index: i,
        date: data[i].date,
        value: data[i].deliveries,
        label: data[i].deliveries > mean ? `Peak: ${data[i].deliveries}` : `Dip: ${data[i].deliveries}`,
      });
    }
  }
  return anomalies.slice(0, 3); // Max 3 annotations
}

export function EnhancedTrendChart({ data, previousData }: EnhancedTrendChartProps) {
  const [showComparison, setShowComparison] = useState(false);
  const anomalies = findAnomalies(data);

  // Merge previous period data as ghost columns
  const chartData = data.map((d, i) => ({
    ...d,
    prevDeliveries: showComparison && previousData?.[i] ? previousData[i].deliveries : undefined,
    prevFailed: showComparison && previousData?.[i] ? previousData[i].failedDeliveries : undefined,
  }));

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 20, flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0, color: C.text }}>
          Delivery Trends
        </h3>
        {previousData && previousData.length > 0 && (
          <button
            onClick={() => setShowComparison(!showComparison)}
            style={{
              padding: '4px 12px', borderRadius: 6,
              border: `1px solid ${showComparison ? C.accent : C.muted}`,
              background: showComparison ? C.accent : 'transparent',
              color: showComparison ? '#000' : C.dim,
              cursor: 'pointer', fontFamily: F.body, fontSize: 11, fontWeight: 500,
            }}
          >
            vs Previous
          </button>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="trendGradGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.green} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.green} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.muted} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke={C.dim}
            tick={{ fill: C.dim, fontSize: 10, fontFamily: F.body }}
            axisLine={{ stroke: C.muted }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke={C.dim}
            tick={{ fill: C.dim, fontSize: 10, fontFamily: F.body }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            stroke={C.dim}
            tick={{ fill: C.dim, fontSize: 10, fontFamily: F.body }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Brush
            dataKey="date"
            height={20}
            stroke={C.muted}
            fill={C.bg}
            tickFormatter={formatDate}
          />

          {/* Main series */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="deliveries"
            name="Deliveries"
            stroke={C.green}
            fill="url(#trendGradGreen)"
            strokeWidth={2}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="failedDeliveries"
            name="Failed"
            stroke={C.red}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="newOrders"
            name="New Orders"
            stroke={C.accent}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="onTimeRate"
            name="On-Time %"
            stroke={C.purple}
            strokeWidth={1.5}
            dot={false}
          />

          {/* Previous period ghost lines */}
          {showComparison && (
            <>
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="prevDeliveries"
                name="Prev Deliveries"
                stroke={C.green}
                strokeWidth={1}
                strokeDasharray="6 3"
                strokeOpacity={0.3}
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="prevFailed"
                name="Prev Failed"
                stroke={C.red}
                strokeWidth={1}
                strokeDasharray="6 3"
                strokeOpacity={0.3}
                dot={false}
              />
            </>
          )}

          {/* Anomaly annotations */}
          {anomalies.map((a) => (
            <ReferenceDot
              key={a.date}
              yAxisId="left"
              x={a.date}
              y={a.value}
              r={5}
              fill={C.accent}
              stroke={C.bg}
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
        {[
          { color: C.green, label: 'Deliveries' },
          { color: C.red, label: 'Failed' },
          { color: C.accent, label: 'New Orders' },
          { color: C.purple, label: 'On-Time %' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, color: C.dim, fontFamily: F.body }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
