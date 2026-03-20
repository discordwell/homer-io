import { useEffect, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@/stores/auth';
import { onLogout } from '@/api/client';
import { startLocationTracking, stopLocationTracking } from '@/services/location';
import { registerForPushNotifications, unregisterPushNotifications, onNotificationTap } from '@/services/notifications';
import { isBiometricEnabled, authenticateWithBiometric, isBiometricAvailable } from '@/services/biometric';
import { startOfflineQueueSync, syncOfflineQueue } from '@/services/offline-queue';
import { handleNotificationDeepLink } from '@/services/deep-links';
import { useAppForeground } from '@/hooks/useAppState';
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
      if (user?.role === 'driver') {
        router.replace('/(driver)/route');
      } else {
        router.replace('/(dispatch)/dashboard');
      }
    }
  }, [isAuthenticated, hydrated, segments, user]);

  // Hide splash when hydrated
  useEffect(() => {
    if (hydrated) {
      SplashScreen.hideAsync();
    }
  }, [hydrated]);

  // --- Native services (only when authenticated) ---

  // Start GPS tracking for drivers
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'driver') return;
    startLocationTracking();
    return () => { stopLocationTracking(); };
  }, [isAuthenticated, user?.role]);

  // Register for push notifications
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications();
  }, [isAuthenticated]);

  // Handle push notification taps → deep link
  useEffect(() => {
    if (!isAuthenticated) return;
    return onNotificationTap(handleNotificationDeepLink);
  }, [isAuthenticated]);

  // Start offline POD queue sync listener
  useEffect(() => {
    if (!isAuthenticated) return;
    // Sync any queued items on startup
    syncOfflineQueue();
    // Auto-sync when connectivity is restored
    return startOfflineQueueSync();
  }, [isAuthenticated]);

  // Clean up push tokens on logout
  useEffect(() => {
    if (!isAuthenticated && hydrated) {
      unregisterPushNotifications();
    }
  }, [isAuthenticated, hydrated]);

  // Biometric lock on app resume
  const handleForeground = useCallback(async () => {
    if (!isAuthenticated || !isBiometricEnabled()) return;
    const available = await isBiometricAvailable();
    if (!available) return;

    const success = await authenticateWithBiometric();
    if (!success) {
      // User cancelled or failed — force re-login
      await logout();
    }
  }, [isAuthenticated, logout]);

  useAppForeground(handleForeground);

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
