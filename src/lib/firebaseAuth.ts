/**
 * Auth against the same Firebase backend as the Mass Coms dashboard.
 * Uses email/password; roles from custom claims (orgId, role).
 */
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';
import type { UserRole } from '../types/api';

export interface FirebaseAuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
}

const DASHBOARD_TO_MOBILE_ROLE: Record<string, UserRole> = {
  superAdmin: 'safety-officer',
  responsiblePerson: 'slt',
  safetyOfficer: 'safety-officer',
  firstResponder: 'fire-warden',
  staff: 'staff',
};

function mapFirebaseUser(fb: FirebaseUser, claims: Record<string, unknown>): FirebaseAuthUser {
  const roleClaim = (claims.role as string) || (__DEV__ ? 'superAdmin' : 'staff');
  const role = DASHBOARD_TO_MOBILE_ROLE[roleClaim] || 'staff';
  return {
    id: fb.uid,
    email: fb.email || '',
    name: fb.displayName || fb.email?.split('@')[0] || 'User',
    role,
    orgId: (claims.orgId as string) || 'masscoms-org',
  };
}

/** Map Firebase Auth error codes to user-friendly messages. */
export function getAuthErrorMessage(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
  const message = err instanceof Error ? err.message : String(err ?? '');

  switch (code) {
    case 'auth/user-not-found':
      return 'No account found for this email. Use the same email and password as the Mass Coms web dashboard.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong password. Try again or use your dashboard password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return networkConnectionMessage;
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      // iOS can fail with "cannot parse response" / -1017 when VPN, proxy or simulator breaks the HTTPS response
      if (
        /cannot parse response|network|fetch|connection|ECONNREFUSED|ETIMEDOUT|-1017/i.test(message)
      ) {
        return networkConnectionMessage;
      }
      return err instanceof Error ? err.message : 'Login failed. Check your email and password.';
  }
}

const networkConnectionMessage =
  'Connection error (-1017). The simulator often fails to sign in to Firebase. Use a real device: connect your iPhone and run from Xcode to test login.';

function isNetworkError(err: unknown): boolean {
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
  if (code === 'auth/network-request-failed') return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /network|fetch|connection|ECONNREFUSED|ETIMEDOUT|-1017|cannot parse response/i.test(msg);
}

function devFallbackUser(email: string): FirebaseAuthUser {
  console.warn('[Auth] Using dev fallback user — Firebase Auth unreachable from simulator');
  return {
    id: 'dev-simulator-user',
    email,
    name: email.split('@')[0] || 'Dev User',
    role: 'safety-officer',
    orgId: 'masscoms-org',
  };
}

export async function signIn(email: string, password: string): Promise<FirebaseAuthUser> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const token = await cred.user.getIdTokenResult(true);
      const claims = (token.claims || {}) as Record<string, unknown>;
      return mapFirebaseUser(cred.user, claims);
    } catch (err) {
      __DEV__ && console.warn('[Auth] signIn getIdTokenResult failed, using defaults:', err);
      return mapFirebaseUser(cred.user, {});
    }
  } catch (err) {
    if (__DEV__ && isNetworkError(err)) {
      return devFallbackUser(email);
    }
    throw err;
  }
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback: (user: FirebaseAuthUser | null) => void): () => void {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      callback(null);
      return;
    }
    try {
      const token = await fbUser.getIdTokenResult(true);
      const claims = (token.claims || {}) as Record<string, unknown>;
      callback(mapFirebaseUser(fbUser, claims));
    } catch (err) {
      // getIdTokenResult often fails in simulator (-1017) or with network issues.
      // Keep the user logged in with default claims instead of clearing them.
      __DEV__ && console.warn('[Auth] getIdTokenResult failed, using defaults:', err);
      callback(mapFirebaseUser(fbUser, {}));
    }
  });
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
  return auth.currentUser;
}
