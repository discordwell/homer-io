import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './driver/BottomTabBar.js';
import { C, F } from '../theme.js';

export function DriverLayout() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      maxHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: F.body,
      overflow: 'hidden',
    }}>
      <main style={{
        flex: 1,
        overflow: 'auto',
        paddingBottom: 64, // space for bottom tab bar
      }}>
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
