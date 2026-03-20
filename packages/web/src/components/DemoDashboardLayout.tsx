import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useSearchParams, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { DemoBanner } from './DemoBanner.js';
import { AIChatPanel } from './AIChatPanel.js';
import { useDemoStore } from '../stores/demo.js';
import { useAuthStore } from '../stores/auth.js';
import { DEMO_USER } from '../data/demo-data.js';
import { C } from '../theme.js';

/**
 * Dashboard layout for public demo mode.
 * - Injects a synthetic demo user into the auth store so components that
 *   read user info (Sidebar, Dashboard greeting) work without real auth.
 * - Shows a persistent DemoBanner at the top.
 * - Kicks off background tenant provisioning for AI Copilot access.
 * - Includes <AIChatPanel /> with warming-up state during provisioning.
 */
export function DemoDashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchParams] = useSearchParams();
  const enterDemo = useDemoStore((s) => s.enterDemo);
  const exitDemo = useDemoStore((s) => s.exitDemo);
  const provisionTenant = useDemoStore((s) => s.provisionTenant);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    // Enter demo mode and inject synthetic user (instant browse)
    enterDemo();
    useAuthStore.getState().setAuth({
      accessToken: 'demo-token',
      refreshToken: 'demo-refresh',
      user: DEMO_USER,
    });

    // Background: provision real tenant for AI Copilot
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    provisionTenant(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
    );

    return () => {
      // Clean up on unmount — exit demo mode and clear synthetic auth
      exitDemo();
      logout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Demo banner — always at top */}
      <DemoBanner />

      {/* Top nav */}
      <header className="topnav">
        <Link to="/demo" className="topnav-logo">
          HOMER<span className="dot">.</span>
        </Link>
        <span style={{
          background: 'rgba(91, 164, 245, 0.15)',
          color: C.accent,
          padding: '4px 12px',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}>
          DEMO MODE
        </span>
        <div className="topnav-right">
          <Link
            to="/register"
            style={{
              background: C.accent,
              color: '#000',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign up free
          </Link>
        </div>
      </header>

      {/* Sidebar — use demo-aware paths */}
      <DemoSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content */}
      <div style={{
        marginLeft: sidebarCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
        paddingTop: 'calc(var(--topnav-h) + 41px)', /* extra height for demo banner */
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <main style={{ flex: 1, padding: '20px 32px 32px', overflow: 'auto', height: 'calc(100vh - var(--topnav-h) - 41px)' }}>
          <Outlet />
        </main>
      </div>

      {/* AI Copilot — available in demo with warming-up state */}
      <AIChatPanel />
    </div>
  );
}

// --- Demo-specific sidebar (no logout, links to /demo/* routes) ---

const demoNavItems = [
  { label: 'Dashboard', path: '/demo', icon: '\u{1F4CA}' },
  { label: 'Live Map', path: '/demo/live', icon: '\u{1F4E1}' },
  { label: 'Orders', path: '/demo/orders', icon: '\u{1F4E6}' },
  { label: 'Routes', path: '/demo/routes', icon: '\u{1F5FA}\uFE0F' },
  {
    label: 'Fleet', icon: '\u{1F69B}', children: [
      { label: 'Vehicles', path: '/demo/fleet/vehicles' },
      { label: 'Drivers', path: '/demo/fleet/drivers' },
    ],
  },
  { label: 'Analytics', path: '/demo/analytics', icon: '\u{1F4C8}' },
];

function DemoSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const [fleetOpen, setFleetOpen] = useState(location.pathname.includes('/fleet'));

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} style={{ top: 'calc(var(--topnav-h) + 41px)' }}>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>

      <div className="sidebar-nav">
        {demoNavItems.map((item) =>
          item.children ? (
            <div key={item.label}>
              <button
                className={`sidebar-expander${location.pathname.includes('/fleet') ? ' active' : ''}`}
                onClick={() => setFleetOpen(!fleetOpen)}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
                <span className={`arrow${fleetOpen ? ' open' : ''}`}>{'\u25B6'}</span>
              </button>
              {fleetOpen && (
                <div className="sidebar-sub">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.path}
                      to={child.path}
                      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    >
                      <span className="label">{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              key={item.path}
              to={item.path!}
              end={item.path === '/demo'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
            </NavLink>
          ),
        )}
      </div>

      <div className="sidebar-user">
        <div className="name">Demo User</div>
        <div className="role">Viewer</div>
        <Link
          to="/register"
          style={{
            color: C.accent,
            fontSize: 12,
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Sign up for full access
        </Link>
      </div>
    </nav>
  );
}
