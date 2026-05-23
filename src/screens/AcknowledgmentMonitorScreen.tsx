import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../ws/WebSocketContext';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { isAdminRole } from '../types/api';
import { useAuth } from '../auth/AuthContext';
import { resolveIncident } from '../services/incidents';
import { getIncidentStats, getIncidentAcknowledgments, getIncidentHelpRequests } from '../api/incidents';
import { colors } from '../theme';

export default function AcknowledgmentMonitorScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const effectiveRole = useEffectiveRole();
  const id = (route.params as { id?: string } | undefined)?.id;
  const orgId = user?.orgId ?? user?.organizationCode;
  const queryClient = useQueryClient();
  const { lastEvent } = useWebSocket();

  useEffect(() => {
    if (id && lastEvent && (lastEvent.type === 'acknowledgment-received' || lastEvent.type === 'help-request-received')) {
      queryClient.invalidateQueries({ queryKey: ['incident', id, 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['incident', id, 'acknowledgments'] });
      queryClient.invalidateQueries({ queryKey: ['incident', id, 'help-requests'] });
    }
  }, [id, lastEvent, queryClient]);

  useEffect(() => {
    if (effectiveRole && !isAdminRole(effectiveRole)) {
      navigation.replace('Home');
    }
  }, [effectiveRole, navigation]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['incident', id, 'stats'],
    queryFn: () => getIncidentStats(id!),
    enabled: !!id,
  });
  const { data: acknowledgments = [] } = useQuery({
    queryKey: ['incident', id, 'acknowledgments'],
    queryFn: () => getIncidentAcknowledgments(id!),
    enabled: !!id,
  });
  const { data: helpRequests = [] } = useQuery({
    queryKey: ['incident', id, 'help-requests'],
    queryFn: () => getIncidentHelpRequests(id!),
    enabled: !!id,
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !id) throw new Error('Missing org or incident');
      await resolveIncident(orgId, id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
    },
  });

  if (!id) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing incident ID</Text>
      </View>
    );
  }

  if (statsLoading || !stats) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const total = stats.totalExpected ?? 0;
  const acked = stats.acknowledged ?? 0;
  const helpCount = stats.helpRequested ?? 0;
  const noResponse = stats.noResponse ?? 0;
  const pct = total > 0 ? Math.round((acked / total) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{acked}</Text>
          <Text style={styles.statLabel}>Safe</Text>
          <Text style={styles.statPct}>{pct}%</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRed]}>
          <Text style={styles.statValue}>{noResponse}</Text>
          <Text style={styles.statLabel}>No response</Text>
        </View>
        <View style={[styles.statCard, styles.statCardOrange]}>
          <Text style={styles.statValue}>{helpCount}</Text>
          <Text style={styles.statLabel}>Help requested</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Help requests</Text>
        {helpRequests.length === 0 ? (
          <Text style={styles.empty}>No help requests</Text>
        ) : (
          helpRequests.map((hr) => (
            <View key={hr.id} style={styles.helpCard}>
              <Text style={styles.helpName}>{hr.userName}</Text>
              <Text style={styles.helpReason}>{hr.reason}</Text>
              {hr.notes && <Text style={styles.helpNotes}>{hr.notes}</Text>}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acknowledgments</Text>
        {acknowledgments.length === 0 ? (
          <Text style={styles.empty}>None yet</Text>
        ) : (
          acknowledgments.slice(0, 20).map((a) => (
            <View key={a.id} style={styles.ackCard}>
              <Text style={styles.ackName}>{a.userName}</Text>
              <Text style={styles.ackMeta}>{a.zone ?? '—'} • {new Date(a.acknowledgedAt).toLocaleTimeString()}</Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        style={styles.resolveButton}
        onPress={() => {
          Alert.alert(
            'Send All Clear',
            'This will end the incident and notify everyone. Continue?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Send All Clear', style: 'default', onPress: () => resolveMutation.mutate() },
            ]
          );
        }}
        disabled={resolveMutation.isPending}
      >
        <Text style={styles.resolveButtonText}>Send All Clear</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.error },
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
  statCardOrange: { borderColor: colors.evacuation },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  statPct: { fontSize: 12, color: colors.success, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  empty: { fontSize: 14, color: colors.textSecondary },
  helpCard: {
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.evacuation,
  },
  helpName: { fontSize: 16, fontWeight: '600', color: colors.text },
  helpReason: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  helpNotes: { fontSize: 14, color: colors.text, marginTop: 2 },
  ackCard: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ackName: { fontSize: 14, fontWeight: '600', color: colors.text },
  ackMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  resolveButton: {
    backgroundColor: colors.success,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  resolveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
