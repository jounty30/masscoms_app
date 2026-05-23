import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRoute } from '@react-navigation/native';
import { useAuth } from '../auth/AuthContext';
import { useEstablishment } from '../lib/useEstablishment';
import type { Site, Building, Floor } from '../lib/useEstablishment';
import { useFloorplanOverlay } from '../lib/useFloorplanOverlay';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../ws/WebSocketContext';
import FloorplanView, { type CheckpointStats } from '../components/FloorplanView';
import { getOnSiteRoster } from '../api/presence';
import { colors } from '../theme';
import type { Device } from '../lib/useFloorplanOverlay';

const DEFAULT_FLOORS: Floor[] = [
  { id: 'ground', name: 'Ground Floor', floorplanId: undefined, floorplanUrl: undefined },
  { id: 'first', name: '1st Floor', floorplanId: undefined, floorplanUrl: undefined },
  { id: 'second', name: '2nd Floor', floorplanId: undefined, floorplanUrl: undefined },
];

const DEFAULT_ZONE_LEGEND: [string, string][] = [
  ['Zone 1', '#6db06e'],
  ['Zone 2', '#e561da'],
  ['Zone 3', '#e1f73b'],
  ['Zone 4', '#f7963b'],
  ['Zone 5', '#00d5ff'],
  ['Zone 6', '#f00000'],
  ['Zone 7', '#94a3b8'],
  ['Zone 8', '#64748b'],
];

