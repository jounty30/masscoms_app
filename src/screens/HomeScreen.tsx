import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, BackHandler } from 'react-native';
import { useNavigation, useIsFocused, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../auth/AuthContext';
import { useWebSocket } from '../ws/WebSocketContext';
import { useActiveIncident } from '../hooks/useActiveIncident';
import { useNetwork } from '../context/NetworkContext';
import { triggerIncident } from '../api/incidents';
import { colors } from '../theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { lastEvent } = useWebSocket();
  const { isConnected } = useNetwork();
  const orgId = user?.orgId ?? user?.organizationCode;
  const activeIncident = useActiveIncident(orgId);
  const isFocused = useIsFocused();
  const [triggering, setTriggering] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (!navigation.canGoBack()) return true;
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [navigation])
  );

  useEffect(() => {
    if (isFocused && lastEvent?.type === 'incident-triggered' && lastEvent.incidentId) {
      navigation.navigate('LiveIncident', { id: lastEvent.incidentId });
    }
  }, [isFocused, lastEvent, navigation]);

  const handleTrigger = () => {
    Alert.alert(
      'Trigger Lockdown?',
      'This will activate a LOCKDOWN incident for your organisation. Only proceed in a real emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger',
          style: 'destructive',
          onPress: async () => {
            setTriggering(true);
            try {
              const incident = await triggerIncident({ incidentType: 'lockdown', isDrill: false });
              navigation.navigate('LiveIncident', { id: incident.id });
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not trigger incident');
            } finally {
              setTriggering(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No internet connection. Some features may be limited.</Text>
        </View>
      )}
      {activeIncident && (
        <TouchableOpacity
          style={styles.incidentBanner}
          onPress={() => navigation.navigate('LiveIncident', { id: activeIncident.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={20} color="#fff" style={{ marginRight: 10 }} />
          <Text style={styles.incidentBannerText}>⚠ ACTIVE INCIDENT — Tap to view</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <View>
          <Text style={styles.userName}>{user?.name ?? user?.email ?? 'User'}</Text>
          <Text style={styles.roleText}>{user?.role ?? ''}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statusCard, activeIncident ? styles.statusCardIncident : styles.statusCardReady]}>
        {activeIncident ? (
          <>
            <Text style={styles.statusEmoji}>🚨</Text>
            <Text style={styles.statusTitle}>Active Incident</Text>
            <Text style={styles.statusSubtitle}>{activeIncident.type?.toUpperCase()}</Text>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('LiveIncident', { id: activeIncident.id })}
            >
              <Text style={styles.viewButtonText}>View Incident</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.statusEmoji}>✓</Text>
            <Text style={styles.statusTitle}>System Ready</Text>
            <Text style={styles.statusSubtitle}>No active incidents</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.triggerButton, triggering && styles.buttonDisabled]}
        onPress={handleTrigger}
        disabled={triggering}
        activeOpacity={0.8}
      >
        {triggering ? (
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
        ) : (
          <Ionicons name="warning" size={22} color="#fff" style={{ marginRight: 10 }} />
        )}
        <Text style={styles.triggerButtonText}>Trigger Incident (LOCKDOWN)</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 24 },
  offlineBanner: {
    backgroundColor: colors.evacuation,
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
  },
  offlineText: { color: '#fff', fontSize: 14 },
  incidentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  incidentBannerText: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userName: { fontSize: 18, fontWeight: '600', color: colors.text },
  roleText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  settingsBtn: { padding: 8 },
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 28,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusCardReady: {
    borderColor: colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  statusCardIncident: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  statusEmoji: { fontSize: 36, marginBottom: 12 },
  statusTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  statusSubtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 12 },
  viewButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginTop: 8,
  },
  viewButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lockdown,
    padding: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#f87171',
  },
  triggerButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
