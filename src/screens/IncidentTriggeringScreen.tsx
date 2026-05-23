/**
 * Full-screen "triggering" experience shown immediately after an incident is triggered.
 * Displays each communication channel with a tick as it completes in real time.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { subscribeToIncident, type IncidentTriggerStatus, type MessageDelivery } from '../services/incidents';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme';

const TRIGGERS: Array<{ key: string; label: string; channel?: string }> = [
  { key: 'digital-signage', label: 'Digital Signage', channel: 'signage' },
  { key: 'audio', label: 'Audio Announcement', channel: 'voice' },
  { key: 'sms', label: 'SMS', channel: 'sms' },
  { key: 'phone', label: 'Phone Call', channel: 'voice' },
  { key: 'notifications', label: 'Push Notifications', channel: 'email' },
  { key: 'whatsapp', label: 'WhatsApp', channel: 'whatsapp' },
];

function getTriggerStatus(
  messageDelivery: MessageDelivery[]
): Record<string, { status: 'sent' | 'failed' | 'pending'; sentCount: number; failedCount: number; error?: string }> {
  const byChannel: Record<string, { sent: number; failed: number; errors: string[] }> = {};
  for (const m of messageDelivery) {
    if (!byChannel[m.channel]) byChannel[m.channel] = { sent: 0, failed: 0, errors: [] };
    if (m.status === 'sent') byChannel[m.channel].sent += 1;
    else {
      byChannel[m.channel].failed += 1;
      if (m.error) byChannel[m.channel].errors.push(m.error);
    }
  }

  const result: Record<string, { status: 'sent' | 'failed' | 'pending'; sentCount: number; failedCount: number; error?: string }> = {};
  for (const t of TRIGGERS) {
    if (!t.channel) {
      result[t.key] = { status: 'pending', sentCount: 0, failedCount: 0 };
      continue;
    }
    const ch = byChannel[t.channel];
    const sentCount = ch?.sent ?? 0;
    const failedCount = ch?.failed ?? 0;
    const error = ch?.errors?.[0];
    let status: 'sent' | 'failed' | 'pending' = 'pending';
    if (sentCount > 0 && failedCount === 0) status = 'sent';
    else if (failedCount > 0) status = 'failed';
    else if (sentCount > 0 && failedCount > 0) status = 'failed';
    result[t.key] = { status, sentCount, failedCount, error };
  }
  return result;
}

function getStatusText(
  key: string,
  info: { status: 'sent' | 'failed' | 'pending'; sentCount: number; failedCount: number; error?: string },
  templateName: string
): string {
  const { status, sentCount, failedCount, error } = info;
  const labels: Record<string, string> = {
    sms: 'people',
    phone: 'people',
    audio: 'speakers',
    'digital-signage': 'screens',
    notifications: 'devices',
    whatsapp: 'recipients',
  };
  const unit = labels[key] ?? 'recipients';
  if (status === 'sent') {
    return sentCount > 0 ? `Sent to ${sentCount} ${unit} – ${templateName}` : `${templateName} sent`;
  }
  if (status === 'failed') {
    const base = failedCount > 0 ? `Failed: ${failedCount} ${unit}` : `Failed`;
    return error ? `${base} – ${error}` : base;
  }
  return `Sending… ${templateName}`;
}

export default function IncidentTriggeringScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const orgId = user?.orgId ?? user?.organizationCode;
  const incidentId = (route.params as { incidentId?: string; incidentType?: string } | undefined)?.incidentId;
  const incidentType = (route.params as { incidentType?: string } | undefined)?.incidentType ?? 'Incident';
  const [data, setData] = useState<IncidentTriggerStatus | null>(null);

  useEffect(() => {
    if (!orgId || !incidentId) return;
    const unsub = subscribeToIncident(orgId, incidentId, setData);
    return () => unsub();
  }, [orgId, incidentId]);

  const statuses = data ? getTriggerStatus(data.messageDelivery) : {};
  const completedCount = Object.values(statuses).filter((s) => s.status === 'sent' || s.status === 'failed').length;
  const totalCount = TRIGGERS.length;
  const templateName = `${incidentType} Alert`;

  if (!incidentId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Missing incident ID</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="radio" size={28} color="#fff" />
          </View>
          <Text style={styles.bannerTitle}>Triggering {incidentType}</Text>
          <Text style={styles.bannerSubtitle}>
            Activating all communication channels…
          </Text>
        </View>

        <View style={styles.triggersCard}>
          <Text style={styles.cardTitle}>Trigger Status</Text>
          {TRIGGERS.map((t) => {
            const info = statuses[t.key] ?? { status: 'pending' as const, sentCount: 0, failedCount: 0 };
            const status = info.status;
            const detailText = getStatusText(t.key, info, templateName);
            return (
              <View key={t.key} style={styles.triggerItem}>
                <View style={styles.triggerRow}>
                  <View style={[
                    styles.statusIcon,
                    status === 'sent' && styles.statusIconSent,
                    status === 'failed' && styles.statusIconFailed,
                    status === 'pending' && styles.statusIconPending,
                  ]}>
                    {status === 'sent' && <Ionicons name="checkmark" size={20} color="#fff" />}
                    {status === 'failed' && <Ionicons name="close" size={20} color="#fff" />}
                    {status === 'pending' && <ActivityIndicator size="small" color="#fff" />}
                  </View>
                  <View style={styles.triggerContent}>
                    <Text style={styles.triggerLabel}>{t.label}</Text>
                    <Text style={[
                      styles.triggerDetail,
                      status === 'failed' && styles.triggerDetailFailed,
                      status === 'pending' && styles.triggerDetailPending,
                    ]}>
                      {detailText}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.progressText}>
          {completedCount} of {totalCount} triggers complete
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.replace('LiveIncident', { id: incidentId })}
        >
          <Text style={styles.primaryButtonText}>View Incident</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: { color: colors.error },
  banner: {
    backgroundColor: colors.lockdown,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  triggersCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  triggerItem: {
    marginBottom: 16,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconSent: {
    backgroundColor: colors.success,
  },
  statusIconFailed: {
    backgroundColor: colors.error,
  },
  statusIconPending: {
    backgroundColor: colors.border,
  },
  triggerContent: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  triggerDetail: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  triggerDetailFailed: {
    color: colors.error,
  },
  triggerDetailPending: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
