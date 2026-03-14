import { useAuthStore } from '../stores/auth.js';
import { C, F } from '../theme.js';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 240, background: C.bg2, borderRight: `1px solid ${C.muted}`,
        padding: '24px 16px', display: 'flex', flexDirection: 'column',
      }}>
        <h1 style={{
          fontFamily: F.display, fontSize: 22, color: C.accent,
          marginBottom: 32, paddingLeft: 8,
        }}>
          HOMER.io
        </h1>

        <NavItem label="Dashboard" active />
        <NavItem label="Fleet" />
        <NavItem label="Orders" />
        <NavItem label="Routes" />
        <NavItem label="Analytics" />

        <div style={{ flex: 1 }} />

        <div style={{
          padding: 12, borderRadius: 8, background: C.bg3,
          marginTop: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{user?.role}</div>
          <button onClick={logout} style={{
            marginTop: 8, fontSize: 12, color: C.red, background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, fontFamily: F.body,
          }}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, padding: 32 }}>
        <h2 style={{ fontFamily: F.display, fontSize: 24, marginBottom: 8 }}>
          Welcome back, {user?.name?.split(' ')[0]}
        </h2>
        <p style={{ color: C.dim, marginBottom: 32 }}>
          Your logistics command center
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        }}>
          <KPI label="Active Routes" value="0" />
          <KPI label="Orders Today" value="0" />
          <KPI label="Active Drivers" value="0" />
          <KPI label="Delivery Rate" value="--%" />
        </div>

        <div style={{
          marginTop: 32, padding: 32, background: C.bg2,
          borderRadius: 12, border: `1px solid ${C.muted}`,
          textAlign: 'center', color: C.dim,
        }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>
            Start by adding vehicles and drivers to your fleet.
          </p>
          <p style={{ fontSize: 14 }}>
            Then import orders and create optimized routes.
          </p>
        </div>
      </main>
    </div>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 4,
      background: active ? C.bg3 : 'transparent',
      color: active ? C.text : C.dim,
      fontSize: 14, fontWeight: active ? 500 : 400,
      cursor: 'pointer',
    }}>
      {label}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: C.bg2, borderRadius: 12, padding: 20,
      border: `1px solid ${C.muted}`,
    }}>
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, fontFamily: F.display }}>{value}</div>
    </div>
  );
}
