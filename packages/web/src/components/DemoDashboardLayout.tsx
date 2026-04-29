import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { DemoBanner } from './DemoBanner.js';
import { AIChatPanel } from './AIChatPanel.js';
import { DemoEmailGate } from './DemoEmailGate.js';
import { useDemoStore } from '../stores/demo.js';
import { useAuthStore } from '../stores/auth.js';
import { C } from '../theme.js';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${breakpoint}px)`).matches
      : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

/**
 * Dashboard layout for public demo mode.
 * - Shows email gate overlay until user provides an email.
 * - Once provisioned, renders the full dashboard with real tenant data.
 * - Shows a persistent DemoBanner at the top.
 * - Includes <AIChatPanel /> with warming-up state during provisioning.
 */
export function DemoDashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const enterDemo = useDemoStore((s) => s.enterDemo);
  const exitDemo = useDemoStore((s) => s.exitDemo);
  const demoEmail = useDemoStore((s) => s.demoEmail);
  const logout = useAuthStore((s) => s.logout);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Close mobile sidebar on route change — adjust state during render.
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setMobileSidebarOpen(false);
  }

  // Close mobile sidebar on Escape
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileSidebarOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileSidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileSidebarOpen]);

  const handleSidebarToggle = useCallback(() => {
    if (isMobile) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  useEffect(() => {
    // Enter demo mode (provisioning happens on email submit via DemoEmailGate)
    enterDemo();

    return () => {
      exitDemo();
      logout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show email gate until user submits email and provisioning succeeds
  if (!demoEmail) {
    return <DemoEmailGate />;
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Demo banner — always at top */}
      <DemoBanner />

      {/* Top nav */}
      <header className="topnav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="mobile-menu-toggle"
            onClick={handleSidebarToggle}
            aria-label="Toggle navigation menu"
          >
            {mobileSidebarOpen ? '\u2715' : '\u2630'}
          </button>
          <Link to="/demo" className="topnav-logo">
            HOMER<span className="dot">.</span>
          </Link>
        </div>
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

      {/* Mobile sidebar backdrop */}
      {isMobile && mobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — use demo-aware paths */}
      <DemoSidebar
        collapsed={isMobile ? false : sidebarCollapsed}
        onToggle={handleSidebarToggle}
        mobileOpen={mobileSidebarOpen}
      />

      {/* Main content */}
      <div
        className="demo-main"
        style={{
          marginLeft: isMobile ? 0 : (sidebarCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)'),
          paddingTop: 'calc(var(--topnav-h) + 41px)',
          transition: 'margin-left 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <main style={{ flex: 1, padding: `20px var(--page-pad) var(--page-pad)`, overflow: 'auto', height: 'calc(100vh - var(--topnav-h) - 41px)' }}>
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

function DemoSidebar({ collapsed, onToggle, mobileOpen }: { collapsed: boolean; onToggle: () => void; mobileOpen?: boolean }) {
  const location = useLocation();
  const [fleetOpen, setFleetOpen] = useState(location.pathname.includes('/fleet'));

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} style={{ top: 'calc(var(--topnav-h) + 41px)' }}>
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
