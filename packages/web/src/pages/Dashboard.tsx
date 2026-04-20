import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { useDashboard } from '../hooks/useDashboard.js';
import { KPICard } from '../components/KPICard.js';
import { DataTable, type Column } from '../components/DataTable.js';
import { Badge } from '../components/Badge.js';
import { EmptyState } from '../components/EmptyState.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { IntelligenceWidget } from '../components/IntelligenceWidget.js';
import { OnboardingWizard } from '../components/OnboardingWizard.js';
import { C, F, alpha } from '../theme.js';

const statusColors: Record<string, string> = {
  received: 'blue', assigned: 'purple', in_transit: 'yellow', delivered: 'green', failed: 'red', returned: 'orange',
};

const priorityColors: Record<string, string> = {
  low: 'dim', normal: 'blue', high: 'orange', urgent: 'red',
};

interface RecentOrder {
  id: string;
  recipientName: string;
  status: string;
  priority: string;
  packageCount: number;
  createdAt: string;
}

/* ---- Industry Quick Actions ---- */

interface QuickAction {
  title: string;
  description: string;
  link: string;
}

const INDUSTRY_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  cannabis: [
    { title: 'Set up compliance settings', description: 'Configure cannabis-specific regulatory compliance for your jurisdiction', link: '/dashboard/settings' },
    { title: 'Configure delivery zones', description: 'Define your licensed delivery areas and zone restrictions', link: '/dashboard/settings' },
    { title: 'Create your first manifest', description: 'Build a compliant delivery manifest with chain-of-custody tracking', link: '/dashboard/routes' },
  ],
  florist: [
    { title: 'Set up sender notifications', description: 'Notify gift senders when their arrangement is delivered', link: '/dashboard/settings' },
    { title: 'Import orders from FTD', description: 'Connect your FTD or wire service account to auto-import orders', link: '/dashboard/settings' },
    { title: 'Create a delivery route', description: 'Build an optimized route for today\'s deliveries', link: '/dashboard/routes/new' },
  ],
  pharmacy: [
    { title: 'Configure HIPAA settings', description: 'Set up compliant handling for protected health information', link: '/dashboard/settings' },
    { title: 'Connect PioneerRx', description: 'Integrate your pharmacy management system for automatic order sync', link: '/dashboard/settings' },
    { title: 'Set up signature requirements', description: 'Require patient signatures and ID verification at delivery', link: '/dashboard/settings' },
  ],
  restaurant: [
    { title: 'Connect Square or Toast', description: 'Import orders directly from your POS system', link: '/dashboard/settings' },
    { title: 'Create your first route', description: 'Build an optimized delivery route from incoming orders', link: '/dashboard/routes/new' },
    { title: 'Set up customer tracking', description: 'Let customers see real-time delivery progress via SMS or email', link: '/dashboard/settings' },
  ],
  grocery: [
    { title: 'Configure temperature zones', description: 'Set up frozen, refrigerated, and ambient handling requirements', link: '/dashboard/settings' },
    { title: 'Set substitution policy', description: 'Define how drivers handle out-of-stock items at pickup', link: '/dashboard/settings' },
    { title: 'Create a delivery route', description: 'Optimize your grocery delivery runs with time windows', link: '/dashboard/routes/new' },
  ],
  furniture: [
    { title: 'Set up crew sizes', description: 'Configure team sizes for different delivery types (couch vs. nightstand)', link: '/dashboard/settings' },
    { title: 'Configure assembly tracking', description: 'Track assembly time and completion for white-glove deliveries', link: '/dashboard/settings' },
    { title: 'Plan a delivery route', description: 'Build routes with extended service windows for large-item delivery', link: '/dashboard/routes/new' },
  ],
};

