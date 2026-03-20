import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LOCATION_TASK_NAME } from '@/constants';
import { api } from '@/api/client';

interface LocationTaskData {
  locations: Location.LocationObject[];
}

// Define the background task — this runs even when the app is backgrounded
TaskManager.defineTask<LocationTaskData>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[GPS] Background location error:', error.message);
    return;
  }
  if (!data?.locations?.length) return;

  const location = data.locations[data.locations.length - 1]; // Most recent
  try {
    await api.post('/tracking/location', {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: new Date(location.timestamp).toISOString(),
    });
  } catch (err) {
    // Silently fail — location updates are best-effort
    console.warn('[GPS] Failed to post location:', err);
  }
});

/** Request permissions and start background location tracking */
export async function startLocationTracking(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    console.warn('[GPS] Foreground location permission denied');
    return false;
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    console.warn('[GPS] Background location permission denied');
    return false;
  }

  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTracking) {
    console.log('[GPS] Already tracking');
    return true;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 50,        // meters — update when moved 50m
    timeInterval: 10_000,        // 10 seconds minimum between updates
    showsBackgroundLocationIndicator: true, // iOS blue bar
    foregroundService: {         // Android persistent notification
      notificationTitle: 'HOMER',
      notificationBody: 'Tracking your location for deliveries',
      notificationColor: '#F59E0B',
    },
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  console.log('[GPS] Background location tracking started');
  return true;
}

/** Stop background location tracking */
export async function stopLocationTracking(): Promise<void> {
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (isTracking) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('[GPS] Background location tracking stopped');
  }
}

/** Check if background location tracking is currently active */
export async function isLocationTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}
