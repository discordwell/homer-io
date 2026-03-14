import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { AIChatPanel } from './AIChatPanel.js';
import { NotificationCenter } from './NotificationCenter.js';

export function DashboardLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '12px 32px 0', flexShrink: 0,
        }}>
          <NotificationCenter />
        </header>
        <main style={{ flex: 1, padding: '16px 32px 32px', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
      <AIChatPanel />
    </div>
  );
}
