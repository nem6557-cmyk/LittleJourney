import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LittleJourney',
  slug: 'LittleJourney',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#6C63FF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.littlejourney.app',
    infoPlist: {
      NSCameraUsageDescription: 'LittleJourney needs camera access to take photos of activities.',
      NSPhotoLibraryUsageDescription: 'LittleJourney needs photo library access to share activity photos.',
      NSPhotoLibraryAddUsageDescription: 'LittleJourney needs access to save photos to your library.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#6C63FF',
    },
    package: 'com.littlejourney.app',
    edgeToEdgeEnabled: true,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#6C63FF',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
  updates: {
    url: 'https://u.expo.dev/your-eas-project-id',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  scheme: 'littlejourney',
});
