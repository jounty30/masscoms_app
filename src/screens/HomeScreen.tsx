import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useWebSocket } from '../ws/WebSocketContext';
import { useActiveIncident } from '../hooks/useActiveIncident';
import { useNetwork } from '../context/NetworkContext';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { isAdminRole } from '../types/api';
import { colors } from '../theme';

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  'safety-officer': 'Safety Officer',
  'fire-warden': 'Fire Warden',
  slt: 'SLT',
  contractor: 'Contractor',
  student: 'Student',
  visitor: 'Visitor',
};

export default function HomeScreen() {
  const { user } = useAuth();
  const effectiveRole = useEffectiveRole();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { lastEvent, allClearReceived, dismissAllClear } = useWebSocket();
  const { isConnected } = useNetwork();
  const orgId = user?.orgId ?? user?.organizationCode;
  const activeIncident = useActiveIncident(orgId);
  const isFocused = useIsFocused();

  // Only auto-navigate when Home is focused – otherwise we'd override TriggerIncidentScreen
  // navigating to IncidentTriggering (the trigger progress page) after the user triggers.
  useEffect(() => {
    if (isFocused && activeIncident?.id) {
      navigation.replace('LiveIncident', { id: activeIncident.id });
    }
  }, [isFocused, activeIncident?.id, navigation]);

  useEffect(() => {
    if (isFocused && lastEvent?.type === 'incident-triggered' && lastEvent.incidentId) {
      navigation.navigate('LiveIncident', { id: lastEvent.incidentId });
    }
  }, [isFocused, lastEvent, navigation]);

  const canTrigger = isAdminRole(effectiveRole ?? 'staff');
  const canMonitor = isAdminRole(effectiveRole ?? 'staff');
  const isLimited = !effectiveRole || ['contractor', 'student', 'visitor'].includes(effectiveRole);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>No internet connection. Some features may be limited. Actions will sync when back online.</Text>
        </View>
      )}
      {allClearReceived && (
        <View style={styles.allClearBanner}>
          <Text style={styles.allClearText}>All Clear Issued – Return to normal activities</Text>
          <TouchableOpacity onPress={dismissAllClear} style={styles.allClearDismiss}>
            <Text style={styles.allClearDismissText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.header}>
        <View>
          <Text style={styles.userName}>{user?.name ?? user?.email ?? 'User'}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{ROLE_LABELS[effectiveRole ?? ''] ?? effectiveRole}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Status card */}
      <View style={[
        styles.card,
        styles.statusCard,
        activeIncident ? styles.statusCardIncident : styles.statusCardAllClear,
      ]}>
        {activeIncident ? (
          <>
            <View style={styles.statusIconCircle}>
              <Text style={styles.statusEmoji}>🚨</Text>
            </View>
            <Text style={styles.statusTitle}>Active Incident</Text>
            <Text style={styles.statusSubtitle}>{activeIncident.title} in progress</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('LiveIncident', { id: activeIncident.id })}
            >
              <Text style={styles.primaryButtonText}>View Incident</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.statusIconCircle, styles.statusIconCircleGreen]}>
              <Text style={styles.statusEmoji}>✓</Text>
            </View>
            <Text style={styles.statusTitle}>All Clear</Text>
            <Text style={styles.statusSubtitle}>No active incidents</Text>
          </>
        )}
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actions}>
        {activeIncident && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('LiveIncident', { id: activeIncident.id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>Acknowledge Safety</Text>
          </TouchableOpacity>
        )}
        {activeIncident && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('LiveIncident', { id: activeIncident.id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="alert-circle" size={22} color={colors.error} />
            </View>
            <Text style={styles.actionLabel}>Request Help</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Map')}>
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
            <Ionicons name="map" size={22} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>View Map</Text>
        </TouchableOpacity>
        {canTrigger && (
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('TriggerIncident')}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Ionicons name="warning" size={22} color={colors.error} />
            </View>
            <Text style={styles.actionLabel}>Trigger Incident</Text>
          </TouchableOpacity>
        )}
        {canMonitor && activeIncident && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AcknowledgmentMonitor', { id: activeIncident.id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
              <Ionicons name="people" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Monitor Status</Text>
          </TouchableOpacity>
        )}
        {canMonitor && activeIncident && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Presence', { incidentId: activeIncident.id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
              <Ionicons name="clipboard" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Presence & Accountability</Text>
          </TouchableOpacity>
        )}
        {canMonitor && (
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PeopleOnSite')}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
              <Ionicons name="location" size={22} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>People on Site</Text>
          </TouchableOpacity>
        )}
        {canMonitor && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('LivePA', { incidentId: activeIncident?.id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
              <Ionicons name="mic" size={22} color="#eab308" />
            </View>
            <Text style={styles.actionLabel}>Live PA – Tannoy</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLimited && (
        <View style={styles.limitedNote}>
          <Text style={styles.limitedNoteText}>
            During an incident you can acknowledge your safety, request help, and view the map and response plan.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userName: { fontSize: 18, fontWeight: '600', color: colors.text },
  badge: {
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: { fontSize: 12, color: colors.textSecondary },
  settingsBtn: { padding: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  statusCard: { alignItems: 'center' },
  statusCardAllClear: {
    borderColor: colors.success,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  statusCardIncident: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusIconCircleGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusEmoji: { fontSize: 28, color: colors.text },
  statusTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  statusSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  actions: { gap: 12 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  limitedNote: { marginTop: 24, padding: 16, backgroundColor: colors.card, borderRadius: 12 },
  limitedNoteText: { fontSize: 14, color: colors.textSecondary },
  allClearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.success,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  allClearText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  allClearDismiss: { padding: 8 },
  allClearDismissText: { color: '#fff', fontWeight: '600' },
  offlineBanner: {
    backgroundColor: colors.evacuation,
    padding: 14,
    marginBottom: 16,
    borderRadius: 12,
  },
  offlineText: { color: '#fff', fontSize: 14 },
});
