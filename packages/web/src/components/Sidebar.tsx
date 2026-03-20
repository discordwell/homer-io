import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { useMessagesStore } from '../stores/messages.js';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '\u{1F4CA}' },
  { label: 'Live Map', path: '/dashboard/live', icon: '\u{1F4E1}', pulse: true },
  {
    label: 'Fleet', icon: '\u{1F69B}', children: [
      { label: 'Vehicles', path: '/dashboard/fleet/vehicles' },
      { label: 'Drivers', path: '/dashboard/fleet/drivers' },
    ],
  },
  { label: 'Orders', path: '/dashboard/orders', icon: '\u{1F4E6}' },
  { label: 'Routes', path: '/dashboard/routes', icon: '\u{1F5FA}\uFE0F' },
  { label: 'Dispatch', path: '/dashboard/dispatch', icon: '\u2699' },
  { label: 'Messages', path: '/dashboard/messages', icon: '\u{1F4AC}', badge: true },
  { label: 'Analytics', path: '/dashboard/analytics', icon: '\u{1F4C8}' },
  { label: 'Migrate', path: '/dashboard/migrate', icon: '\u{1F504}' },
  { label: 'Settings', path: '/dashboard/settings', icon: '\u2699\uFE0F' },
];

export function Sidebar({ collapsed, onToggle, mobileOpen }: { collapsed: boolean; onToggle: () => void; mobileOpen?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const [fleetOpen, setFleetOpen] = useState(location.pathname.includes('/fleet'));
  const unreadCount = useMessagesStore((s) => s.unreadCount);
  const fetchUnreadCount = useMessagesStore((s) => s.fetchUnreadCount);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchUnreadCount(); }, []);

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <button className="sidebar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>

      <div className="sidebar-nav">
        {navItems.map((item) =>
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
              end={item.path === '/dashboard'}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="icon" style={{ position: 'relative' }}>
                {item.icon}
                {'pulse' in item && item.pulse && (
                  <span className="live-dot" />
                )}
                {'badge' in item && item.badge && unreadCount > 0 && (
                  <span className="badge-count">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              <span className="label">{item.label}</span>
            </NavLink>
          ),
        )}
      </div>

      <div className="sidebar-user">
        <div className="name">{user?.name}</div>
        <div className="role">{user?.role}</div>
        <button className="signout" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
