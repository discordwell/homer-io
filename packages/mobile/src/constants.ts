import Constants from 'expo-constants';

/**
 * API base URL — points to the HOMER API server.
 * In development, use the local machine's IP (not localhost, since the
 * app runs on a device/simulator that can't resolve localhost to the host machine).
 */
export const API_BASE =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://api.homer.io';

export const WS_URL =
  Constants.expoConfig?.extra?.wsUrl ?? 'https://api.homer.io';

/** Socket.IO namespace for fleet tracking */
export const WS_NAMESPACE = '/fleet';

/** Background location task name (registered with TaskManager) */
export const LOCATION_TASK_NAME = 'homer-background-location';

/** Push notification channel IDs (Android) */
export const NotificationChannels = {
  deliveries: 'deliveries',
  chat: 'chat',
  system: 'system',
} as const;
