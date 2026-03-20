import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { AIChatPanel } from './AIChatPanel.js';
import { NotificationCenter } from './NotificationCenter.js';
import { SubscriptionBanner } from './SubscriptionBanner.js';
import { OnboardingWizard } from './OnboardingWizard.js';
import { BillingBlockedModal } from './BillingBlockedModal.js';

export function DashboardLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top nav */}
      <header className="topnav">
        <Link to="/dashboard" className="topnav-logo">
          HOMER<span className="dot">.</span>
        </Link>
        <div className="topnav-right">
          <NotificationCenter />
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content */}
      <div style={{
        marginLeft: sidebarCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
        paddingTop: 'var(--topnav-h)',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <SubscriptionBanner />
        <main style={{ flex: 1, padding: '20px 32px 32px', overflow: 'auto' }}>
          <OnboardingWizard />
          <Outlet />
        </main>
      </div>

      <AIChatPanel />
      <BillingBlockedModal />
    </div>
  );
}
