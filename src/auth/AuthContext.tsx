/**
 * Auth backed by the same Firebase as the Mass Coms dashboard.
 * Email/password login; user and orgId from Firebase Auth + custom claims.
 * Biometric verification required for all logins and when app returns from background.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';
import { AppState, type AppStateStatus } from 'react-native';
import type { User, UserRole } from '../types/api';
import { signIn as firebaseSignIn, signOut as firebaseSignOut, subscribeToAuth } from '../lib/firebaseAuth';
import { clearAuthStorage } from './storage';
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

function toUser(fb: { id: string; email: string; name: string; role: UserRole; orgId: string }): User {
  return {
    id: fb.id,
    name: fb.name,
    email: fb.email,
    role: fb.role,
    organization: fb.orgId,
    organizationCode: fb.orgId,
    orgId: fb.orgId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [biometricUnlocked, setBiometricUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());
  const isDevFallbackRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((fbUser) => {
      if (!fbUser && isDevFallbackRef.current) {
        setIsLoading(false);
        return;
      }
      setUser(fbUser ? toUser(fbUser) : null);
      setBiometricUnlocked(false);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      // Only reset on background - NOT inactive. Face ID dialog puts app in "inactive",
      // which would unmount screens mid-flow (e.g. during trigger). We only want to
      // re-lock when the user actually leaves the app.
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
    await firebaseSignOut();
    await clearAuthStorage();
    setUser(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const fbUser = await firebaseSignIn(email, password);
      isDevFallbackRef.current = fbUser.id === 'dev-simulator-user';
      setUser(toUser(fbUser));
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

  const unlockWithBiometrics = useCallback(() => {
    setBiometricUnlocked(true);
  }, []);

  const refreshSessionActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > SESSION_TIMEOUT_MS) {
        unregisterPush().catch(() => {});
        clearAuthStorage();
        firebaseSignOut();
        setUser(null);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Skip biometrics only on simulator/emulator. Real devices always require auth, even in dev builds.
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
