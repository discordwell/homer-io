import { KPICard } from '../components/KPICard.js';
import { C, F } from '../theme.js';

/**
 * Simplified analytics page for demo mode.
 * Shows static KPI data and summary information without requiring API calls.
 */
export function DemoAnalyticsPage() {
  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 4 }}>Analytics</h2>
          <p style={{ color: C.dim, margin: 0, fontSize: 13 }}>Performance metrics from 90 days of sample data</p>
        </div>
        <div style={{
          display: 'flex', background: C.bg3, borderRadius: 8,
          border: `1px solid ${C.muted}`, overflow: 'hidden',
        }}>
          {['7d', '30d', '90d'].map(r => (
            <button
              key={r}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'default',
                fontFamily: F.body, fontSize: 13, fontWeight: 500,
                background: r === '30d' ? C.accent : 'transparent',
                color: r === '30d' ? C.bg : C.dim,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32,
      }}>
        <KPICard icon="&#x1F4E6;" label="Total Deliveries" value="1,247" color={C.accent} sub="+12% vs prior period" />
        <KPICard icon="&#x2705;" label="Success Rate" value="91.8%" color={C.green} sub="Industry avg: 88%" />
        <KPICard icon="&#x23F1;&#xFE0F;" label="Avg Delivery Time" value="34 min" color={C.yellow} sub="-8% improvement" />
        <KPICard icon="&#x1F4B0;" label="Cost per Delivery" value="$4.82" color={C.purple} sub="Down from $5.30" />
      </div>

      {/* Driver Performance */}
      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 16 }}>Driver Leaderboard</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {[
            { name: 'Alex Rivera', deliveries: 312, successRate: 97, avgTime: '28 min', rank: 1 },
            { name: 'Jordan Chen', deliveries: 285, successRate: 93, avgTime: '35 min', rank: 2 },
            { name: 'Morgan Patel', deliveries: 248, successRate: 95, avgTime: '30 min', rank: 3 },
            { name: 'Sam Okafor', deliveries: 221, successRate: 85, avgTime: '42 min', rank: 4 },
            { name: 'Casey Nguyen', deliveries: 181, successRate: 90, avgTime: '38 min', rank: 5 },
          ].map((d) => (
            <div key={d.name} className="driver-leaderboard-row" style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 100px 100px 100px',
              alignItems: 'center', padding: '12px 16px',
              background: C.bg3, borderRadius: 8, border: `1px solid ${C.muted}`,
              gap: 16,
            }}>
              <span style={{ fontFamily: F.mono, fontSize: 14, color: C.dim, textAlign: 'center' }}>#{d.rank}</span>
              <span style={{ fontWeight: 500 }}>{d.name}</span>
              <span style={{ color: C.dim, fontSize: 13 }}>{d.deliveries} trips</span>
              <span style={{ color: d.successRate >= 90 ? C.green : C.yellow, fontSize: 13 }}>{d.successRate}% success</span>
              <span style={{ color: C.dim, fontSize: 13 }}>{d.avgTime} avg</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Outcomes Breakdown */}
      <div className="analytics-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 24 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 16 }}>Delivery Outcomes</h3>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { label: 'Delivered', count: 1145, pct: 91.8, color: C.green },
              { label: 'Failed - Not Home', count: 41, pct: 3.3, color: C.red },
              { label: 'Failed - Access Denied', count: 22, pct: 1.8, color: C.orange },
              { label: 'Failed - Wrong Address', count: 18, pct: 1.4, color: C.yellow },
              { label: 'Failed - Other', count: 21, pct: 1.7, color: C.dim },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13 }}>{item.label}</span>
                <span style={{ fontSize: 13, color: C.dim, fontFamily: F.mono }}>{item.count}</span>
                <span style={{ fontSize: 12, color: C.dim, fontFamily: F.mono, width: 50, textAlign: 'right' }}>{item.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 24 }}>
          <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 16 }}>Volume Trend (30d)</h3>
          {/* Simple text-based volume display */}
          <div style={{ display: 'grid', gap: 6 }}>
            {[
              { week: 'Week 1', orders: 245 },
              { week: 'Week 2', orders: 289 },
              { week: 'Week 3', orders: 332 },
              { week: 'Week 4', orders: 381 },
            ].map((w) => (
              <div key={w.week} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 60, fontSize: 13, color: C.dim }}>{w.week}</span>
                <div style={{ flex: 1, height: 24, background: C.bg3, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(w.orders / 400) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${C.accent}, ${C.green})`,
                    borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
                  }}>
                    <span style={{ fontSize: 11, color: '#000', fontWeight: 600 }}>{w.orders}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ color: C.dim, fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            +55% growth over 30 days
          </p>
        </div>
      </div>

      {/* Intelligence Summary */}
      <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 24 }}>
        <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 16 }}>Address Intelligence</h3>
        <div className="intel-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontFamily: F.display, color: C.accent }}>847</div>
            <div style={{ color: C.dim, fontSize: 13 }}>Addresses Learned</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontFamily: F.display, color: C.green }}>1,247</div>
            <div style={{ color: C.dim, fontSize: 13 }}>Deliveries Tracked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontFamily: F.display, color: C.yellow }}>4.2 min</div>
            <div style={{ color: C.dim, fontSize: 13 }}>Avg Service Time</div>
          </div>
        </div>
      </div>
    </div>
  );
}
