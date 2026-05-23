import * as Notifications from 'expo-notifications';
import client from './client';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Platform.OS.match(/ios|android/)) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return null;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  if (!token) return null;
  await client.post('/notifications/register', {
    deviceToken: token,
    platform: Platform.OS,
  });
  return token;
}

export async function unregisterPush(): Promise<void> {
  try {
    await client.delete('/notifications/unregister');
  } catch {
    // ignore
  }
}
