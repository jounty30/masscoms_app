import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useAuth } from '../auth/AuthContext';
import { getDeviceAuthInfo, authenticateDevice, type DeviceAuthInfo } from '../lib/deviceAuth';
import { colors } from '../theme';

// Only skip on simulator/emulator — always require auth on real devices, even in dev builds.
const skipBiometrics = !Constants.isDevice;

const DEFAULT_AUTH_INFO: DeviceAuthInfo = {
  type: 'none',
  label: 'Screen lock',
  icon: 'lock',
  canAuthenticate: false,
};

export default function BiometricGateScreen() {
  const { user, logout, unlockWithBiometrics } = useAuth();
  const [checking, setChecking] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<DeviceAuthInfo>(DEFAULT_AUTH_INFO);

  useEffect(() => {
    getDeviceAuthInfo().then(setAuthInfo);
  }, []);

  const runAuth = async () => {
    setError(null);
    setAuthenticating(true);
    try {
      const result = await authenticateDevice('Verify your identity to access Mass Coms');
      if (result.success) {
        unlockWithBiometrics();
      } else if (result.error) {
        setError(result.error);
      } else {
        setError('Verification cancelled. Tap below to try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setAuthenticating(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    if (skipBiometrics) {
      unlockWithBiometrics();
      setChecking(false);
      return;
    }
    runAuth();
  }, [unlockWithBiometrics]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'You need device authentication to use this app. Signing out will return you to the login screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (!user) return null;

  const subtitle =
    authInfo.type === 'face'
      ? 'Use face unlock to access Mass Coms'
      : authInfo.type === 'fingerprint'
        ? 'Use your fingerprint to access Mass Coms'
        : 'Use your screen lock to access Mass Coms';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons
          name={authInfo.icon as any}
          size={64}
          color={colors.primary}
          style={styles.icon}
        />
        <Text style={styles.title}>Verify your identity</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {checking || authenticating ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={runAuth}
              disabled={authenticating}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 320,
    width: '100%',
    alignItems: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  spinner: {
    marginTop: 16,
  },
  errorBox: {
    width: '100%',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  signOutText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
