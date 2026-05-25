import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mc_access_token';

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAuthStorage(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
