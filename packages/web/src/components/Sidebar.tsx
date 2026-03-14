import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { C, F } from '../theme.js';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  {
    label: 'Fleet', icon: '🚛', children: [
      { label: 'Vehicles', path: '/dashboard/fleet/vehicles' },
      { label: 'Drivers', path: '/dashboard/fleet/drivers' },
    ],
  },
  { label: 'Orders', path: '/dashboard/orders', icon: '📦' },
  { label: 'Routes', path: '/dashboard/routes', icon: '🗺️' },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const [fleetOpen, setFleetOpen] = useState(location.pathname.includes('/fleet'));

  return (
    <nav style={{
      width: 240, background: C.bg2, borderRight: `1px solid ${C.muted}`,
      padding: '24px 16px', display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      <h1 style={{
        fontFamily: F.display, fontSize: 22, color: C.accent,
        marginBottom: 32, paddingLeft: 8,
      }}>
        HOMER.io
      </h1>

      {navItems.map((item) =>
        item.children ? (
          <div key={item.label}>
            <div
              onClick={() => setFleetOpen(!fleetOpen)}
              style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                color: location.pathname.includes('/fleet') ? C.text : C.dim,
                fontSize: 14, fontWeight: location.pathname.includes('/fleet') ? 500 : 400,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                background: location.pathname.includes('/fleet') ? C.bg3 : 'transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
              <span style={{ marginLeft: 'auto', fontSize: 10, transition: 'transform 0.2s', transform: fleetOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
            </div>
            {fleetOpen && (
              <div style={{ paddingLeft: 20 }}>
                {item.children.map((child) => (
                  <NavLink key={child.path} to={child.path} style={({ isActive }) => ({
                    display: 'block', padding: '8px 12px', borderRadius: 6, marginBottom: 2,
                    background: isActive ? C.bg3 : 'transparent',
                    color: isActive ? C.text : C.dim,
                    fontSize: 13, fontWeight: isActive ? 500 : 400,
                    textDecoration: 'none',
                  })}>
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink key={item.path} to={item.path!} end={item.path === '/dashboard'} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8, marginBottom: 2,
            background: isActive ? C.bg3 : 'transparent',
            color: isActive ? C.text : C.dim,
            fontSize: 14, fontWeight: isActive ? 500 : 400,
            textDecoration: 'none',
          })}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ),
      )}

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
  );
}
