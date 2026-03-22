import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/auth.js';
import { LoginPage } from './pages/Login.js';
import { RegisterPage } from './pages/Register.js';
import { ForgotPasswordPage } from './pages/ForgotPassword.js';
import { ResetPasswordPage } from './pages/ResetPassword.js';
import { VerifyEmailPage } from './pages/VerifyEmail.js';
import { OrgChoicePage } from './pages/OrgChoice.js';
import { DashboardPage } from './pages/Dashboard.js';
import { VehiclesPage } from './pages/Vehicles.js';
import { DriversPage } from './pages/Drivers.js';
import { OrdersPage } from './pages/Orders.js';
import { RoutesPage } from './pages/Routes.js';
import { RouteBuilderPage } from './pages/RouteBuilder.js';
import { RouteDetailPage } from './pages/RouteDetail.js';
import LiveMapPage from './pages/LiveMap.js';
import { AnalyticsPage } from './pages/Analytics.js';
import { SettingsPage } from './pages/Settings.js';
import { DispatchPage } from './pages/Dispatch.js';
import { PublicTrackingPage } from './pages/PublicTracking.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { DriverLayout } from './components/DriverLayout.js';
import { DriverRoutePage } from './pages/driver/DriverRoute.js';
import { DriverStopDetailPage } from './pages/driver/DriverStopDetail.js';
import { DriverMapPage } from './pages/driver/DriverMap.js';
import { DriverProfilePage } from './pages/driver/DriverProfile.js';
import { MigrationPage } from './pages/Migration.js';
import { LandingPage } from './pages/Landing.js';
import { DemoDashboardLayout } from './components/DemoDashboardLayout.js';
import { DemoDashboardPage } from './pages/DemoDashboard.js';
import { DemoOrdersPage } from './pages/DemoOrders.js';
import { DemoRoutesPage } from './pages/DemoRoutes.js';
import { DemoVehiclesPage, DemoDriversPage } from './pages/DemoFleet.js';
import { DemoAnalyticsPage } from './pages/DemoAnalytics.js';
import { VerticalLanding } from './components/landing-v2/VerticalLanding.js';
import { VERTICAL_CONTENT } from './components/landing-v2/vertical-content.js';
import { PricingPage } from './pages/Pricing.js';
import { C, F } from './theme.js';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CatchAllRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

export function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: F.body,
    }}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/org-choice" element={<OrgChoicePage />} />
        <Route path="/track/:orderId" element={<PublicTrackingPage />} />
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
          <Route path="dispatch" element={<DispatchPage />} />
          <Route path="live" element={<LiveMapPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="migrate" element={<MigrationPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* Driver PWA routes */}
        <Route path="/driver" element={
          <ProtectedRoute><DriverLayout /></ProtectedRoute>
        }>
          <Route index element={<DriverRoutePage />} />
          <Route path="stop/:routeId/:orderId" element={<DriverStopDetailPage />} />
          <Route path="map" element={<DriverMapPage />} />
          <Route path="profile" element={<DriverProfilePage />} />
        </Route>
        {/* Public demo routes — no auth required */}
        <Route path="/demo" element={<DemoDashboardLayout />}>
          <Route index element={<DemoDashboardPage />} />
          <Route path="orders" element={<DemoOrdersPage />} />
          <Route path="routes" element={<DemoRoutesPage />} />
          <Route path="fleet/vehicles" element={<DemoVehiclesPage />} />
          <Route path="fleet/drivers" element={<DemoDriversPage />} />
          <Route path="analytics" element={<DemoAnalyticsPage />} />
          <Route path="live" element={<LiveMapPage />} />
        </Route>
        {/* Vertical landing pages */}
        <Route path="/cannabis" element={<VerticalLanding content={VERTICAL_CONTENT.cannabis} />} />
        <Route path="/florist" element={<VerticalLanding content={VERTICAL_CONTENT.florist} />} />
        <Route path="/pharmacy" element={<VerticalLanding content={VERTICAL_CONTENT.pharmacy} />} />
        <Route path="/restaurant" element={<VerticalLanding content={VERTICAL_CONTENT.restaurant} />} />
        <Route path="/grocery" element={<VerticalLanding content={VERTICAL_CONTENT.grocery} />} />
        <Route path="/furniture" element={<VerticalLanding content={VERTICAL_CONTENT.furniture} />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="*" element={<CatchAllRedirect />} />
      </Routes>
    </div>
    </GoogleOAuthProvider>
  );
}
