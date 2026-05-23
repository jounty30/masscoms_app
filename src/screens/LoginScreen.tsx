/**
 * Login with the same credentials as the Mass Coms dashboard (Firebase email/password).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Image,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage } from '../lib/firebaseAuth';
import { colors } from '../theme';

const LOGO_URL = 'https://masscoms.com/_assets/v11/59bc82576142a8ae7266d760a26a645e8799f840.png';

export default function LoginScreen() {
  const { login, loginAsDev } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Enter email and password');
      return;
    }
    setError('');
    setLoading(true);
    Keyboard.dismiss();
    try {
      await login(email.trim(), password);
      if (__DEV__) console.log('[Login] Success for', email.trim());
    } catch (err: unknown) {
      if (__DEV__) console.warn('[Login] Failed:', err);
      const code = err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code : undefined;
      const msg = err instanceof Error ? err.message : String(err ?? '');
      const isNetwork = code === 'auth/network-request-failed' ||
        /network|fetch|connection|-1017/i.test(msg);
      if (__DEV__ && isNetwork) {
        console.warn('[Login] Network error on simulator — using dev fallback login');
        await loginAsDev(email.trim());
        return;
      }
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoSection}>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.subtitle}>Incident Response – sign in with your dashboard account</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@school.org"
            placeholderTextColor={colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Use the same email and password as the Mass Coms web dashboard.</Text>
        <Text style={styles.footerHint}>Your screen lock will be required after sign in.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  inner: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    height: 48,
    width: 200,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  errorText: { color: colors.error, fontSize: 14, marginTop: 12 },
  footer: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
  footerHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
