import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { AIChatPanel } from './AIChatPanel.js';

export function DashboardLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32, overflow: 'auto' }}>
        <Outlet />
      </main>
      <AIChatPanel />
    </div>
  );
}
