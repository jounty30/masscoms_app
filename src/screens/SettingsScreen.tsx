import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useDev } from '../context/DevContext';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { colors } from '../theme';
import type { UserRole } from '../types/api';

const ROLE_LABELS: Record<string, string> = {
  staff: 'Staff',
  'safety-officer': 'Safety Officer',
  'fire-warden': 'Fire Warden',
  slt: 'SLT',
  contractor: 'Contractor',
  student: 'Student',
  visitor: 'Visitor',
};

const ROLES: UserRole[] = ['staff', 'safety-officer', 'fire-warden', 'slt', 'contractor', 'student', 'visitor'];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { roleOverride, setRoleOverride } = useDev();
  const effectiveRole = useEffectiveRole();
  const [devPanelVisible, setDevPanelVisible] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleAppInfoPress = () => {
    tapCountRef.current += 1;
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      setDevPanelVisible(true);
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 2000);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile</Text>
        <Text style={styles.profileName}>{user?.name ?? '—'}</Text>
        <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {ROLE_LABELS[effectiveRole ?? ''] ?? effectiveRole}
            {roleOverride ? ' (override)' : ''}
          </Text>
        </View>
        <Text style={styles.profileOrg}>{user?.organization ?? '—'} ({user?.organizationCode ?? '—'})</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={() => logout()}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.appInfoRow} onPress={handleAppInfoPress}>
        <Text style={styles.appInfoLabel}>App Information</Text>
        <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Mass Coms Incident Response • Martyn's Law</Text>

      <Modal visible={devPanelVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Developer Panel</Text>
            <Text style={styles.modalSubtitle}>Switch role for UI testing</Text>
            {ROLES.map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleOption, roleOverride === role && styles.roleOptionSelected]}
                onPress={() => setRoleOverride(roleOverride === role ? null : role)}
              >
                <Text style={styles.roleOptionText}>{ROLE_LABELS[role]}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.clearButton} onPress={() => setRoleOverride(null)}>
              <Text style={styles.clearButtonText}>Clear override</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => setDevPanelVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  profileEmail: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeText: { fontSize: 12, color: colors.text },
  profileOrg: { fontSize: 14, color: colors.textSecondary },
  button: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  appInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  appInfoLabel: { fontSize: 14, color: colors.text },
  appInfoVersion: { fontSize: 12, color: colors.textSecondary },
  footer: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  roleOption: {
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOptionSelected: { borderColor: colors.primary },
  roleOptionText: { color: colors.text, fontSize: 16 },
  clearButton: {
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  clearButtonText: { color: colors.primary, fontSize: 14 },
  closeButton: {
    padding: 14,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  closeButtonText: { color: '#fff', fontWeight: '600' },
});
