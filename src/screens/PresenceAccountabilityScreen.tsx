import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, Pressable, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { useWebSocket } from '../ws/WebSocketContext';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { isAdminRole } from '../types/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getOnSiteRoster, markPersonSafe } from '../api/presence';
import { useCheckpoints } from '../lib/useCheckpoints';
import { colors } from '../theme';
import type { OnSitePerson } from '../types/api';

// Fallback when API fails or returns empty (matches web "People on Site")
const DEMO_ROSTER: OnSitePerson[] = [
  { id: '1', name: 'Emma Thompson', role: 'student', checkInTime: '2026-02-18T08:15:00', checkInMethod: 'manual', acknowledged: false },
  { id: '2', name: 'James Wilson', role: 'student', checkInTime: '2026-02-18T08:22:00', checkInMethod: 'manual', acknowledged: false },
  { id: '3', name: 'Sophie Clarke', role: 'student', checkInTime: '2026-02-18T08:18:00', checkInMethod: 'manual', acknowledged: false },
  { id: '4', name: 'Oliver Brown', role: 'student', checkInTime: '2026-02-18T08:20:00', checkInMethod: 'manual', acknowledged: false },
  { id: '5', name: 'Isabella Davis', role: 'student', checkInTime: '2026-02-18T08:16:00', checkInMethod: 'manual', acknowledged: false },
  { id: '6', name: 'Sarah Mitchell', role: 'staff', checkInTime: '2026-02-18T07:45:00', checkInMethod: 'manual', acknowledged: false },
  { id: '7', name: 'David Roberts', role: 'staff', checkInTime: '2026-02-18T07:50:00', checkInMethod: 'manual', acknowledged: false },
  { id: '8', name: 'Jennifer Adams', role: 'staff', checkInTime: '2026-02-18T08:00:00', checkInMethod: 'manual', acknowledged: false },
  { id: '9', name: 'Michael Chen', role: 'staff', checkInTime: '2026-02-18T07:55:00', checkInMethod: 'manual', acknowledged: false },
  { id: '10', name: 'Linda Foster', role: 'visitor', checkInTime: '2026-02-18T09:10:00', checkInMethod: 'manual', acknowledged: false },
  { id: '11', name: 'Robert Hughes', role: 'visitor', checkInTime: '2026-02-18T09:25:00', checkInMethod: 'manual', acknowledged: false },
  { id: '12', name: 'Patricia Wright', role: 'visitor', checkInTime: '2026-02-18T10:00:00', checkInMethod: 'manual', acknowledged: false },
  { id: '13', name: 'Andrew Taylor', role: 'contractor', checkInTime: '2026-02-18T08:30:00', checkInMethod: 'manual', acknowledged: false },
  { id: '14', name: 'Susan Moore', role: 'contractor', checkInTime: '2026-02-18T08:45:00', checkInMethod: 'manual', acknowledged: false },
  { id: '15', name: 'Thomas Evans', role: 'student', checkInTime: '2026-02-18T08:25:00', checkInMethod: 'manual', acknowledged: false },
  { id: '16', name: 'Rachel Green', role: 'staff', checkInTime: '2026-02-18T07:48:00', checkInMethod: 'manual', acknowledged: false },
  { id: '17', name: 'Daniel King', role: 'visitor', checkInTime: '2026-02-18T09:40:00', checkInMethod: 'manual', acknowledged: false },
  { id: '18', name: 'Amanda Scott', role: 'contractor', checkInTime: '2026-02-18T09:00:00', checkInMethod: 'manual', acknowledged: false },
];

const MARK_SAFE_REASONS_BASE = [
  'Confirmed safe via radio',
  'Teacher confirmed in classroom',
  'Located in safe zone',
  'Left site before incident (verified)',
  'Medical room - accounted for',
];

