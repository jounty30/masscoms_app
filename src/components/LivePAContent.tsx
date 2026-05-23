/**
 * Live PA demo – hold to speak, release to "send".
 * No actual recording or backend. For demo purposes only.
 * Uses Sites & Zones from establishment (same as web dashboard).
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getSitesWithZones } from '../api/maps';
import { colors } from '../theme';

interface LivePAContentProps {
  incidentId?: string;
}

export function LivePAContent({ incidentId }: LivePAContentProps) {
  const navigation = useNavigation<any>();
  const [selectedTarget, setSelectedTarget] = useState<{ siteId: string; zoneId?: string }>({ siteId: '', zoneId: undefined });
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: sitesData } = useQuery({ queryKey: ['maps', 'sites-with-zones'], queryFn: getSitesWithZones });
  const sites = Array.isArray(sitesData) ? sitesData : [];

  const startRecording = () => {
    setIsRecording(true);
    setDurationSec(0);
    timerRef.current = setInterval(() => {
      setDurationSec((s) => s + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    Alert.alert('Live PA Sent', 'Your message has been broadcast to the PA system.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const isSelected = (siteId: string, zoneId?: string) =>
    selectedTarget.siteId === siteId && selectedTarget.zoneId === zoneId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Live PA</Text>
        <Text style={styles.subtitle}>
          Select where to broadcast, then hold the button and speak.
        </Text>
        <View style={styles.zoneOptions}>
          <TouchableOpacity
            style={[styles.zoneOption, selectedTarget.siteId === '' && styles.zoneOptionSelected]}
            onPress={() => setSelectedTarget({ siteId: '', zoneId: undefined })}
            disabled={isRecording}
          >
            <Ionicons name="business" size={20} color={selectedTarget.siteId === '' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.zoneOptionText, selectedTarget.siteId === '' && styles.zoneOptionTextSelected]}>All sites</Text>
          </TouchableOpacity>
          {sites.map((site) => (
            <View key={site.id} style={styles.siteGroup}>
              <TouchableOpacity
                style={[styles.zoneOption, styles.siteOption, isSelected(site.id, undefined) && styles.zoneOptionSelected]}
                onPress={() => setSelectedTarget({ siteId: site.id, zoneId: undefined })}
                disabled={isRecording}
              >
                <Ionicons name="business" size={20} color={isSelected(site.id, undefined) ? colors.primary : colors.textSecondary} />
                <Text style={[styles.zoneOptionText, isSelected(site.id, undefined) && styles.zoneOptionTextSelected]}>
                  {site.name} – site-wide
                </Text>
              </TouchableOpacity>
              {site.zones.filter((z) => z.name !== 'Site-wide').map((z) => (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.zoneOption, styles.zoneSubOption, isSelected(site.id, z.id) && styles.zoneOptionSelected]}
                  onPress={() => setSelectedTarget({ siteId: site.id, zoneId: z.id })}
                  disabled={isRecording}
                >
                  <Ionicons name="location" size={20} color={isSelected(site.id, z.id) ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.zoneOptionText, isSelected(site.id, z.id) && styles.zoneOptionTextSelected]}>{z.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.holdButton, isRecording && styles.holdButtonActive]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          activeOpacity={1}
        >
          <Ionicons name="mic" size={32} color="#fff" style={styles.holdIcon} />
          <Text style={styles.holdButtonText}>
            {isRecording ? `Recording… ${durationSec}s` : 'Hold to speak'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneOptions: {},
  siteGroup: { marginBottom: 4 },
  zoneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    marginBottom: 10,
  },
  siteOption: {},
  zoneSubOption: { marginLeft: 20 },
  zoneOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  zoneOptionText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  zoneOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  holdButton: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  holdButtonActive: { backgroundColor: colors.error },
  holdButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  holdIcon: { marginBottom: 8 },
});
