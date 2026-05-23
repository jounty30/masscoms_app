/**
 * Expo app config. Ensures production API URL and iOS permissions are set for all builds.
 * For EAS: env vars from eas.json (e.g. EXPO_PUBLIC_API_BASE_URL) are injected at build time.
 * For local Xcode: we default to production API URL.
 */
const PRODUCTION_API = 'https://us-central1-masscoms.cloudfunctions.net/api/v1';

export default {
  expo: {
    name: 'masscoms-mobile',
    slug: 'masscoms-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.awecreative.masscoms-mobile',
      googleServicesFile: './GoogleService-Info.plist',
      infoPlist: {
        NSMicrophoneUsageDescription:
          'Allow Mass Coms to access your microphone for Live PA broadcasts.',
      },
    },
    android: {
      package: 'com.awecreative.masscomsmobile',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.USE_BIOMETRIC',
        'android.permission.USE_FINGERPRINT',
      ],
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-secure-store',
      [
        'expo-audio',
        {
          microphonePermission:
            'Allow Mass Coms to access your microphone for Live PA broadcasts.',
        },
      ],
      [
        'expo-local-authentication',
        {
          faceIDPermission:
            'Allow Mass Coms to verify your identity before triggering an incident.',
        },
      ],
      'expo-notifications',
    ],
    extra: {
      API_BASE_URL:
        process.env.EXPO_PUBLIC_API_BASE_URL ?? PRODUCTION_API,
      WS_URL:
        process.env.EXPO_PUBLIC_WS_URL ?? 'wss://us-central1-masscoms.cloudfunctions.net/ws',
    },
  },
};
