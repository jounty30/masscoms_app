/**
 * Modal for picking a location on the map (site, building, floor + tap zone/checkpoint).
 * Used in Request Assistance to capture "Where Are You".
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useEstablishment } from '../lib/useEstablishment';
import type { Site, Building, Floor } from '../lib/useEstablishment';
import { useFloorplanOverlay } from '../lib/useFloorplanOverlay';
import FloorplanView from './FloorplanView';
import { colors } from '../theme';

const DEFAULT_FLOORS: Floor[] = [
  { id: 'ground', name: 'Ground Floor', floorplanId: undefined, floorplanUrl: undefined },
  { id: 'first', name: '1st Floor', floorplanId: undefined, floorplanUrl: undefined },
  { id: 'second', name: '2nd Floor', floorplanId: undefined, floorplanUrl: undefined },
];

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: string) => void;
  orgId: string | undefined;
}

export default function LocationPickerModal({
  visible,
  onClose,
  onSelect,
  orgId,
}: LocationPickerModalProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');

  const { establishment, loading } = useEstablishment(orgId);
  const sites = establishment?.sites ?? [];
  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? sites[0],
    [sites, selectedSiteId],
  );
  const buildings = selectedSite?.buildings ?? [];
  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId) ?? buildings[0],
    [buildings, selectedBuildingId],
  );
  const floors =
    (selectedBuilding?.floors?.length ?? 0) > 0
      ? selectedBuilding!.floors
      : sites.length > 0
        ? DEFAULT_FLOORS
        : [];
  const selectedFloor = selectedFloorId || floors[0]?.id;
  const currentFloor = floors.find((f) => f.id === selectedFloor);

  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) setSelectedSiteId(sites[0].id);
  }, [sites, selectedSiteId]);
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) setSelectedBuildingId(buildings[0].id);
  }, [buildings, selectedBuildingId]);

  const floorplanId = currentFloor?.floorplanId;
  const floorplanUrl = currentFloor?.floorplanUrl;
  const { zones, devices, boundary } = useFloorplanOverlay(orgId, floorplanId);

  const handleLocationSelect = (locationName: string) => {
    const context = [selectedSite?.name, selectedBuilding?.name, currentFloor?.name]
      .filter(Boolean)
      .join(' • ');
    const fullLocation = context ? `${locationName} (${context})` : locationName;
    onSelect(fullLocation);
    onClose();
  };

  const hasOverlayData = zones.length > 0 || (boundary && boundary.length > 0) || devices.length > 0;
  const showFloorplan = hasOverlayData || floorplanUrl;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Where Are You?</Text>
            <Text style={styles.subtitle}>Select site, building, floor, then tap your location on the map</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {sites.length > 1 && (
            <>
              <Text style={styles.label}>Site</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                {sites.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, selectedSiteId === s.id && styles.chipSelected]}
                    onPress={() => {
                      setSelectedSiteId(s.id);
                      setSelectedBuildingId(s.buildings?.[0]?.id ?? '');
                      setSelectedFloorId(s.buildings?.[0]?.floors?.[0]?.id ?? '');
                    }}
                  >
                    <Text style={[styles.chipText, selectedSiteId === s.id && styles.chipTextSelected]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {buildings.length > 1 && (
            <>
              <Text style={styles.label}>Building</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                {buildings.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.chip, selectedBuildingId === b.id && styles.chipSelected]}
                    onPress={() => {
                      setSelectedBuildingId(b.id);
                      setSelectedFloorId(b.floors?.[0]?.id ?? '');
                    }}
                  >
                    <Text style={[styles.chipText, selectedBuildingId === b.id && styles.chipTextSelected]}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {floors.length > 0 && (
            <>
              <Text style={styles.label}>Floor</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
                {floors.map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.chip, selectedFloor === f.id && styles.chipSelected]}
                    onPress={() => setSelectedFloorId(f.id)}
                  >
                    <Text style={[styles.chipText, selectedFloor === f.id && styles.chipTextSelected]}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <View style={styles.mapWrapper}>
            {loading ? (
              <View style={styles.placeholder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.placeholderText}>Loading map...</Text>
              </View>
            ) : showFloorplan ? (
              <FloorplanView
                zones={zones}
                boundary={boundary}
                devices={devices}
                imageUrl={floorplanUrl}
                onZoneSelect={(_, name) => handleLocationSelect(name)}
                onCheckpointSelect={(_, name) => handleLocationSelect(name)}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>No floorplan for this floor</Text>
                <Text style={styles.placeholderSub}>Add a floorplan in the web dashboard</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 18, color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chipList: { marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: '#fff' },
  mapWrapper: {
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 16, color: colors.text },
  placeholderSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