function QuickActionsSection({ industry, ordersToday }: { industry: string; ordersToday: number }) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const actions = INDUSTRY_QUICK_ACTIONS[industry];
  if (!actions) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 4 }}>
        Quick Actions
      </h3>
      <p style={{ color: C.dim, fontSize: 13, marginBottom: 16 }}>
        Recommended next steps for your {industry} delivery operation
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {actions.map((action, idx) => (
          <div
            key={action.title}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              background: C.bg2, borderRadius: 12,
              border: `1px solid ${hoveredIdx === idx ? C.accent : C.muted}`,
              padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
              transition: 'border-color 0.2s, transform 0.15s',
              transform: hoveredIdx === idx ? 'translateY(-2px)' : 'none',
            }}
          >
            <h4 style={{ fontFamily: F.display, fontSize: 14, fontWeight: 600, margin: 0, color: C.text }}>
              {action.title}
            </h4>
            <p style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, margin: 0, flex: 1 }}>
              {action.description}
            </p>
            <button
              onClick={() => navigate(action.link)}
              style={{
                alignSelf: 'flex-start', padding: '6px 16px', borderRadius: 6,
                background: hoveredIdx === idx ? C.accent : C.bg3,
                border: hoveredIdx === idx ? 'none' : `1px solid ${C.muted}`,
                color: hoveredIdx === idx ? '#000' : C.text,
                cursor: 'pointer', fontFamily: F.body, fontSize: 12, fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              Go
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { stats, loading, error } = useDashboard();

  if (loading) return <LoadingSpinner />;

  const recentOrderColumns: Column<RecentOrder>[] = [
    { key: 'recipientName', header: 'Recipient' },
    { key: 'packageCount', header: 'Pkgs', width: 60 },
    { key: 'priority', header: 'Priority', render: (o) => <Badge color={priorityColors[o.priority]}>{o.priority}</Badge> },
    { key: 'status', header: 'Status', render: (o) => <Badge color={statusColors[o.status]}>{o.status.replace('_', ' ')}</Badge> },
    { key: 'createdAt', header: 'Created', render: (o) => new Date(o.createdAt).toLocaleDateString() },
  ];

  const hasData = stats && (stats.totalVehicles > 0 || stats.ordersToday > 0);
  const industry = user?.industry;
  const showQuickActions = industry
    && INDUSTRY_QUICK_ACTIONS[industry]
    && (stats ? stats.ordersToday < 5 : true);
  const summaryLine = stats && stats.ordersToday > 0
    ? `${stats.ordersToday} orders moving through today's dispatch window.`
    : 'Set up the essentials, then start routing live work.';

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto' }}>
      <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>
        Welcome back, {user?.name?.split(' ')[0]}
      </h2>
      <p style={{ color: C.dim, marginBottom: 20 }}>{summaryLine}</p>

      <OnboardingWizard />

      {error && (
        <div style={{
          background: alpha(C.red, 0.1), border: `1px solid ${C.red}`,
          color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>{error}</div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KPICard icon={'\u{1F5FA}\uFE0F'} label="Active Routes" value={stats?.activeRoutes ?? 0} color={C.accent} />
        <KPICard icon={'\u{1F4E6}'} label="Orders Today" value={stats?.ordersToday ?? 0} color={C.green} />
        <KPICard icon={'\u{1F464}'} label="Active Drivers" value={stats?.activeDrivers ?? 0} color={C.yellow} />
        <KPICard icon={'\u2705'} label="Delivery Rate" value={stats?.deliveryRate != null ? `${stats.deliveryRate}%` : '\u2014'} color={C.purple}
          sub={stats?.totalVehicles ? `${stats.totalVehicles} vehicles in fleet` : undefined} />
      </div>

      {/* Industry Quick Actions — shown for new users */}
      {showQuickActions && (
        <QuickActionsSection industry={industry} ordersToday={stats?.ordersToday ?? 0} />
      )}

      {/* Intelligence Widget */}
      <div style={{ marginBottom: 32 }}>
        <IntelligenceWidget />
      </div>

      {/* Recent orders or empty state */}
      {hasData ? (
        <div style={{ background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: F.display, fontSize: 16, margin: 0 }}>Recent Orders</h3>
            <button onClick={() => navigate('/dashboard/orders')} style={{
              background: 'none', border: 'none', color: C.accent, cursor: 'pointer',
              fontSize: 13, fontFamily: F.body,
            }}>View all \u2192</button>
          </div>
          {stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <DataTable columns={recentOrderColumns} data={stats.recentOrders} />
          ) : (
            <p style={{ color: C.dim, fontSize: 14, textAlign: 'center', padding: 24 }}>No recent orders</p>
          )}
        </div>
      ) : (
        <div style={{
          padding: 40, background: C.bg2, borderRadius: 12,
          border: `1px solid ${C.muted}`, textAlign: 'center',
        }}>
          <p style={{ fontSize: 16, marginBottom: 8, color: C.text }}>
            Get started with HOMER.io
          </p>
          <p style={{ color: C.dim, fontSize: 14, marginBottom: 24 }}>
            Set up your fleet, import orders, and create optimized routes.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/dashboard/fleet/vehicles')} style={ctaBtnStyle}>
              {'\u{1F69B}'} Add Vehicle
            </button>
            <button onClick={() => navigate('/dashboard/orders')} style={ctaBtnStyle}>
              {'\u{1F4E6}'} Import Orders
            </button>
            <button onClick={() => navigate('/dashboard/routes/new')} style={ctaBtnStyle}>
              {'\u{1F5FA}\uFE0F'} Create Route
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ctaBtnStyle: React.CSSProperties = {
  padding: '12px 24px', borderRadius: 10, background: C.bg3,
  border: `1px solid ${C.muted}`, color: C.text, cursor: 'pointer',
  fontFamily: F.body, fontSize: 14, fontWeight: 500,
};