export default function PresenceAccountabilityScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const effectiveRole = useEffectiveRole();
  const orgId = user?.orgId ?? user?.organizationCode;
  const incidentId = (route.params as { incidentId?: string } | undefined)?.incidentId;
  const queryClient = useQueryClient();
  const { checkpoints } = useCheckpoints(orgId);

  const markSafeReasons = useMemo(() => {
    const checkpointReasons = checkpoints.map(
      (cp) => `Physically seen at Assembly point [${cp.name}]`
    );
    return [...checkpointReasons, ...MARK_SAFE_REASONS_BASE];
  }, [checkpoints]);

  const { lastEvent } = useWebSocket();
  useEffect(() => {
    if (effectiveRole && !isAdminRole(effectiveRole)) {
      navigation.replace('Home');
    }
  }, [effectiveRole, navigation]);
  useEffect(() => {
    if (
      lastEvent?.type === 'person-marked-safe' ||
      lastEvent?.type === 'acknowledgment-received'
    ) {
      queryClient.invalidateQueries({ queryKey: ['presence', 'roster'] });
    }
  }, [lastEvent, queryClient]);
  const [filter, setFilter] = useState<'all' | 'accounted' | 'missing'>('all');
  const [search, setSearch] = useState('');
  const [markingPersonId, setMarkingPersonId] = useState<string | null>(null);
  const [markReason, setMarkReason] = useState('');
  const [locallyMarkedIds, setLocallyMarkedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['presence', 'roster', incidentId],
    queryFn: () => getOnSiteRoster(incidentId),
    retry: 1,
    refetchInterval: 15000,
  });
  const baseRoster = Array.isArray(data) && data.length > 0 ? data : DEMO_ROSTER;
  const roster = baseRoster.map((p) =>
    locallyMarkedIds.has(p.id) ? { ...p, acknowledged: true, acknowledgedAt: new Date().toISOString() } : p
  );

  const markSafeMutation = useMutation({
    mutationFn: ({ personId, reason }: { personId: string; reason: string }) =>
      markPersonSafe(personId, { incidentId: incidentId!, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presence', 'roster'] });
      setMarkingPersonId(null);
      setMarkReason('');
    },
    onError: (err: Error) => {
      Alert.alert('Could not mark as safe', err?.message ?? 'Please try again.');
    },
  });

  const handleMarkSafe = () => {
    if (!markingPersonId || !markReason) return;
    if (incidentId) {
      markSafeMutation.mutate({ personId: markingPersonId, reason: markReason });
    } else {
      setLocallyMarkedIds((prev) => new Set(prev).add(markingPersonId));
      setMarkingPersonId(null);
      setMarkReason('');
    }
  };

  const openMarkSafeModal = (personId: string) => {
    setMarkingPersonId(personId);
    setMarkReason('');
  };

  const filtered = roster.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.role.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'accounted') return p.acknowledged;
    if (filter === 'missing') return !p.acknowledged;
    return true;
  });

  const accountedCount = roster.filter((p) => p.acknowledged).length;
  const missingCount = roster.filter((p) => !p.acknowledged).length;
  const pct = roster.length > 0 ? Math.round((accountedCount / roster.length) * 100) : 0;

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {error && !data && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>Could not load roster data</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{accountedCount}</Text>
          <Text style={styles.statLabel}>Accounted for</Text>
          <Text style={styles.statPct}>{pct}%</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRed]}>
          <Text style={styles.statValue}>{missingCount}</Text>
          <Text style={styles.statLabel}>Unaccounted</Text>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or role"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'accounted', 'missing'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipSelected]}
            onPress={() => setFilter(f)}
          >
            <Text style={styles.filterChipText}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((p) => (
        <View
          key={p.id}
          style={[styles.personCard, p.acknowledged ? styles.personCardSafe : styles.personCardMissing]}
        >
          <View style={styles.personHeader}>
            <Text style={styles.personName}>{p.name}</Text>
            <Text style={styles.personRole}>{p.role}</Text>
          </View>
          <Text style={styles.personMeta}>
            Check-in: {new Date(p.checkInTime).toLocaleString()} • {p.checkInMethod}
          </Text>
          {p.acknowledged ? (
            <>
              <Text style={styles.personAcked}>
                Safe at {p.acknowledgedAt ? new Date(p.acknowledgedAt).toLocaleTimeString() : '—'}
              </Text>
              {p.markedSafeReason && (
                <Text style={styles.personReason}>{p.markedSafeReason}</Text>
              )}
            </>
          ) : (
            <TouchableOpacity style={styles.markSafeButton} onPress={() => openMarkSafeModal(p.id)}>
              <Text style={styles.markSafeButtonText}>Mark as Safe</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Modal visible={!!markingPersonId} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Mark as Safe</Text>
            <Text style={styles.label}>Reason</Text>
            {markSafeReasons.map((r) => (
              <Pressable
                key={r}
                style={({ pressed }) => [
                  styles.reasonOption,
                  markReason === r && styles.reasonOptionSelected,
                  pressed && styles.reasonOptionPressed,
                ]}
                onPress={() => setMarkReason(r)}
              >
                <Text style={styles.reasonOptionText}>{r}</Text>
              </Pressable>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setMarkingPersonId(null)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, !markReason && styles.buttonDisabled]}
                onPress={handleMarkSafe}
                disabled={!markReason || markSafeMutation.isPending}
              >
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statCardRed: { borderColor: colors.error },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statPct: { fontSize: 12, color: colors.success, marginTop: 2 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 16,
    paddingLeft: 14,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  search: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 14,
    color: colors.text,
    fontSize: 16,
    textAlign: 'left',
    ...(Platform.OS === 'android' && { textAlignVertical: 'center' }),
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: { borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 14 },
  personCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  personCardSafe: { backgroundColor: colors.card, borderColor: colors.success },
  personCardMissing: { backgroundColor: colors.card, borderColor: colors.error },
  personHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personName: { fontSize: 16, fontWeight: '600', color: colors.text },
  personRole: { fontSize: 12, color: colors.textSecondary },
  personMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  personAcked: { fontSize: 12, color: colors.success, marginTop: 4 },
  personReason: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  markSafeButton: {
    marginTop: 8,
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  markSafeButtonText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8 },
  reasonOption: {
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonOptionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(37, 99, 235, 0.15)' },
  reasonOptionPressed: { opacity: 0.8 },
  reasonOptionText: { color: colors.text },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.background },
  cancelButtonText: { color: colors.text },
  primaryButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  errorBanner: {
    padding: 14,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorBannerText: { color: colors.error, fontSize: 14, marginBottom: 8 },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
