/**
 * CCTV: pick site → building → floor, then view cameras in that area.
 * Cameras come from floorplan overlay devices (type === 'camera') on the dashboard.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { getStructure, getCameras, type StructureSite, type StructureBuilding, type StructureFloor, type Camera } from '../api/maps';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';

type Step = 'site' | 'building' | 'floor' | 'cameras';

export default function CTVScreen() {
  const { user } = useAuth();
  const orgId = user?.orgId ?? user?.organizationCode;
  const [step, setStep] = useState<Step>('site');
  const [selectedSite, setSelectedSite] = useState<StructureSite | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<StructureBuilding | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<StructureFloor | null>(null);

  const { data: structure = [], isLoading: structureLoading, isError: structureError, error: structureErr, refetch: refetchStructure } = useQuery({
    queryKey: ['maps', 'structure', orgId ?? ''],
    queryFn: async () => {
      const result = await getStructure();
      if (__DEV__) console.log('[CCTV] structure loaded', result?.length, 'sites');
      return result;
    },
    enabled: !!orgId,
  });

  const floorplanId = selectedFloor?.floorplanId;
  const { data: cameras = [], isLoading: camerasLoading } = useQuery({
    queryKey: ['maps', 'cameras', floorplanId],
    queryFn: () => getCameras(floorplanId!),
    enabled: step === 'cameras' && !!floorplanId,
  });

  const handleSelectSite = (site: StructureSite) => {
    setSelectedSite(site);
    setSelectedBuilding(null);
    setSelectedFloor(null);
    setStep('building');
  };

  const handleSelectBuilding = (building: StructureBuilding) => {
    setSelectedBuilding(building);
    setSelectedFloor(null);
    setStep('floor');
  };

  const handleSelectFloor = (floor: StructureFloor) => {
    setSelectedFloor(floor);
    setStep('cameras');
  };

  const handleBack = () => {
    if (step === 'cameras') {
      setSelectedFloor(null);
      setStep('floor');
    } else if (step === 'floor') {
      setSelectedBuilding(null);
      setStep('building');
    } else if (step === 'building') {
      setSelectedSite(null);
      setStep('site');
    }
  };

  const canBack = step !== 'site';
  const breadcrumb =
    step === 'site'
      ? 'Select site'
      : step === 'building'
        ? selectedSite?.name ?? 'Building'
        : step === 'floor'
          ? `${selectedSite?.name} → ${selectedBuilding?.name}`
          : `${selectedSite?.name} → ${selectedBuilding?.name} → ${selectedFloor?.name}`;

  return (
    <View style={styles.container}>
      {canBack && (
        <TouchableOpacity style={styles.backRow} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.breadcrumb} numberOfLines={2}>
        {breadcrumb}
      </Text>

      {step === 'site' && (
        <>
          {structureLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
          ) : structureError ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={32} color={colors.error} />
              <Text style={styles.errorTitle}>Could not load sites</Text>
              <Text style={styles.errorMessage}>
                {structureErr && typeof structureErr === 'object' && 'message' in structureErr
                  ? String((structureErr as { message: string }).message)
                  : 'Check your connection and that the API is deployed (npm run deploy).'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => refetchStructure()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {structure.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No sites configured</Text>
                  <Text style={styles.emptySubtitle}>
                    Add sites in the web dashboard under Sites & Zones, or ensure your organization has establishment data.
                  </Text>
                </View>
              ) : (
                structure.map((site) => (
                  <TouchableOpacity
                    key={site.id}
                    style={styles.optionCard}
                    onPress={() => handleSelectSite(site)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIconWrap}>
                      <Ionicons name="business" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.optionLabel}>{site.name}</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {step === 'building' && selectedSite && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {selectedSite.buildings.map((building) => (
            <TouchableOpacity
              key={building.id}
              style={styles.optionCard}
              onPress={() => handleSelectBuilding(building)}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconWrap}>
                <Ionicons name="business-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.optionLabel}>{building.name}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {step === 'floor' && selectedBuilding && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {selectedBuilding.floors.map((floor) => (
            <TouchableOpacity
              key={floor.id}
              style={styles.optionCard}
              onPress={() => handleSelectFloor(floor)}
              activeOpacity={0.7}
            >
              <View style={styles.optionIconWrap}>
                <Ionicons name="layers-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.optionLabel}>{floor.name}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {step === 'cameras' && (
        <>
          {camerasLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {cameras.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="videocam-off-outline" size={48} color={colors.textSecondary} />
                  <Text style={styles.emptyTitle}>No cameras in this area</Text>
                  <Text style={styles.emptySubtitle}>
                    Add cameras on the dashboard floorplan for this floor to see them here.
                  </Text>
                </View>
              ) : (
                cameras.map((cam) => (
                  <View key={cam.id} style={styles.cameraCard}>
                    <View style={styles.cameraIconWrap}>
                      <Ionicons name="videocam" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.cameraInfo}>
                      <Text style={styles.cameraName}>{cam.name}</Text>
                      {cam.description ? (
                        <Text style={styles.cameraDesc}>{cam.description}</Text>
                      ) : null}
                      {cam.zoneName ? (
                        <Text style={styles.cameraZone}>{cam.zoneName}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: colors.primary,
    marginLeft: 4,
  },
  breadcrumb: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 32 },
  spinner: { marginTop: 48 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cameraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cameraIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cameraInfo: { flex: 1 },
  cameraName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cameraDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cameraZone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
