import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/auth';
import { onLogout } from '@/api/client';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, hydrated, user, logout } = useAuthStore();

  // Listen for forced logout from API client (refresh token expired)
  useEffect(() => {
    return onLogout(() => {
      logout();
    });
  }, [logout]);

  // Auth-gated routing
  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to the correct home based on role
      if (user?.role === 'driver') {
        router.replace('/(driver)/route');
      } else {
        router.replace('/(dispatch)/dashboard');
      }
    }
  }, [isAuthenticated, hydrated, segments, user]);

  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync();
    }
  }, [hydrated]);

  return (
    <>
      <StatusBar style="light" backgroundColor={C.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(dispatch)" />
      </Stack>
    </>
  );
}
