import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './driver/BottomTabBar.js';

export function DriverLayout() {
  return (
    <div className="driver-app" style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
    }}>
      <main style={{
        flex: 1,
        overflow: 'auto',
        paddingBottom: 64,
      }}>
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
