import client from './client';
import type { User, LoginResponse, VerifyOtpResponse } from '../types/api';
import { setStoredToken, setStoredRefreshToken, setStoredUser, clearAuthStorage } from '../auth/storage';

export async function requestOtp(identifier: string, organizationCode?: string): Promise<LoginResponse> {
  const { data } = await client.post<LoginResponse>('/auth/login', {
    identifier,
    ...(organizationCode && { organizationCode }),
  });
  return data;
}

export async function verifyOtp(identifier: string, otp: string): Promise<VerifyOtpResponse> {
  const { data } = await client.post<VerifyOtpResponse>('/auth/verify-otp', {
    identifier,
    otp,
  });
  await setStoredToken(data.token);
  await setStoredRefreshToken(data.refreshToken);
  await setStoredUser(data.user);
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await client.get<User>('/auth/user');
  return data;
}

export async function logout(): Promise<void> {
  try {
    await client.post('/auth/logout');
  } catch {
    // ignore
  }
  await clearAuthStorage();
}
