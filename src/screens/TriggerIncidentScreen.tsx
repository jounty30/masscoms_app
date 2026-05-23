import React, { useState, useEffect, useMemo } from 'react';
import Constants from 'expo-constants';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../auth/AuthContext';
import { triggerIncident } from '../services/incidents';
import { getDeviceAuthInfo, authenticateDevice, type DeviceAuthInfo } from '../lib/deviceAuth';
import { getEstablishment, getFloorplanOverlay, getScenarios, type Scenario } from '../api/maps';
import { isAdminRole } from '../types/api';
import { useEffectiveRole } from '../hooks/useEffectiveRole';
import { colors } from '../theme';

type IncidentType = 'lockdown' | 'evacuate' | 'invacuate' | 'standby' | 'test';

const INCIDENT_TYPE_META: Record<
  IncidentType,
  { name: string; description: string; color: string; icon: string; isCritical?: boolean }
> = {
  lockdown: {
    name: 'LOCKDOWN',
    description: 'Secure all areas immediately.',
    color: colors.lockdown,
    icon: 'shield-lock',
    isCritical: true,
  },
  evacuate: {
    name: 'EVACUATE',
    description: 'Exit building to assembly points.',
    color: '#ea580c',
    icon: 'bullhorn',
  },
  invacuate: {
    name: 'INVACUATE',
    description: 'Shelter in place immediately.',
    color: '#d97706',
    icon: 'arrow-down-box',
  },
  standby: {
    name: 'STANDBY',
    description: 'Alert and await instructions.',
    color: colors.primary,
    icon: 'pause',
  },
  test: {
    name: 'TEST',
    description: 'System test / drill mode.',
    color: '#64748b',
    icon: 'flask',
  },
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  lockdown: 'Lockdown',
  evacuate: 'Evacuation',
  invacuate: 'Invacuation',
  standby: 'Standby',
  test: 'Drill',
};

