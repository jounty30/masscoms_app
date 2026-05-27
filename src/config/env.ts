// API and WebSocket base URLs. For local backend use your machine IP (not localhost) for device/simulator.
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const API_BASE_URL = extra?.API_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://admin.masscoms.com';
export const WS_URL = extra?.WS_URL ?? process.env.EXPO_PUBLIC_WS_URL ?? 'wss://admin.masscoms.com/ws';
