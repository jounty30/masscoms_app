import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { AppState, type AppStateStatus } from 'react-native';
import type { User, UserRole } from '../types/api';
import { login as apiLogin, logout as apiLogout, getMe } from '../api/auth';
import { getStoredToken, clearAuthStorage } from './storage';
import { setUnauthorizedHandler } from '../api/client';
import { registerForPushNotifications, unregisterPush } from '../api/notifications';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsBiometricUnlock: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginAsDev: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  unlockWithBiometrics: () => void;
  refreshSessionActivity: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(data: unknown): User {
  if (!data || typeof data !== 'object') {
    throw new Error('Unexpected login response shape: ' + JSON.stringify(data));
  }
  const d = data as Record<string, unknown>;
  if (!d.id) {
    console.error('[auth] toUser received unexpected shape:', JSON.stringify(data));
    throw new Error('Unexpected login response shape: ' + JSON.stringify(data));
  }
  const orgId = ((d.orgId ?? d.organizationCode ?? d.organization ?? '') as string);
  const name = ((d.name ?? d.displayName ?? (d.email as string | undefined)?.split('@')[0] ?? '') as string);
  return {
    id: d.id as string,
    name,
    email: d.email as string,
    role: d.role as UserRole,
    organization: ((d.organization ?? orgId) as string),
    organizationCode: ((d.organizationCode ?? orgId) as string),
    orgId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const isDevFallbackRef = useRef(false);

  // Restore session from stored token on launch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(toUser(me));
          setBiometricUnlocked(false);
        }
      } catch {
        await clearAuthStorage();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Force logout when server returns 401
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setBiometricUnlocked(false);
    });
  }, []);

  // Only reset on background — inactive is used by Face ID dialog
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background') {
        setBiometricUnlocked(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications().catch(() => {});
  }, [user?.id]);

  const logout = useCallback(async () => {
    await unregisterPush();
    await apiLogout();
    setUser(null);
    setBiometricUnlocked(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { user: apiUser } = await apiLogin(email, password);
      isDevFallbackRef.current = false;
      setUser(toUser(apiUser));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginAsDev = useCallback(async (email: string) => {
    isDevFallbackRef.current = true;
    setUser(toUser({
      id: 'dev-simulator-user',
      email,
      name: email.split('@')[0] || 'Dev User',
      role: 'safety-officer' as UserRole,
      orgId: 'masscoms-org',
    }));
    setIsLoading(false);
  }, []);

  const unlockWithBiometrics = useCallback(() => setBiometricUnlocked(true), []);

  const refreshSessionActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user || isDevFallbackRef.current) return;
    const interval = setInterval(async () => {
      if (Date.now() - lastActivityRef.current > SESSION_TIMEOUT_MS) {
        await unregisterPush().catch(() => {});
        await apiLogout();
        setUser(null);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const skipBiometrics = !Constants.isDevice || process.env.EXPO_PUBLIC_SKIP_BIOMETRICS === '1';
  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user && (skipBiometrics || biometricUnlocked),
    needsBiometricUnlock: !!user && !biometricUnlocked && !skipBiometrics,
    login,
    loginAsDev,
    logout,
    unlockWithBiometrics,
    refreshSessionActivity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
