import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useAuthStore } from './stores/auth.js';
import { LoadingSpinner } from './components/LoadingSpinner.js';
import { VERTICAL_CONTENT } from './components/landing-v2/vertical-content.js';
import { C, F } from './theme.js';
import { hasMinRole, type Role } from '@homer-io/shared';

const LandingPage = lazy(() => import('./pages/Landing.js').then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import('./pages/Login.js').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Register.js').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword.js').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPassword.js').then((module) => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmail.js').then((module) => ({ default: module.VerifyEmailPage })));
const OrgChoicePage = lazy(() => import('./pages/OrgChoice.js').then((module) => ({ default: module.OrgChoicePage })));
const DashboardLayout = lazy(() => import('./components/DashboardLayout.js').then((module) => ({ default: module.DashboardLayout })));
const DashboardPage = lazy(() => import('./pages/Dashboard.js').then((module) => ({ default: module.DashboardPage })));
const VehiclesPage = lazy(() => import('./pages/Vehicles.js').then((module) => ({ default: module.VehiclesPage })));
const DriversPage = lazy(() => import('./pages/Drivers.js').then((module) => ({ default: module.DriversPage })));
const OrdersPage = lazy(() => import('./pages/Orders.js').then((module) => ({ default: module.OrdersPage })));
const RoutesPage = lazy(() => import('./pages/Routes.js').then((module) => ({ default: module.RoutesPage })));
const RouteBuilderPage = lazy(() => import('./pages/RouteBuilder.js').then((module) => ({ default: module.RouteBuilderPage })));
const RouteDetailPage = lazy(() => import('./pages/RouteDetail.js').then((module) => ({ default: module.RouteDetailPage })));
const LiveMapPage = lazy(() => import('./pages/LiveMap.js'));
const AnalyticsPage = lazy(() => import('./pages/Analytics.js').then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/Settings.js').then((module) => ({ default: module.SettingsPage })));
const DispatchPage = lazy(() => import('./pages/Dispatch.js').then((module) => ({ default: module.DispatchPage })));
const PublicTrackingPage = lazy(() => import('./pages/PublicTracking.js').then((module) => ({ default: module.PublicTrackingPage })));
const DriverLayout = lazy(() => import('./components/DriverLayout.js').then((module) => ({ default: module.DriverLayout })));
const DriverRoutePage = lazy(() => import('./pages/driver/DriverRoute.js').then((module) => ({ default: module.DriverRoutePage })));
const DriverStopDetailPage = lazy(() => import('./pages/driver/DriverStopDetail.js').then((module) => ({ default: module.DriverStopDetailPage })));
const DriverMapPage = lazy(() => import('./pages/driver/DriverMap.js').then((module) => ({ default: module.DriverMapPage })));
const DriverProfilePage = lazy(() => import('./pages/driver/DriverProfile.js').then((module) => ({ default: module.DriverProfilePage })));
const MigrationPage = lazy(() => import('./pages/Migration.js').then((module) => ({ default: module.MigrationPage })));
const DemoDashboardLayout = lazy(() => import('./components/DemoDashboardLayout.js').then((module) => ({ default: module.DemoDashboardLayout })));
const DemoDashboardPage = lazy(() => import('./pages/DemoDashboard.js').then((module) => ({ default: module.DemoDashboardPage })));
const DemoOrdersPage = lazy(() => import('./pages/DemoOrders.js').then((module) => ({ default: module.DemoOrdersPage })));
const DemoRoutesPage = lazy(() => import('./pages/DemoRoutes.js').then((module) => ({ default: module.DemoRoutesPage })));
const DemoVehiclesPage = lazy(() => import('./pages/DemoFleet.js').then((module) => ({ default: module.DemoVehiclesPage })));
const DemoDriversPage = lazy(() => import('./pages/DemoFleet.js').then((module) => ({ default: module.DemoDriversPage })));
const DemoAnalyticsPage = lazy(() => import('./pages/DemoAnalytics.js').then((module) => ({ default: module.DemoAnalyticsPage })));
const VerticalLanding = lazy(() => import('./components/landing-v2/VerticalLanding.js').then((module) => ({ default: module.VerticalLanding })));
const PricingPage = lazy(() => import('./pages/Pricing.js').then((module) => ({ default: module.PricingPage })));
const MessagesPage = lazy(() => import('./pages/Messages.js').then((module) => ({ default: module.MessagesPage })));

function ProtectedRoute({
  children,
  requiredRole,
  exactRole,
}: {
  children: React.ReactNode;
  requiredRole?: Role;
  exactRole?: Role;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (exactRole && (!user || user.role !== exactRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (requiredRole && (!user || !hasMinRole(user.role, requiredRole))) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function CatchAllRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />;
}

function RouteFallback() {
  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <LoadingSpinner size={36} />
    </div>
  );
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
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="messages" element={<MessagesPage />} />
          <Route path="live" element={<LiveMapPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="migrate" element={<MigrationPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        {/* Driver PWA routes */}
        <Route path="/driver" element={
          <ProtectedRoute exactRole="driver"><DriverLayout /></ProtectedRoute>
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
      </Suspense>
    </div>
    </GoogleOAuthProvider>
  );
}
