/**
 * Check if expo-audio native module is available.
 * Returns false in Expo Go (ExpoAudio may not be in all Expo Go versions).
 */
import Constants from 'expo-constants';

let cached: boolean | null = null;

export function isExpoAudioAvailable(): boolean {
  if (cached !== null) return cached;
  const isExpoGo =
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo';
  if (isExpoGo) {
    cached = false;
    return cached;
  }
  try {
    const { requireNativeModule } = require('expo-modules-core');
    requireNativeModule('ExpoAudio');
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
