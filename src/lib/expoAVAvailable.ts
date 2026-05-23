/**
 * Check if expo-av native module (ExponentAV) is available.
 * Returns false when using Expo Go (avoids native crash) or when native modules aren't linked.
 */
import Constants from 'expo-constants';

let cached: boolean | null = null;

export function isExpoAVAvailable(): boolean {
  if (cached !== null) return cached;
  // In Expo Go, ExponentAV is not available and requireNativeModule can crash the app.
  // Avoid calling it entirely when we know we're in Expo Go.
  const isExpoGo =
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo';
  if (isExpoGo) {
    cached = false;
    return cached;
  }
  try {
    const { requireNativeModule } = require('expo-modules-core');
    requireNativeModule('ExponentAV');
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
