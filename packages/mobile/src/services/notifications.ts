import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '@/api/client';
import { NotificationChannels } from '@/constants';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Register for push notifications and send the token to the backend */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('[Push] Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted');
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // Register with backend
  try {
    await api.post('/devices/register', {
      token,
      platform: Platform.OS,
    });
    console.log('[Push] Device registered:', token.substring(0, 20) + '...');
  } catch (err) {
    console.error('[Push] Failed to register device:', err);
  }

  // Set up Android notification channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NotificationChannels.deliveries, {
      name: 'Deliveries',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });

    await Notifications.setNotificationChannelAsync(NotificationChannels.chat, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });

    await Notifications.setNotificationChannelAsync(NotificationChannels.system, {
      name: 'System',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
}

/** Unregister device from push notifications (call on logout) */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    await api.delete('/devices/unregister');
  } catch (err) {
    console.warn('[Push] Failed to unregister device:', err);
  }
}

/** Add a listener for notification taps (returns cleanup function) */
export function onNotificationTap(
  handler: (data: Record<string, unknown>) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      handler(data);
    },
  );
  return () => subscription.remove();
}
