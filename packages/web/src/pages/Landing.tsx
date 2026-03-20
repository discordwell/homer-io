import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { HomePage } from '../components/landing-v2/HomePage.js';

export function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}
