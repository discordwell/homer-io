import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { C, F, alpha } from '../../theme.js';
import type { DeliveryOutcomes as DeliveryOutcomesType } from '@homer-io/shared';

interface DeliveryOutcomesProps {
  data: DeliveryOutcomesType;
}

const STATUS_COLORS: Record<string, string> = {
  delivered: C.green,
  failed: C.red,
  inTransit: C.accent,
  assigned: C.purple,
};

const FAILURE_COLORS = [C.red, C.orange, C.yellow, C.purple, C.dim];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayloadEntry {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function StackedTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.muted}`, borderRadius: 8,
      padding: '10px 14px', fontFamily: F.body, fontSize: 12,
    }}>
      <div style={{ color: C.dim, marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map((entry: TooltipPayloadEntry) => (
        <div key={entry.dataKey} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
          <span>{entry.name}</span>
          <span style={{ fontWeight: 600 }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DeliveryOutcomes({ data }: DeliveryOutcomesProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stacked bar chart */}
      <div>
        <h4 style={{ fontFamily: F.display, fontSize: 14, color: C.text, margin: '0 0 12px 0' }}>
          Daily Status Distribution
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.statusDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke={C.dim}
              tick={{ fill: C.dim, fontSize: 10, fontFamily: F.body }}
              tickLine={false}
            />
            <YAxis
              stroke={C.dim}
              tick={{ fill: C.dim, fontSize: 10, fontFamily: F.body }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<StackedTooltip />} />
            <Bar dataKey="delivered" name="Delivered" fill={STATUS_COLORS.delivered} stackId="status" radius={[0, 0, 0, 0]} />
            <Bar dataKey="failed" name="Failed" fill={STATUS_COLORS.failed} stackId="status" />
            <Bar dataKey="inTransit" name="In Transit" fill={STATUS_COLORS.inTransit} stackId="status" />
            <Bar dataKey="assigned" name="Assigned" fill={STATUS_COLORS.assigned} stackId="status" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Failure donut */}
        <div>
          <h4 style={{ fontFamily: F.display, fontSize: 14, color: C.text, margin: '0 0 12px 0' }}>
            Failure Reasons
          </h4>
          {data.failureCategories.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={data.failureCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="count"
                    nameKey="category"
                    stroke={C.bg2}
                    strokeWidth={2}
                  >
                    {data.failureCategories.map((_, i) => (
                      <Cell key={i} fill={FAILURE_COLORS[i % FAILURE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.failureCategories.map((cat, i) => (
                  <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: FAILURE_COLORS[i % FAILURE_COLORS.length],
                    }} />
                    <span style={{ fontSize: 11, color: C.dim, fontFamily: F.body }}>
                      {cat.category} ({cat.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: C.dim, fontSize: 13, fontFamily: F.body }}>No failures in this period</div>
          )}
        </div>

        {/* Time-window compliance gauge */}
        <div>
          <h4 style={{ fontFamily: F.display, fontSize: 14, color: C.text, margin: '0 0 12px 0' }}>
            Time-Window Compliance
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* Gauge */}
            <div style={{ position: 'relative', width: 100, height: 50, overflow: 'hidden' }}>
              {/* Background arc */}
              <svg width={100} height={50} viewBox="0 0 100 50">
                <path
                  d="M 5 50 A 45 45 0 0 1 95 50"
                  fill="none"
                  stroke={alpha(C.text, 0.08)}
                  strokeWidth={8}
                  strokeLinecap="round"
                />
                <path
                  d="M 5 50 A 45 45 0 0 1 95 50"
                  fill="none"
                  stroke={data.timeWindowCompliance >= 90 ? C.green : data.timeWindowCompliance >= 70 ? C.yellow : C.red}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={`${(data.timeWindowCompliance / 100) * 141.4} 141.4`}
                />
              </svg>
              <div style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                fontSize: 18, fontWeight: 700, fontFamily: F.display, color: C.text,
              }}>
                {data.timeWindowCompliance}%
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: F.body, textAlign: 'center' }}>
              {data.onTimeCount} of {data.totalWithTimeWindow} on time
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
