import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { subscribeToIncident, type IncidentTriggerStatus, type MessageDelivery } from '../services/incidents';
import { colors } from '../theme';

function getTriggerStatus(messageDelivery: MessageDelivery[]): Array<{ label: string; status: 'sent' | 'failed' | 'pending'; count?: number; error?: string }> {
  const byChannel: Record<string, { sent: number; failed: number; errors: string[] }> = {};
  for (const m of messageDelivery) {
    if (!byChannel[m.channel]) byChannel[m.channel] = { sent: 0, failed: 0, errors: [] };
    if (m.status === 'sent') byChannel[m.channel].sent++;
    else {
      byChannel[m.channel].failed++;
      if (m.error) byChannel[m.channel].errors.push(m.error);
    }
  }

  const result: Array<{ label: string; status: 'sent' | 'failed' | 'pending'; count?: number; error?: string }> = [];

  result.push({
    label: 'Audio Announcement',
    status: byChannel.voice?.sent ? 'sent' : byChannel.voice?.failed ? 'failed' : 'pending',
    count: byChannel.voice ? byChannel.voice.sent + byChannel.voice.failed : undefined,
    error: byChannel.voice?.errors[0],
  });
  result.push({
    label: 'SMS sent',
    status: byChannel.sms?.sent ? 'sent' : byChannel.sms?.failed ? 'failed' : 'pending',
    count: byChannel.sms ? byChannel.sms.sent + byChannel.sms.failed : undefined,
    error: byChannel.sms?.errors[0],
  });
  result.push({
    label: 'Phone Call',
    status: byChannel.voice?.sent ? 'sent' : byChannel.voice?.failed ? 'failed' : 'pending',
    count: byChannel.voice ? byChannel.voice.sent + byChannel.voice.failed : undefined,
    error: byChannel.voice?.errors[0],
  });
  result.push({
    label: 'Notifications sent',
    status: byChannel.email?.sent ? 'sent' : byChannel.email?.failed ? 'failed' : 'pending',
    count: byChannel.email ? byChannel.email.sent + byChannel.email.failed : undefined,
    error: byChannel.email?.errors[0],
  });
  result.push({ label: 'WhatsApp sent', status: 'pending' });
  result.push({ label: 'Digital Signage Activated', status: 'pending' });

  return result;
}

export default function TriggerStatusScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const orgId = user?.orgId ?? user?.organizationCode;
  const incidentId = (route.params as { incidentId?: string } | undefined)?.incidentId;
  const [data, setData] = useState<IncidentTriggerStatus | null>(null);

  useEffect(() => {
    if (!orgId || !incidentId) return;
    const unsub = subscribeToIncident(orgId, incidentId, setData);
    return () => unsub();
  }, [orgId, incidentId]);

  if (!incidentId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing incident ID</Text>
      </View>
    );
  }

  const triggers = data ? getTriggerStatus(data.messageDelivery) : [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Trigger Status</Text>
      <Text style={styles.subtitle}>Real-time status of notifications sent when this incident was triggered</Text>

      {!data ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Connecting…</Text>
        </View>
      ) : data.messageDelivery.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyCardText}>No delivery data yet</Text>
          <Text style={styles.emptyCardSub}>Delivery status will appear here once notifications have been sent.</Text>
        </View>
      ) : (
        <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Communication Triggers</Text>
        {triggers.map((t, i) => (
          <View key={i} style={styles.triggerRow}>
            <View style={[styles.statusDot, t.status === 'sent' && styles.statusSent, t.status === 'failed' && styles.statusFailed, t.status === 'pending' && styles.statusPending]} />
            <Text style={styles.triggerLabel}>{t.label}</Text>
            {t.status === 'sent' && t.count != null && (
              <Text style={styles.triggerCount}>{t.count} sent</Text>
            )}
            {t.status === 'failed' && (
              <Text style={styles.triggerError}>{t.count} attempted{t.error ? ` • ${t.error}` : ''}</Text>
            )}
            {t.status === 'pending' && (
              <Text style={styles.triggerPending}>—</Text>
            )}
          </View>
        ))}
      </View>

      {data && data.timeline.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Timeline</Text>
          {data.timeline.map((t, i) => (
            <View key={i} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>{new Date(t.at).toLocaleTimeString()}</Text>
              <Text style={styles.timelineAction}>{t.action}</Text>
            </View>
          ))}
        </View>
      )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { color: colors.error },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 },
  triggerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusSent: { backgroundColor: colors.success },
  statusFailed: { backgroundColor: colors.error },
  statusPending: { backgroundColor: colors.border },
  triggerLabel: { flex: 1, fontSize: 15, color: colors.text },
  triggerCount: { fontSize: 13, color: colors.success },
  triggerError: { fontSize: 12, color: colors.error, flex: 1 },
  triggerPending: { fontSize: 13, color: colors.textSecondary },
  timelineRow: { marginBottom: 8 },
  timelineTime: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  timelineAction: { fontSize: 14, color: colors.text },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyCardText: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptyCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});
