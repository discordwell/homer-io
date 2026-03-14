import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.js';
import { LoginPage } from './pages/Login.js';
import { RegisterPage } from './pages/Register.js';
import { DashboardPage } from './pages/Dashboard.js';
import { VehiclesPage } from './pages/Vehicles.js';
import { DriversPage } from './pages/Drivers.js';
import { OrdersPage } from './pages/Orders.js';
import { RoutesPage } from './pages/Routes.js';
import { RouteBuilderPage } from './pages/RouteBuilder.js';
import { RouteDetailPage } from './pages/RouteDetail.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { C, F } from './theme.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: F.body,
    }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardLayout /></ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="fleet/vehicles" element={<VehiclesPage />} />
          <Route path="fleet/drivers" element={<DriversPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="routes" element={<RoutesPage />} />
          <Route path="routes/new" element={<RouteBuilderPage />} />
          <Route path="routes/:id" element={<RouteDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}
