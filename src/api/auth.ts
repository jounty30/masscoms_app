import client from './client';
import type { User } from '../types/api';
import { setStoredToken, clearAuthStorage } from '../auth/storage';
import { API_BASE_URL } from '../config/env';

export async function login(email: string, password: string): Promise<{ user: User }> {
  console.log('[auth] POST', `${API_BASE_URL}/v1/auth/login`);
  const response = await client.post<{
    accessToken: string;
    refreshToken: string;
    orgId: string;
    role: string;
    orgs: { orgId: string; name: string; role: string }[];
  }>('/v1/auth/login', { email, password });
  const data = response.data;
  if (!data?.accessToken) {
    console.error('[auth] unexpected login response shape');
    throw new Error('Unexpected login response shape: ' + JSON.stringify(data));
  }
  await setStoredToken(data.accessToken);
  const user = await getMe();
  return { user };
}

export async function getMe(): Promise<User> {
  const { data } = await client.get<User>('/v1/users/me');
  return data;
}

export async function logout(): Promise<void> {
  try {
    await client.delete('/v1/auth/logout');
  } catch {
    // best effort
  }
  await clearAuthStorage();
}