export default function TriggerIncidentScreen() {
  const { user } = useAuth();
  const effectiveRole = useEffectiveRole();
  const navigation = useNavigation<any>();
  const orgId = user?.orgId ?? user?.organizationCode;
  const [selectedIncidentType, setSelectedIncidentType] = useState<IncidentType | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [siteScope, setSiteScope] = useState<'all' | 'specific'>('all');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [isDrill, setIsDrill] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [biometricChecking, setBiometricChecking] = useState(false);
  const [authInfo, setAuthInfo] = useState<DeviceAuthInfo>({ type: 'none', label: 'Screen lock', icon: 'lock', canAuthenticate: false });

  useEffect(() => {
    getDeviceAuthInfo().then(setAuthInfo);
  }, []);

  useEffect(() => {
    if (effectiveRole && !isAdminRole(effectiveRole)) {
      navigation.replace('Home');
    }
  }, [effectiveRole, navigation]);

  const { data: establishmentData } = useQuery({ queryKey: ['maps', 'establishment'], queryFn: getEstablishment });
  const { data: scenariosData } = useQuery({
    queryKey: ['maps', 'scenarios'],
    queryFn: getScenarios,
    retry: 1,
  });

  const establishment = establishmentData ?? null;
  const sites = establishment?.sites ?? [];
  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0];
  const buildings = selectedSite?.buildings ?? [];
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? buildings[0];
  const floors = selectedBuilding?.floors ?? [];
  const selectedFloor = floors.find((f) => f.id === selectedFloorId) ?? floors[0];
  const floorplanId = selectedFloor?.floorplanId;

  const { data: overlayData } = useQuery({
    queryKey: ['maps', 'floorplan-overlay', floorplanId],
    queryFn: () => getFloorplanOverlay(floorplanId!),
    enabled: !!floorplanId && siteScope === 'specific',
  });

  const zonesFromOverlay = overlayData?.zones ?? [];
  const zones = useMemo(() => {
    if (!floorplanId) return [];
    const byLabel = new Map<string, string>();
    for (const z of zonesFromOverlay) {
      const label = z.labelName || z.name || z.id;
      if (label && !byLabel.has(label)) {
        byLabel.set(label, `${floorplanId}:${label}`);
      }
    }
    return Array.from(byLabel.entries()).map(([label, id]) => ({ id, label }));
  }, [zonesFromOverlay, floorplanId]);

  const zoneId =
    siteScope === 'all'
      ? 'all'
      : selectedZoneId;

  const FALLBACK_SCENARIOS: Scenario[] = [
    { id: 'fallback-1', name: 'Active Threat Lockdown', type: 'lockdown', priority: 'critical' },
    { id: 'fallback-2', name: 'Fire Evacuation', type: 'evacuate', priority: 'critical' },
    { id: 'fallback-3', name: 'Chemical Spill Invacuation', type: 'invacuate', priority: 'high' },
    { id: 'fallback-4', name: 'Weather Alert Standby', type: 'standby', priority: 'medium' },
    { id: 'fallback-5', name: 'Monthly Fire Drill', type: 'test', priority: 'medium' },
  ];
  const scenariosFromApi = Array.isArray(scenariosData) ? scenariosData : [];
  const scenarios = scenariosFromApi.length > 0 ? scenariosFromApi : FALLBACK_SCENARIOS;

  const scenariosByType = useMemo(() => {
    const map = new Map<IncidentType, Scenario[]>();
    for (const s of scenarios) {
      const t = s.type as IncidentType;
      if (INCIDENT_TYPE_META[t]) {
        const list = map.get(t) || [];
        list.push(s);
        map.set(t, list);
      }
    }
    return map;
  }, [scenarios]);

  const incidentTypesWithScenarios = useMemo(() => {
    return (['lockdown', 'evacuate', 'invacuate', 'standby', 'test'] as IncidentType[]).filter(
      (t) => (scenariosByType.get(t)?.length ?? 0) > 0
    );
  }, [scenariosByType]);

  const scenariosForSelectedType = selectedIncidentType
    ? scenariosByType.get(selectedIncidentType) ?? []
    : [];

  const triggerMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !selectedScenario) throw new Error('Not signed in or no scenario selected');
      const { incidentId } = await triggerIncident({
        orgId,
        scenarioId: selectedScenario.id,
        incidentType: selectedScenario.type,
        zoneId: zoneId === 'all' ? undefined : zoneId || undefined,
        isDrill,
      });
      return { id: incidentId };
    },
    onSuccess: (data) => {
      const label =
        selectedScenario?.type
          ? INCIDENT_TYPE_LABELS[selectedScenario.type] ?? 'Incident'
          : 'Incident';
      navigation.replace('IncidentTriggering', {
        incidentId: data.id,
        incidentType: label,
      });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to trigger incident';
      Alert.alert('Error', message);
    },
  });

  const handleConfirmTrigger = async () => {
    if (!selectedScenario) return;
    setBiometricChecking(true);
    try {
      // Skip auth only on simulator — real devices always authenticate, even in dev builds.
      if (!Constants.isDevice) {
        setShowConfirm(false);
        triggerMutation.mutate();
        return;
      }
      const result = await authenticateDevice(`Verify identity to trigger ${selectedScenario.name}`);
      setShowConfirm(false);
      if (result.success) {
        triggerMutation.mutate();
      } else if (result.error) {
        Alert.alert('Verification failed', result.error);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBiometricChecking(false);
    }
  };

  const handleBack = () => {
    if (selectedScenario) {
      setSelectedScenario(null);
      setSiteScope('all');
      setSelectedSiteId('');
      setSelectedBuildingId('');
      setSelectedFloorId('');
      setSelectedZoneId('');
    } else if (selectedIncidentType) {
      setSelectedIncidentType(null);
    }
  };

  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) setSelectedSiteId(sites[0].id);
  }, [sites, selectedSiteId]);
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) setSelectedBuildingId(buildings[0].id);
  }, [buildings, selectedBuildingId]);
  useEffect(() => {
    if (floors.length > 0 && !selectedFloorId) setSelectedFloorId(floors[0].id);
  }, [floors, selectedFloorId]);

  const meta = selectedIncidentType ? INCIDENT_TYPE_META[selectedIncidentType] : null;
  const isLockdown = selectedIncidentType === 'lockdown';
  const canTrigger =
    selectedScenario &&
    !triggerMutation.isPending &&
    (!isLockdown || (siteScope === 'all') || (siteScope === 'specific' && selectedZoneId));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.warningBanner}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Only trigger in a real emergency. Misuse may have serious consequences.
        </Text>
      </View>

      <Text style={styles.label}>Mark as Drill (test scenario)</Text>
      <TouchableOpacity
        style={[styles.toggle, isDrill && styles.toggleOn]}
        onPress={() => setIsDrill(!isDrill)}
      >
        <Text style={styles.toggleText}>{isDrill ? 'Yes – Drill' : 'No – Live incident'}</Text>
      </TouchableOpacity>

      {incidentTypesWithScenarios.length === 0 && !selectedIncidentType && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            No scenarios available. Create and approve scenarios in the web dashboard. If you have scenarios, check that the API is reachable (network and API URL).
          </Text>
        </View>
      )}

      {!selectedIncidentType && incidentTypesWithScenarios.length > 0 && (
        <>
          <Text style={styles.label}>Select Incident Type</Text>
          {incidentTypesWithScenarios.map((type) => {
            const m = INCIDENT_TYPE_META[type];
            const count = scenariosByType.get(type)?.length ?? 0;
            return (
              <Pressable
                key={type}
                style={({ pressed }) => [
                  styles.incidentTypeCard,
                  m.isCritical && styles.incidentTypeCardLockdown,
                  { borderLeftColor: m.color },
                  pressed && styles.cardPressed,
                ]}
                onPress={() => setSelectedIncidentType(type)}
              >
                <MaterialCommunityIcons
                  name={m.icon as any}
                  size={28}
                  color={m.color}
                  style={styles.incidentTypeIcon}
                />
                <View style={styles.incidentTypeContent}>
                  <Text style={[styles.incidentTypeName, m.isCritical && styles.incidentTypeNameLockdown]}>
                    {m.name}
                  </Text>
                  <Text style={styles.incidentTypeDesc}>{m.description}</Text>
                  <Text style={styles.incidentTypeCount}>{count} scenario{count !== 1 ? 's' : ''} available</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
              </Pressable>
            );
          })}
        </>
      )}

      {selectedIncidentType && !selectedScenario && (
        <>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.label}>
            Select Scenario – {INCIDENT_TYPE_META[selectedIncidentType].name}
          </Text>
          {scenariosForSelectedType.map((s) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [
                styles.scenarioCard,
                meta?.isCritical && styles.scenarioCardLockdown,
                { borderLeftColor: meta?.color ?? colors.border },
                pressed && styles.cardPressed,
              ]}
              onPress={() => setSelectedScenario(s)}
            >
              <Text style={[styles.scenarioName, meta?.isCritical && styles.scenarioNameLockdown]}>
                {s.name}
              </Text>
              <Text style={styles.scenarioMeta}>
                {s.priority} priority • {s.type}
              </Text>
            </Pressable>
          ))}
        </>
      )}

      {selectedScenario && (
        <>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          {meta && (
            <View style={[styles.incidentTypeBanner, { backgroundColor: `${meta.color}22`, borderColor: meta.color }]}>
              <MaterialCommunityIcons name={meta.icon as any} size={28} color={meta.color} />
              <View style={styles.incidentTypeBannerContent}>
                <Text style={[styles.incidentTypeBannerTitle, { color: meta.color }]}>{meta.name}</Text>
                <Text style={styles.incidentTypeBannerSubtitle}>{selectedScenario.name}</Text>
              </View>
            </View>
          )}

          <Text style={styles.label}>Scope {isLockdown ? '(required)' : '(optional)'}</Text>

          <Text style={styles.subLabel}>Site</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
            <TouchableOpacity
              style={[styles.chip, siteScope === 'all' && styles.chipSelected]}
              onPress={() => {
                setSiteScope('all');
                setSelectedZoneId('');
              }}
            >
              <Text style={styles.chipText}>All</Text>
            </TouchableOpacity>
            {sites.map((s) => {
              const siteBuildings = s.buildings ?? [];
              const firstBuilding = siteBuildings[0];
              const siteFloors = firstBuilding?.floors ?? [];
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, siteScope === 'specific' && selectedSiteId === s.id && styles.chipSelected]}
                  onPress={() => {
                    setSiteScope('specific');
                    setSelectedSiteId(s.id);
                    setSelectedBuildingId(firstBuilding?.id ?? '');
                    setSelectedFloorId(siteFloors[0]?.id ?? '');
                    setSelectedZoneId('');
                  }}
                >
                  <Text style={styles.chipText}>{s.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {siteScope === 'specific' && sites.length > 0 && (
            <>
              {buildings.length > 1 && (
                <>
                  <Text style={styles.subLabel}>Building</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                    {buildings.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.chip, selectedBuildingId === b.id && styles.chipSelected]}
                        onPress={() => {
                          setSelectedBuildingId(b.id);
                          setSelectedFloorId(b.floors[0]?.id ?? '');
                          setSelectedZoneId('');
                        }}
                      >
                        <Text style={styles.chipText}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              <Text style={styles.subLabel}>Floor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                {floors.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, selectedFloorId === f.id && styles.chipSelected]}
                    onPress={() => {
                      setSelectedFloorId(f.id);
                      setSelectedZoneId('');
                    }}
                  >
                    <Text style={styles.chipText}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.subLabel}>Zone (label)</Text>
              {zones.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                  {zones.map((z) => (
                    <TouchableOpacity
                      key={z.id}
                      style={[styles.chip, selectedZoneId === z.id && styles.chipSelected]}
                      onPress={() => setSelectedZoneId(z.id)}
                    >
                      <Text style={styles.chipText}>{z.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.hintText}>
                  No zones on this floor. Use a floor with a floor plan, or select All for site-wide.
                </Text>
              )}
            </>
          )}

          <View style={styles.biometricBadge}>
            <MaterialCommunityIcons name={authInfo.icon as any} size={14} color="#93c5fd" style={{ marginRight: 6 }} />
            <Text style={styles.biometricBadgeText}>Requires {authInfo.label} to trigger</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.triggerButton,
              meta?.isCritical && styles.triggerButtonLockdown,
            ]}
            onPress={() => setShowConfirm(true)}
            disabled={!canTrigger}
          >
            {triggerMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.triggerButtonText}>
                {meta?.isCritical ? '⚠️ TRIGGER LOCKDOWN' : `Trigger ${selectedScenario.name}`}
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <Modal visible={showConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, meta?.isCritical && styles.modalContentLockdown]}>
            <Text style={[styles.modalTitle, meta?.isCritical && styles.modalTitleLockdownConfirm]}>
              {meta?.isCritical ? '⚠️ Confirm LOCKDOWN' : 'Confirm'}
            </Text>
            <Text style={styles.modalBody}>
              You are about to trigger: {selectedScenario?.name}.{' '}
              {isDrill ? 'This is a DRILL.' : 'This is a LIVE incident.'}
            </Text>
            {meta?.isCritical && !isDrill && (
              <Text style={styles.modalBodyDanger}>
                This will lock doors and alert everyone on site. Only proceed if there is an immediate threat.
              </Text>
            )}
            <Text style={styles.modalBodyHint}>
              You will need to verify your identity with your {authInfo.label.toLowerCase()} to proceed.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}
                disabled={biometricChecking}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, biometricChecking && styles.buttonDisabled]}
                onPress={handleConfirmTrigger}
                disabled={biometricChecking}
              >
                {biometricChecking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Verify & Trigger</Text>
                )}
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  warningIcon: { fontSize: 20, marginRight: 10 },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#fbbf24',
    fontWeight: '600',
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8, marginTop: 16 },
  subLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  hintText: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  toggle: {
    padding: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleOn: { borderColor: colors.primary },
  toggleText: { color: colors.text, fontSize: 16 },
  emptyState: {
    padding: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: { color: colors.textSecondary, fontSize: 14 },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  incidentTypeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 20,
  },
  incidentTypeBannerContent: { marginLeft: 14, flex: 1 },
  incidentTypeBannerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  incidentTypeBannerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  incidentTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    marginBottom: 12,
  },
  incidentTypeCardLockdown: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: colors.lockdown,
  },
  incidentTypeIcon: { marginRight: 14 },
  incidentTypeContent: { flex: 1 },
  incidentTypeName: { fontSize: 18, fontWeight: '700', color: colors.text },
  incidentTypeNameLockdown: { color: '#fca5a5', letterSpacing: 1 },
  incidentTypeDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  incidentTypeCount: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  scenarioCard: {
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    marginBottom: 12,
  },
  scenarioCardLockdown: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: colors.lockdown,
  },
  scenarioName: { fontSize: 16, fontWeight: '600', color: colors.text },
  scenarioNameLockdown: { color: '#fca5a5' },
  scenarioMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  cardPressed: { opacity: 0.9 },
  chipList: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14 },
  biometricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  biometricBadgeText: { fontSize: 12, color: '#93c5fd', fontWeight: '600' },
  triggerButton: {
    backgroundColor: colors.error,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  triggerButtonLockdown: {
    backgroundColor: colors.lockdown,
    padding: 20,
    borderWidth: 2,
    borderColor: '#f87171',
  },
  triggerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
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
  },
  modalContentLockdown: {
    borderWidth: 2,
    borderColor: colors.lockdown,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  modalTitleLockdownConfirm: { color: '#fca5a5', fontSize: 22 },
  modalBody: { fontSize: 16, color: colors.textSecondary, marginBottom: 12 },
  modalBodyDanger: {
    fontSize: 15,
    color: '#fca5a5',
    fontWeight: '600',
    marginBottom: 12,
  },
  modalBodyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.background },
  cancelButtonText: { color: colors.text },
  primaryButton: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
