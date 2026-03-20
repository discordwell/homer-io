import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

/**
 * Root index — redirects based on auth state and role.
 * Prevents flash of login screen for already-authenticated users.
 */
export default function Index() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user?.role === 'driver') {
    return <Redirect href="/(driver)/route" />;
  }

  return <Redirect href="/(dispatch)/dashboard" />;
}
