import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { getIncident, resolveIncident } from '../services/incidents';
import { createHelpRequest, undoAcknowledgeIncident, getIncidentAcknowledgments } from '../api/incidents';
import { selfAcknowledge } from '../api/presence';
import { useWebSocket } from '../ws/WebSocketContext';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { isAdminRole } from '../types/api';
import { useCheckpoints } from '../lib/useCheckpoints';
import LocationPickerModal from '../components/LocationPickerModal';
import { colors } from '../theme';

const INCIDENT_COLORS: Record<string, string> = {
  lockdown: colors.lockdown,
  evacuation: colors.evacuation,
  fire: colors.fire,
  medical: colors.medical,
};

const HELP_REASONS = [
  { id: 'injured', label: 'Injured' },
  { id: 'trapped', label: 'Trapped' },
  { id: 'medical', label: 'Medical emergency' },
  { id: 'other', label: 'Other' },
];

const RESPONSE_PLANS: Record<string, string[]> = {
  lockdown: [
    'Lock all doors and windows immediately',
    'Turn off lights and close blinds',
    'Move away from doors and windows',
    'Silence all mobile devices',
    'Stay calm and await further instructions',
    'Do not leave until All Clear is given',
  ],
  evacuation: [
    'Leave belongings behind',
    'Use the nearest safe exit – do not use lifts',
    'Go to the assembly point and stay there',
    'Wait for roll call and further instructions',
  ],
  fire: [
    'Activate the nearest fire alarm if not already sounding',
    'Leave by the nearest exit – do not use lifts',
    'Stay low if there is smoke',
    'Go to the assembly point and report to the fire warden',
  ],
  medical: [
    'Stay calm and do not move the person unless in danger',
    'Call for help using the Request Assistance button',
    'Provide your exact location and nature of the emergency',
    'Stay with the person until help arrives',
  ],
};

function getTimeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export default function LiveIncidentScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const effectiveRole = useEffectiveRole();
  const orgId = user?.orgId ?? user?.organizationCode;
  const id = (route.params as { id?: string } | undefined)?.id;
  const queryClient = useQueryClient();
  const [timeSince, setTimeSince] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpReason, setHelpReason] = useState('');
  const [helpNotes, setHelpNotes] = useState('');
  const [helpLocation, setHelpLocation] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showSafeModal, setShowSafeModal] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<{ id: string; name: string } | null>(null);
  const canIssueAllClear = isAdminRole(effectiveRole ?? 'staff');

  const { lastEvent } = useWebSocket();
  const { checkpoints } = useCheckpoints(orgId);

  const { data: incident, isLoading, error, refetch } = useQuery({
    queryKey: ['incident', orgId, id],
    queryFn: () => getIncident(orgId!, id!),
    enabled: !!orgId && !!id,
    refetchInterval: 30000,
  });

  const { data: acknowledgments = [] } = useQuery({
    queryKey: ['incident', id, 'acknowledgments'],
    queryFn: () => getIncidentAcknowledgments(id!),
    enabled: !!id && !!user?.id,
  });

  const [selfAcked, setSelfAcked] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);
  const hasAcknowledged = selfAcked || (!!user?.id && acknowledgments.some((a) => a.userId === user.id));

  const acknowledgeMutation = useMutation({
    mutationFn: () => selfAcknowledge(id!),
    onSuccess: () => {
      setSelfAcked(true);
      setAcknowledgeError(null);
      setShowSafeModal(false);
      setSelectedCheckpoint(null);
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id, 'acknowledgments'] });
      queryClient.invalidateQueries({ queryKey: ['presence', 'roster'] });
    },
    onError: (err: Error) => {
      setAcknowledgeError(err?.message ?? 'Could not mark as safe. Please try again.');
    },
  });

  const undoAcknowledgeMutation = useMutation({
    mutationFn: () => undoAcknowledgeIncident(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id, 'acknowledgments'] });
      queryClient.invalidateQueries({ queryKey: ['presence', 'roster'] });
    },
    onError: (err: Error) => {
      Alert.alert('Could not undo', err?.message ?? 'Please try again.');
    },
  });

  const helpRequestMutation = useMutation({
    mutationFn: () =>
      createHelpRequest(id!, {
        reason: helpReason || 'other',
        notes: helpNotes || undefined,
        zone: helpLocation || undefined,
      }),
    onSuccess: () => {
      setShowHelpModal(false);
      setHelpReason('');
      setHelpNotes('');
      setHelpLocation('');
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
    },
  });

  const allClearMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !id) throw new Error('Missing org or incident');
      await resolveIncident(orgId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', orgId, id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      navigation.replace('Home');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err?.message ?? 'Could not issue All Clear');
    },
  });

  const handleAllClearPress = () => {
    Alert.alert(
      'Issue All Clear?',
      'This will end the incident and return to normal operations. Only do this when the emergency has been resolved.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'All Clear', style: 'default', onPress: () => allClearMutation.mutate() },
      ]
    );
  };

  // Immediate navigation when server signals incident resolved via WebSocket
  useEffect(() => {
    if (lastEvent?.type === 'incident-resolved') {
      navigation.replace('Home');
    }
  }, [lastEvent, navigation]);

  // Navigation via polling: incident resolved or no longer found (404 → null)
  useEffect(() => {
    if (incident && incident.status === 'resolved') {
      navigation.replace('Home');
    }
  }, [incident?.status, navigation]);

  // If incident is gone (resolved on server, getIncident returned null), go home
  useEffect(() => {
    if (!isLoading && !error && incident === null) {
      navigation.replace('Home');
    }
  }, [isLoading, error, incident, navigation]);

  useEffect(() => {
    const ts = incident?.createdAt ?? incident?.timestamp;
    if (!ts) return;
    const update = () => setTimeSince(getTimeSince(ts));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [incident?.createdAt, incident?.timestamp]);

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing incident ID</Text>
      </View>
    );
  }

  if (isLoading || !incident) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load incident</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const incidentColor = INCIDENT_COLORS[incident.type] ?? colors.primary;
  const planSteps = RESPONSE_PLANS[incident.type] ?? RESPONSE_PLANS.lockdown;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: incidentColor }]}>
        <View style={styles.bannerHeader}>
          <View style={styles.bannerLogo}>
            <Ionicons name="shield-checkmark" size={36} color="rgba(255,255,255,0.95)" />
          </View>
          <View style={styles.bannerTitleWrap}>
            <Text style={styles.bannerTitle}>
              {incident.isDrill ? 'DRILL - NOT LIVE' : incident.title}
            </Text>
            <Text style={styles.bannerSubtitle}>Active for {timeSince}</Text>
          </View>
        </View>
        {incident.isDrill && (
          <View style={styles.drillBadge}>
            <Text style={styles.drillBadgeText}>This is a TEST scenario</Text>
          </View>
        )}
        <View style={styles.responsePlanSection}>
          <Text style={styles.responsePlanTitle}>Response Plan</Text>
          {planSteps.map((step, i) => (
            <View key={i} style={styles.responsePlanStep}>
              <View style={[styles.responsePlanNum, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                <Text style={styles.responsePlanNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.responsePlanStepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incident Details</Text>
        <Text style={styles.detail}>
          Triggered by: {incident.triggeredByName ?? incident.activatedByName ?? incident.triggeredBy ?? 'Unknown'}
        </Text>
        <Text style={styles.detail}>
          {(() => {
            const ts = incident.createdAt ?? incident.timestamp;
            return ts
              ? new Date(ts).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Unknown';
          })()}
        </Text>
        {incident.zone && <Text style={styles.detail}>Zone: {incident.zone}</Text>}
      </View>

      {incident.instructions && incident.instructions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Instructions</Text>
          {incident.instructions.map((line, i) => (
            <Text key={i} style={styles.instruction}>
              {i + 1}. {line}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.actions}>
        {!hasAcknowledged && (
          <>
            <TouchableOpacity
              style={[styles.actionCard, styles.safeAction]}
              onPress={() => { setAcknowledgeError(null); setShowSafeModal(true); }}
              disabled={acknowledgeMutation.isPending}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
                {acknowledgeMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                )}
              </View>
              <Text style={styles.actionLabel}>I'm Safe</Text>
            </TouchableOpacity>
            {acknowledgeError && (
              <Text style={styles.acknowledgeErrorText}>{acknowledgeError}</Text>
            )}

            <TouchableOpacity
              style={[styles.actionCard, styles.helpAction]}
              onPress={() => setShowHelpModal(true)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Ionicons name="alert-circle" size={22} color={colors.error} />
              </View>
              <Text style={styles.actionLabel}>Request Assistance</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Map', { incidentId: id })}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
            <Ionicons name="map" size={22} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Live Responsive Map</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('TriggerStatus', { incidentId: id })}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
            <Ionicons name="radio" size={22} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Trigger Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Presence', { incidentId: id })}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.2)' }]}>
            <Ionicons name="clipboard" size={22} color={colors.primary} />
          </View>
          <Text style={styles.actionLabel}>Presence & Accountability</Text>
        </TouchableOpacity>

        {canIssueAllClear && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('LivePA', { incidentId: id })}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
              <Ionicons name="mic" size={22} color="#eab308" />
            </View>
            <Text style={styles.actionLabel}>Live PA – Tannoy</Text>
          </TouchableOpacity>
        )}

        {hasAcknowledged && (
          <View style={[styles.actionCard, styles.safeAction, styles.safeActionDone]}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            </View>
            <Text style={styles.actionLabel}>I'm Safe ✓</Text>
            <TouchableOpacity
              style={styles.undoButton}
              onPress={() => undoAcknowledgeMutation.mutate()}
              disabled={undoAcknowledgeMutation.isPending}
            >
              <Text style={styles.undoButtonText}>
                {undoAcknowledgeMutation.isPending ? 'Undoing…' : 'Undo'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {canIssueAllClear && (
          <TouchableOpacity
            style={[styles.actionCard, styles.allClearAction]}
            onPress={handleAllClearPress}
            disabled={allClearMutation.isPending}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.2)' }]}>
              {allClearMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.success} />
              ) : (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              )}
            </View>
            <Text style={styles.actionLabel}>All Clear – Return to Normal</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showSafeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>I'm Safe</Text>
            <Text style={styles.modalSubtitle}>Where are you located? Select your checkpoint.</Text>
            <Text style={styles.label}>Checkpoint</Text>
            {checkpoints.length === 0 ? (
              <Text style={styles.emptyCheckpoints}>No checkpoints configured. Add assembly points on the map in the web dashboard.</Text>
            ) : (
              checkpoints.map((cp) => (
                <Pressable
                  key={cp.id}
                  style={({ pressed }) => [
                    styles.reasonOption,
                    selectedCheckpoint?.id === cp.id && styles.reasonOptionSelected,
                    pressed && styles.reasonOptionPressed,
                  ]}
                  onPress={() => setSelectedCheckpoint(cp)}
                >
                  <Text style={styles.reasonOptionText}>{cp.name}</Text>
                </Pressable>
              ))
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSafeModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  checkpoints.length > 0 && !selectedCheckpoint && styles.buttonDisabled,
                ]}
                onPress={() => acknowledgeMutation.mutate()}
                disabled={(checkpoints.length > 0 && !selectedCheckpoint) || acknowledgeMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>
                  {acknowledgeMutation.isPending ? 'Confirming…' : 'Confirm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showHelpModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Assistance</Text>
            <Text style={styles.label}>Reason</Text>
            {HELP_REASONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.reasonOption, helpReason === r.id && styles.reasonOptionSelected]}
                onPress={() => setHelpReason(r.id)}
              >
                <Text style={styles.reasonOptionText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.whereAreaRow}
              onPress={() => setShowLocationPicker(true)}
            >
              <Ionicons name="location" size={20} color={colors.primary} />
              <Text
                style={[styles.whereAreaLabel, helpLocation && styles.whereAreaLabelSelected]}
                numberOfLines={2}
              >
                {helpLocation ? helpLocation : 'Where Are You? — Tap to select on map'}
              </Text>
              {helpLocation ? (
                <TouchableOpacity
                  style={styles.clearLocation}
                  onPress={() => setHelpLocation('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              value={helpNotes}
              onChangeText={setHelpNotes}
              placeholder="Additional details..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowHelpModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, !helpReason && styles.buttonDisabled]}
                onPress={() => helpRequestMutation.mutate()}
                disabled={!helpReason || helpRequestMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LocationPickerModal
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={setHelpLocation}
        orgId={orgId}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.error, marginBottom: 16, fontSize: 15 },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  acknowledgeErrorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: -4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  banner: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  bannerTitleWrap: { flex: 1 },
  bannerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  bannerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  drillBadge: { marginTop: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  drillBadgeText: { fontSize: 14, color: '#fff' },
  responsePlanSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  responsePlanTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  responsePlanStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  responsePlanNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  responsePlanNumText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  responsePlanStepText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.95)', lineHeight: 20 },
  safeActionDone: { opacity: 0.9 },
  undoButton: {
    marginLeft: 'auto',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  undoButtonText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  detail: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  instruction: { fontSize: 14, color: colors.text, marginBottom: 6 },
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
  safeAction: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  helpAction: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  allClearAction: {
    marginTop: 4,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
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
  buttonDisabled: { opacity: 0.6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  emptyCheckpoints: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, fontStyle: 'italic' },
  reasonOptionPressed: { opacity: 0.8 },
  reasonOption: {
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonOptionSelected: { borderColor: colors.primary },
  reasonOptionText: { color: colors.text, fontSize: 16 },
  whereAreaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  whereAreaLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: colors.textSecondary,
  },
  whereAreaLabelSelected: { color: colors.text },
  clearLocation: { padding: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.background },
  cancelButtonText: { color: colors.text },
  primaryButton: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