export default function MapViewScreen() {
  const route = useRoute();
  const { user } = useAuth();
  const orgId = user?.orgId ?? user?.organizationCode;
  const incidentId = (route.params as { incidentId?: string } | undefined)?.incidentId;
  const queryClient = useQueryClient();
  const { lastEvent } = useWebSocket();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<{
    name: string;
    names: string[];
  } | null>(null);
  const [selectedZoneForControls, setSelectedZoneForControls] = useState<{
    zoneId: string;
    zoneLabel: string;
    checkpoints: string[];
    roomNames: string[];
    cameras: Device[];
    speakers: Device[];
  } | null>(null);
  const [tannoyDemoPlaying, setTannoyDemoPlaying] = useState(false);

  const { data: roster = [] } = useQuery({
    queryKey: ['presence', 'roster', incidentId],
    queryFn: () => getOnSiteRoster(incidentId),
    enabled: !!incidentId,
    refetchInterval: incidentId ? 5000 : false,
  });

  useEffect(() => {
    if (lastEvent?.type === 'person-marked-safe') {
      queryClient.invalidateQueries({ queryKey: ['presence', 'roster'] });
    }
  }, [lastEvent, queryClient]);

  const { total, accounted, missing, checkpointStats } = useMemo(() => {
    const total = roster.length;
    const accounted = roster.filter((p) => p.acknowledged).length;
    const missing = total - accounted;
    const stats: Record<string, CheckpointStats> = {};
    for (const p of roster) {
      if (p.acknowledged && p.checkpointName) {
        const key = p.checkpointName.trim();
        if (!stats[key]) stats[key] = { count: 0, names: [] };
        stats[key].count += 1;
        stats[key].names.push(p.name);
      }
    }
    return { total, accounted, missing, checkpointStats: stats };
  }, [roster]);

  const { establishment, loading: establishmentLoading, error: establishmentError, refetch: refetchEstablishment } = useEstablishment(orgId);
  const [refreshing, setRefreshing] = useState(false);
  const [mapFullScreen, setMapFullScreen] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetchEstablishment();
    setRefreshing(false);
  };

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

  const hasOverlayData = zones.length > 0 || (boundary && boundary.length > 0) || devices.length > 0;
  const showFloorplan = hasOverlayData || floorplanUrl;

  const zoneLegendRows = useMemo(() => {
    const zoneColorMap = new Map(zones.map((z) => [z.id, { color: z.color, label: z.labelName || z.name }]));
    const assemblyDevices = devices.filter((d) => d.type === 'assembly');
    const byLabel = new Map<string, { zoneIds: string[]; color: string; roomNames: string[]; checkpoints: string[] }>();
    for (const z of zones) {
      const zoneLabel = z.labelName || z.name || z.id;
      const roomName = z.name || z.id;
      if (!byLabel.has(zoneLabel)) {
        byLabel.set(zoneLabel, { zoneIds: [], color: z.color, roomNames: [], checkpoints: [] });
      }
      const entry = byLabel.get(zoneLabel)!;
      entry.zoneIds.push(z.id);
      if (roomName && roomName !== zoneLabel) entry.roomNames.push(roomName);
    }
    for (const [label, entry] of byLabel) {
      const checkpointNames = new Set<string>();
      for (const zid of entry.zoneIds) {
        assemblyDevices
          .filter((d) => d.zoneId === zid)
          .forEach((d) => {
            const zone = d.zoneId ? zoneColorMap.get(d.zoneId) : undefined;
            const cp = (d as { zoneName?: string }).zoneName || d.name || zone?.label || d.id;
            if (cp && cp !== label) checkpointNames.add(cp);
          });
      }
      entry.checkpoints = Array.from(checkpointNames);
    }
    const rows = Array.from(byLabel.entries())
      .map(([label, entry]) => ({
        zoneIds: entry.zoneIds,
        label: entry.checkpoints.length > 0 ? `${label} — [${entry.checkpoints.join(', ')}]` : label,
        color: entry.color,
        checkpoints: entry.checkpoints,
        roomNames: [...new Set(entry.roomNames)].sort(),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (rows.length > 0) return rows;
    return DEFAULT_ZONE_LEGEND.map(([label, color], i) => ({
      zoneIds: [`default-${i}`],
      label,
      color,
      checkpoints: [],
      roomNames: [],
    }));
  }, [zones, devices]);

  const handleZoneLegendPress = (row: { zoneIds: string[]; label: string; color: string; checkpoints: string[]; roomNames: string[] }) => {
    const zoneLabel = row.checkpoints.length > 0 ? row.label.split(' — ')[0] || row.label : row.label;
    const zoneCameras = devices.filter((d) => d.type === 'camera' && row.zoneIds.includes(d.zoneId!));
    const zoneSpeakers = devices.filter((d) => d.type === 'speaker' && row.zoneIds.includes(d.zoneId!));
    setSelectedZoneForControls({
      zoneId: row.zoneIds[0] ?? '',
      zoneLabel,
      checkpoints: row.checkpoints,
      roomNames: row.roomNames,
      cameras: zoneCameras,
      speakers: zoneSpeakers,
    });
  };

  const handleSelectSite = (site: Site) => {
    setSelectedSiteId(site.id);
    const firstBuilding = site.buildings?.[0];
    setSelectedBuildingId(firstBuilding?.id ?? '');
    setSelectedFloorId(firstBuilding?.floors?.[0]?.id ?? '');
  };

  const handleSelectBuilding = (building: Building) => {
    setSelectedBuildingId(building.id);
    setSelectedFloorId(building.floors?.[0]?.id ?? '');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {incidentId && (
        <View style={styles.statsBar}>
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statValue}>{total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statPill, styles.statPillGreen]}>
              <Text style={styles.statValue}>{accounted}</Text>
              <Text style={styles.statLabel}>Accounted</Text>
            </View>
            <View style={[styles.statPill, styles.statPillRed]}>
              <Text style={styles.statValue}>{missing}</Text>
              <Text style={styles.statLabel}>Missing</Text>
            </View>
          </View>
          <Text style={styles.statsHint}>Tap a checkpoint on the map to see who's there</Text>
        </View>
      )}

      <View style={styles.locationCard}>
        <Text style={styles.locationLabel}>Your location</Text>
        <Text style={styles.locationValue}>
          {establishment?.name || 'Use the map to find exits and assembly points'}
        </Text>
        {selectedSite && (
          <Text style={styles.locationSub}>
            {selectedSite.name}{selectedBuilding ? ` — ${selectedBuilding.name}` : ''}
          </Text>
        )}
      </View>

      {sites.length > 1 && (
        <>
          <Text style={styles.label}>Site</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipList}>
            {sites.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.floorChip, selectedSiteId === s.id && styles.floorChipSelected]}
                onPress={() => handleSelectSite(s)}
              >
                <Text style={[styles.floorChipText, selectedSiteId === s.id && styles.floorChipTextSelected]}>
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
                style={[styles.floorChip, selectedBuildingId === b.id && styles.floorChipSelected]}
                onPress={() => handleSelectBuilding(b)}
              >
                <Text style={[styles.floorChipText, selectedBuildingId === b.id && styles.floorChipTextSelected]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {floors.length > 0 && (
        <>
          <Text style={styles.label}>{currentFloor?.name || 'Floor'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.floorList}>
            {floors.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.floorChip, selectedFloor === f.id && styles.floorChipSelected]}
                onPress={() => setSelectedFloorId(f.id)}
              >
                <Text style={[styles.floorChipText, selectedFloor === f.id && styles.floorChipTextSelected]}>
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
      {!establishmentLoading && sites.length === 0 && (
        <View style={[styles.emptyHint, establishmentError && styles.emptyHintError]}>
          <Text style={styles.emptyHintText}>
            {establishmentError
              ? `Could not load map data: ${establishmentError}. Check your connection and API URL.`
              : 'No sites configured. Set up your establishment (sites, buildings, floors) in the web dashboard.'}
          </Text>
        </View>
      )}

      <View style={styles.mapWrapper}>
        {establishmentLoading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mapPlaceholderSubtext}>Loading floor plan...</Text>
          </View>
        ) : showFloorplan ? (
          <>
            <FloorplanView
              zones={zones}
              boundary={boundary}
              devices={devices}
              imageUrl={floorplanUrl}
              checkpointStats={incidentId ? checkpointStats : undefined}
              onCheckpointPress={
                incidentId
                  ? (_, name, names) => setSelectedCheckpoint({ name, names })
                  : undefined
              }
            />
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setMapFullScreen(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.expandButtonText}>⛶</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>Floor plan</Text>
            <Text style={styles.mapPlaceholderSubtext}>No image for this floor</Text>
          </View>
        )}
      </View>

      <Modal
        visible={mapFullScreen}
        animationType="fade"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => setMapFullScreen(false)}
      >
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity
            style={styles.fullScreenClose}
            onPress={() => setMapFullScreen(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.fullScreenCloseText}>✕</Text>
          </TouchableOpacity>
          {showFloorplan && (
            <View style={styles.fullScreenMap}>
              <FloorplanView
                zones={zones}
                boundary={boundary}
                devices={devices}
                imageUrl={floorplanUrl}
                fullScreen
                checkpointStats={incidentId ? checkpointStats : undefined}
                onCheckpointPress={
                  incidentId
                    ? (_, name, names) => {
                        setSelectedCheckpoint({ name, names });
                        setMapFullScreen(false);
                      }
                    : undefined
                }
              />
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={!!selectedCheckpoint} transparent animationType="fade">
        <Pressable
          style={styles.checkpointModalOverlay}
          onPress={() => setSelectedCheckpoint(null)}
        >
          <View style={styles.checkpointModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.checkpointModalTitle}>
              {selectedCheckpoint?.name || 'Checkpoint'}
            </Text>
            <Text style={styles.checkpointModalSubtitle}>
              {selectedCheckpoint?.names.length ?? 0} people accounted for
            </Text>
            <ScrollView
              style={styles.checkpointNamesList}
              contentContainerStyle={styles.checkpointNamesContent}
            >
              {selectedCheckpoint?.names.map((n, i) => (
                <Text key={i} style={styles.checkpointNameItem}>
                  • {n}
                </Text>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.checkpointModalClose}
              onPress={() => setSelectedCheckpoint(null)}
            >
              <Text style={styles.checkpointModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        <Text style={styles.legendSubtitle}>Zones — tap for CCTV & Tannoy</Text>
        {zoneLegendRows.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={styles.legendButton}
            onPress={() => handleZoneLegendPress(row)}
            activeOpacity={0.7}
          >
            <View style={[styles.legendDot, { backgroundColor: row.color }]} />
            <Text style={styles.legendText} numberOfLines={2}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={!!selectedZoneForControls} transparent animationType="fade">
        <Pressable
          style={styles.zoneModalOverlay}
          onPress={() => {
            setSelectedZoneForControls(null);
            setTannoyDemoPlaying(false);
          }}
        >
          <View style={styles.zoneModal} onStartShouldSetResponder={() => true}>
            <Text style={styles.zoneModalTitle}>
              {selectedZoneForControls?.zoneLabel || 'Zone'}
            </Text>
            {selectedZoneForControls?.roomNames && selectedZoneForControls.roomNames.length > 0 ? (
              <Text style={styles.zoneModalSubtitle}>
                Rooms: {selectedZoneForControls.roomNames.join(', ')}
              </Text>
            ) : null}
            {selectedZoneForControls?.checkpoints.length ? (
              <Text style={styles.zoneModalSubtitle}>
                Checkpoints: {selectedZoneForControls.checkpoints.join(', ')}
              </Text>
            ) : null}

            <Text style={styles.zoneSectionTitle}>CCTV screens</Text>
            <View style={styles.cctvGrid}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={styles.cctvFeed}>
                  <View style={styles.cctvFeedInner}>
                    <View style={styles.cctvLiveBadge}>
                      <Text style={styles.cctvLiveText}>LIVE</Text>
                    </View>
                    <Ionicons name="videocam" size={24} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.cctvFeedLabel}>Camera {n}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.zoneSectionTitle}>Tannoy override (speakers)</Text>
            {selectedZoneForControls?.speakers.length ? (
              <ScrollView style={styles.zoneSectionList} nestedScrollEnabled>
                {selectedZoneForControls.speakers.map((sp) => (
                  <View key={sp.id} style={styles.zoneDeviceRow}>
                    <Ionicons name="volume-high" size={20} color={colors.primary} />
                    <Text style={styles.zoneDeviceName}>{sp.name}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.zoneEmpty}>No speakers in this zone</Text>
            )}
            <TouchableOpacity
              style={[styles.tannoyDemoButton, tannoyDemoPlaying && styles.tannoyDemoButtonActive]}
              onPress={() => {
                setTannoyDemoPlaying(true);
                setTimeout(() => setTannoyDemoPlaying(false), 2500);
              }}
              disabled={tannoyDemoPlaying}
            >
              <Ionicons name="volume-high" size={20} color="#fff" />
              <Text style={styles.tannoyDemoButtonText}>
                {tannoyDemoPlaying ? 'Playing demo announcement...' : 'Demo announcement'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.zoneModalClose}
              onPress={() => {
                setSelectedZoneForControls(null);
                setTannoyDemoPlaying(false);
              }}
            >
              <Text style={styles.zoneModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingBottom: 48 },
  locationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  locationLabel: { fontSize: 12, color: colors.primary, marginBottom: 4 },
  locationValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  locationSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  chipList: { marginBottom: 16 },
  floorList: { marginBottom: 24 },
  floorChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  floorChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  floorChipText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  floorChipTextSelected: { color: '#fff' },
  mapWrapper: {
    aspectRatio: 1,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  expandButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButtonText: { fontSize: 20, color: '#fff' },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullScreenClose: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenCloseText: { fontSize: 22, color: '#fff' },
  fullScreenMap: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: { fontSize: 18, color: colors.text, marginBottom: 4 },
  mapPlaceholderSubtext: { fontSize: 14, color: colors.textSecondary },
  legend: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyHint: {
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 24,
  },
  emptyHintError: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  emptyHintText: { fontSize: 14, color: colors.textSecondary },
  statsBar: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statPillGreen: { borderColor: colors.success, backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  statPillRed: { borderColor: colors.error, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statsHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  checkpointModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  checkpointModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    maxWidth: 320,
    maxHeight: '70%',
    width: '100%',
  },
  checkpointModalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  checkpointModalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  checkpointNamesList: { maxHeight: 200, marginBottom: 16 },
  checkpointNamesContent: { paddingRight: 8 },
  checkpointNameItem: { fontSize: 15, color: colors.text, marginBottom: 6 },
  checkpointModalClose: {
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkpointModalCloseText: { color: '#fff', fontWeight: '600' },
  legendTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
  legendSubtitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  legendText: { flex: 1, fontSize: 14, color: colors.text },
  zoneModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  zoneModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    maxWidth: 360,
    maxHeight: '80%',
    width: '100%',
  },
  zoneModalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  zoneModalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  zoneSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 8 },
  zoneSectionList: { maxHeight: 120, marginBottom: 4 },
  zoneDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 6,
  },
  zoneDeviceName: { fontSize: 15, color: colors.text, marginLeft: 10 },
  zoneEmpty: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 8 },
  cctvGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cctvFeed: {
    width: '32%',
    aspectRatio: 4 / 3,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  cctvFeedInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cctvLiveBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#dc2626',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cctvLiveText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  cctvFeedLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  tannoyDemoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginTop: 8,
  },
  tannoyDemoButtonActive: { backgroundColor: colors.textSecondary, opacity: 0.9 },
  tannoyDemoButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  zoneModalClose: {
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  zoneModalCloseText: { color: '#fff', fontWeight: '600' },
});
