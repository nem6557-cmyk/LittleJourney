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
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhoneNumber',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeHealth',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDiagnosticData',
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
        data: [{ scheme: 'littlejourney' }],
        category: ['DEFAULT', 'BROWSABLE'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: 'littlejourney.app' }],
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
    'expo-font',
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
      'expo-media-library',
      {
        photosPermission: 'LittleJourney needs photo library access to save your child\'s photos.',
        savePhotosPermission: 'LittleJourney needs permission to save photos to your library.',
        isAccessMediaLocationEnabled: false,
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'LittleJourney uses Face ID to secure access to your account.',
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
