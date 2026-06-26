import { ExpoConfig, ConfigContext } from 'expo/config';

// Single source of truth for Expo config. (app.json is intentionally minimal —
// everything dynamic/env-driven lives here so deep-link, plugin, and permission
// settings can never be silently dropped by a second config file.)

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '65cb7e55-095b-440f-9340-dfe489247b67';
const APP_VERSION = '1.0.0';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LittleJourney',
  slug: 'LittleJourney',
  version: APP_VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  scheme: 'littlejourney',
  description:
    'A modern daycare management app connecting parents, caregivers, and administrators with real-time updates, secure messaging, and activity tracking.',
  githubUrl: 'https://github.com/nem6557-cmyk/LittleJourney',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#6C63FF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.littlejourney.app',
    // Universal Links (deep linking) — must survive into the real build.
    associatedDomains: ['applinks:littlejourney.app'],
    infoPlist: {
      NSCameraUsageDescription: 'LittleJourney needs camera access to take photos of activities.',
      NSPhotoLibraryUsageDescription: 'LittleJourney needs photo library access to share activity photos.',
      NSPhotoLibraryAddUsageDescription: 'LittleJourney needs access to save photos to your library.',
      // TLS-only app — declare export-compliance up front so App Store / TestFlight
      // submissions don't stall on the encryption question.
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
      ],
      NSPrivacyTracking: false,
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
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      // Android 13+ runtime notification permission (push is used).
      'POST_NOTIFICATIONS',
    ],
    // App Links (deep linking) — must survive into the real build.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'littlejourney' }],
        category: ['DEFAULT', 'BROWSABLE'],
      },
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
    [
      'expo-image-picker',
      {
        photosPermission: 'LittleJourney needs photo library access to share activity photos.',
        cameraPermission: 'LittleJourney needs camera access to take photos of activities.',
      },
    ],
    [
      '@stripe/stripe-react-native',
      {
        merchantIdentifier: 'merchant.com.littlejourney.app',
        enableGooglePay: true,
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        organization: process.env.SENTRY_ORG || 'rochester-institute-of-tech-70',
        project: process.env.SENTRY_PROJECT || 'littlejourney',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
});
