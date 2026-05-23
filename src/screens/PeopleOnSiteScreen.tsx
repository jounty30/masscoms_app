import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { isAdminRole } from '../types/api';
import { colors } from '../theme';

// Demo data - will be replaced when connected to Bromcom + InVentry
const DEMO_PEOPLE_ON_SITE = [
  { id: '1', name: 'Emma Thompson', role: 'student', checkInTime: '2026-02-18T08:15:00', source: 'Bromcom' },
  { id: '2', name: 'James Wilson', role: 'student', checkInTime: '2026-02-18T08:22:00', source: 'Bromcom' },
  { id: '3', name: 'Sophie Clarke', role: 'student', checkInTime: '2026-02-18T08:18:00', source: 'Bromcom' },
  { id: '4', name: 'Oliver Brown', role: 'student', checkInTime: '2026-02-18T08:20:00', source: 'Bromcom' },
  { id: '5', name: 'Isabella Davis', role: 'student', checkInTime: '2026-02-18T08:16:00', source: 'Bromcom' },
  { id: '6', name: 'Sarah Mitchell', role: 'staff', checkInTime: '2026-02-18T07:45:00', source: 'Bromcom' },
  { id: '7', name: 'David Roberts', role: 'staff', checkInTime: '2026-02-18T07:50:00', source: 'Bromcom' },
  { id: '8', name: 'Jennifer Adams', role: 'staff', checkInTime: '2026-02-18T08:00:00', source: 'Bromcom' },
  { id: '9', name: 'Michael Chen', role: 'staff', checkInTime: '2026-02-18T07:55:00', source: 'Bromcom' },
  { id: '10', name: 'Linda Foster', role: 'visitor', checkInTime: '2026-02-18T09:10:00', source: 'InVentry' },
  { id: '11', name: 'Robert Hughes', role: 'visitor', checkInTime: '2026-02-18T09:25:00', source: 'InVentry' },
  { id: '12', name: 'Patricia Wright', role: 'visitor', checkInTime: '2026-02-18T10:00:00', source: 'InVentry' },
  { id: '13', name: 'Andrew Taylor', role: 'contractor', checkInTime: '2026-02-18T08:30:00', source: 'InVentry' },
  { id: '14', name: 'Susan Moore', role: 'contractor', checkInTime: '2026-02-18T08:45:00', source: 'InVentry' },
  { id: '15', name: 'Thomas Evans', role: 'student', checkInTime: '2026-02-18T08:25:00', source: 'Bromcom' },
  { id: '16', name: 'Rachel Green', role: 'staff', checkInTime: '2026-02-18T07:48:00', source: 'Bromcom' },
  { id: '17', name: 'Daniel King', role: 'visitor', checkInTime: '2026-02-18T09:40:00', source: 'InVentry' },
  { id: '18', name: 'Amanda Scott', role: 'contractor', checkInTime: '2026-02-18T09:00:00', source: 'InVentry' },
];

type RoleFilter = 'all' | 'student' | 'visitor' | 'staff' | 'contractor';

const ROLE_LABELS: Record<RoleFilter, string> = {
  all: 'All',
  student: 'Student',
  visitor: 'Visitor',
  staff: 'Staff',
  contractor: 'Contractor',
};

export default function PeopleOnSiteScreen() {
  const navigation = useNavigation<any>();
  const effectiveRole = useEffectiveRole();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  React.useEffect(() => {
    if (effectiveRole && !isAdminRole(effectiveRole)) {
      navigation.replace('Home');
    }
  }, [effectiveRole, navigation]);

  const filtered = useMemo(() => {
    return DEMO_PEOPLE_ON_SITE.filter((p) => {
      const matchRole = roleFilter === 'all' || p.role === roleFilter;
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.role.toLowerCase().includes(search.toLowerCase()) ||
        p.source.toLowerCase().includes(search.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [search, roleFilter]);

  const counts = useMemo(() => ({
    all: DEMO_PEOPLE_ON_SITE.length,
    student: DEMO_PEOPLE_ON_SITE.filter((p) => p.role === 'student').length,
    visitor: DEMO_PEOPLE_ON_SITE.filter((p) => p.role === 'visitor').length,
    staff: DEMO_PEOPLE_ON_SITE.filter((p) => p.role === 'staff').length,
    contractor: DEMO_PEOPLE_ON_SITE.filter((p) => p.role === 'contractor').length,
  }), []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.summaryValue}>{filtered.length}</Text>
        <Text style={styles.summaryLabel}>people on site</Text>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name, role or source..."
        placeholderTextColor={colors.textSecondary}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <View style={styles.filterRow}>
          {(['all', 'student', 'staff', 'visitor', 'contractor'] as const).map((role) => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, roleFilter === role && styles.filterChipSelected]}
              onPress={() => setRoleFilter(role)}
            >
              <Text style={[styles.filterChipText, roleFilter === role && styles.filterChipTextSelected]}>
                {ROLE_LABELS[role]} {role !== 'all' && `(${counts[role]})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {filtered.map((p) => (
        <View key={p.id} style={styles.personCard}>
          <View style={styles.personHeader}>
            <Text style={styles.personName}>{p.name}</Text>
            <View style={[styles.roleBadge, styles[`roleBadge_${p.role}` as keyof typeof styles]]}>
              <Text style={styles.roleBadgeText}>{ROLE_LABELS[p.role as RoleFilter]}</Text>
            </View>
          </View>
          <Text style={styles.personMeta}>
            Checked in {new Date(p.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {p.source}
          </Text>
        </View>
      ))}

      {filtered.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No one matches your search</Text>
        </View>
      )}

      <View style={styles.demoNote}>
        <Text style={styles.demoNoteText}>
          Demo data. Will show live check-ins from Bromcom and InVentry when connected.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  summary: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 32, fontWeight: '700', color: colors.text },
  summaryLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    marginBottom: 16,
  },
  filterScroll: { marginBottom: 16, marginHorizontal: -24 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: 'rgba(37, 99, 235, 0.15)' },
  filterChipText: { color: colors.textSecondary, fontSize: 14 },
  filterChipTextSelected: { color: colors.primary, fontWeight: '600' },
  personCard: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  personHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personName: { fontSize: 16, fontWeight: '600', color: colors.text },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadge_student: { backgroundColor: 'rgba(37, 99, 235, 0.2)' },
  roleBadge_staff: { backgroundColor: 'rgba(34, 197, 94, 0.2)' },
  roleBadge_visitor: { backgroundColor: 'rgba(234, 179, 8, 0.2)' },
  roleBadge_contractor: { backgroundColor: 'rgba(168, 85, 247, 0.2)' },
  roleBadgeText: { fontSize: 12, fontWeight: '600', color: colors.text },
  personMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  empty: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  demoNote: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoNoteText: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },
});
