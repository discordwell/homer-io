import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { AIChatPanel } from './AIChatPanel.js';
import { NotificationCenter } from './NotificationCenter.js';
import { SubscriptionBanner } from './SubscriptionBanner.js';
import { BillingBlockedModal } from './BillingBlockedModal.js';
import { useAuthStore } from '../stores/auth.js';
import { C, alpha } from '../theme.js';

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

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
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

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top nav */}
      <header className="topnav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mobile hamburger */}
          <button
            className="mobile-menu-toggle"
            onClick={handleSidebarToggle}
            aria-label="Toggle navigation menu"
          >
            {mobileSidebarOpen ? '\u2715' : '\u2630'}
          </button>
          <Link to="/dashboard" className="topnav-logo">
            HOMER<span className="dot">.</span>
          </Link>
        </div>
        {user?.isDemo && (
          <span style={{
            background: alpha(C.accent, 0.15),
            color: C.accent,
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}>
            DEMO MODE
          </span>
        )}
        <div className="topnav-right">
          <NotificationCenter />
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

      {/* Sidebar */}
      <Sidebar
        collapsed={isMobile ? false : sidebarCollapsed}
        onToggle={handleSidebarToggle}
        mobileOpen={mobileSidebarOpen}
      />

      {/* Main content */}
      <div
        className="dashboard-main"
        style={{
          marginLeft: isMobile ? 0 : (sidebarCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)'),
          paddingTop: 'var(--topnav-h)',
          transition: 'margin-left 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <SubscriptionBanner />
        <main style={{ flex: 1, padding: `20px var(--page-pad) var(--page-pad)`, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>

      <AIChatPanel />
      <BillingBlockedModal />
    </div>
  );
}
