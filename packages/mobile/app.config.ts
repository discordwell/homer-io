import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'HOMER',
  slug: 'homer-io',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  scheme: 'homer',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#06090F',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'io.homer.mobile',
    infoPlist: {
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'HOMER tracks your location during deliveries to provide real-time fleet visibility and accurate ETAs.',
      NSLocationWhenInUseUsageDescription:
        'HOMER uses your location to show your position on the map and navigate to delivery stops.',
      NSCameraUsageDescription:
        'HOMER uses the camera to capture proof-of-delivery photos.',
      NSFaceIDUsageDescription:
        'Use Face ID to quickly unlock HOMER.',
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'io.homer.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: '#06090F',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'CAMERA',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'HOMER tracks your location during deliveries to provide real-time fleet visibility and accurate ETAs.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'HOMER uses the camera to capture proof-of-delivery photos.',
        photosPermission: 'HOMER accesses photos to attach proof-of-delivery images.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#F59E0B',
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Use Face ID to quickly unlock HOMER.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'homer-io',
    },
  },
});
