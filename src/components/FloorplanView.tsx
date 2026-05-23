/**
 * Interactive floor plan with polygon zones, pinch-to-zoom and pan.
 * Uses react-native-svg for rendering and react-native-gesture-handler + reanimated for gestures.
 * Zone labels are hidden; tap a zone to reveal its name.
 */
import React, { useState } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Polygon, Circle, Rect, Text as SvgText, G } from 'react-native-svg';
import type { Point, Zone, Device } from '../lib/useFloorplanOverlay';
import { colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_SIZE = SCREEN_WIDTH - 48;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

const DEVICE_COLORS: Record<string, string> = {
  speaker: '#10B981',
  signage: '#F59E0B',
  assembly: '#EF4444',
  exitDoor: '#8B5CF6',
  exit: '#DC2626',
  camera: '#06B6D4',
  doorAccess: '#F97316',
};

function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const open = points.length >= 2 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y
    ? points.slice(0, -1)
    : points;
  let sx = 0, sy = 0;
  for (const p of open) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / open.length, y: sy / open.length };
}

function pointsToSvg(points: Point[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}

export interface CheckpointStats {
  count: number;
  names: string[];
}

interface FloorplanViewProps {
  zones: Zone[];
  boundary: Point[] | null;
  devices: Device[];
  imageUrl?: string;
  fullScreen?: boolean;
  /** When provided, shows counts on checkpoints and enables tap-to-view names */
  checkpointStats?: Record<string, CheckpointStats>;
  onCheckpointPress?: (checkpointId: string, checkpointName: string, names: string[]) => void;
  /** When provided, tapping a zone calls this (for location picking) */
  onZoneSelect?: (zoneId: string, zoneName: string) => void;
  /** When provided, tapping a checkpoint calls this (for location picking) */
  onCheckpointSelect?: (checkpointId: string, checkpointName: string) => void;
}

export default function FloorplanView({
  zones,
  boundary,
  devices,
  imageUrl,
  fullScreen,
  checkpointStats,
  onCheckpointPress,
  onZoneSelect,
  onCheckpointSelect,
}: FloorplanViewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const { width: winW, height: winH } = Dimensions.get('window');
  const layoutStyle = fullScreen
    ? { width: winW, height: winH }
    : { width: MAP_SIZE, height: MAP_SIZE };
  const zoneColorMap = new Map(zones.map(z => [z.id, { color: z.color, label: z.labelName || z.name }]));

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.wrapper, layoutStyle, fullScreen && styles.wrapperFullScreen]}>
      <GestureDetector gesture={composed}>
        <View style={styles.container}>
          <Animated.View style={[styles.content, layoutStyle, animatedStyle]}>
            {imageUrl && (
              <Image
                source={{ uri: imageUrl }}
                style={[styles.backgroundImage, layoutStyle, { opacity: 0.1 }]}
                resizeMode={fullScreen ? 'contain' : 'stretch'}
              />
            )}
            <Svg
              viewBox="0 0 100 100"
              preserveAspectRatio={fullScreen ? 'xMidYMid meet' : 'none'}
              style={[styles.svg, layoutStyle]}
            >
              {boundary && boundary.length >= 3 && (
                <Polygon
                  points={pointsToSvg(boundary)}
                  fill="rgba(148,163,184,0.12)"
                  stroke="rgba(148,163,184,0.6)"
                  strokeWidth={0.5}
                />
              )}
              {zones.map((zone) => {
                const c = polygonCentroid(zone.points);
                const roomName = zone.labelName || zone.name;
                const isSelected = selectedZoneId === zone.id;
                const handleZonePress = onZoneSelect
                  ? () => onZoneSelect(zone.id, roomName || zone.id)
                  : () => setSelectedZoneId(isSelected ? null : zone.id);
                return (
                  <G key={zone.id}>
                    <Polygon
                      points={pointsToSvg(zone.points)}
                      fill={`${zone.color}40`}
                      stroke={zone.color}
                      strokeWidth={isSelected || onZoneSelect ? 0.8 : 0.4}
                      onPress={handleZonePress}
                    />
                    {isSelected && roomName && (
                      <G>
                        <Rect
                          x={c.x - (roomName.length * 0.9)}
                          y={c.y - 2.2}
                          width={roomName.length * 1.8}
                          height={4}
                          rx={1}
                          fill="rgba(0,0,0,0.85)"
                        />
                        <SvgText
                          x={c.x}
                          y={c.y + 0.9}
                          fill="#fff"
                          fontSize={2.8}
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {roomName}
                        </SvgText>
                      </G>
                    )}
                  </G>
                );
              })}
              {devices.filter((d) => d.type !== 'assembly').map((d) => (
                <Circle
                  key={d.id}
                  cx={d.x}
                  cy={d.y}
                  r={1.2}
                  fill={DEVICE_COLORS[d.type] ?? colors.primary}
                  stroke={colors.background}
                  strokeWidth={0.3}
                />
              ))}
              {devices.filter((d) => d.type === 'assembly').map((d) => {
                const s = 2.5;
                const zone = d.zoneId ? zoneColorMap.get(d.zoneId) : undefined;
                const markerColor = zone?.color || '#EF4444';
                const label = zone?.label || (d as { zoneName?: string }).zoneName || d.name || '';
                const stats = label ? checkpointStats?.[label] : undefined;
                const count = stats?.count ?? 0;
                const names = stats?.names ?? [];
                const isInteractive = !!onCheckpointPress || !!onCheckpointSelect;
                const handlePress = onCheckpointSelect
                  ? () => onCheckpointSelect(d.id, label || d.id)
                  : isInteractive
                    ? () => onCheckpointPress!(d.id, label || d.id, names)
                    : undefined;
                return (
                  <G key={d.id} onPress={handlePress}>
                    <Polygon
                      points={`${d.x},${d.y - s} ${d.x - s},${d.y + s} ${d.x + s},${d.y + s}`}
                      fill={markerColor}
                      stroke="#fff"
                      strokeWidth={isInteractive ? 0.6 : 0.4}
                    />
                    <SvgText
                      x={d.x}
                      y={d.y + 0.8}
                      fill="#fff"
                      fontSize={2}
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      P
                    </SvgText>
                    {count > 0 && (
                      <G>
                        <Rect
                          x={d.x - 2.5}
                          y={d.y - s - 3}
                          width={5}
                          height={2.8}
                          rx={1}
                          fill="rgba(34, 197, 94, 0.95)"
                        />
                        <SvgText
                          x={d.x}
                          y={d.y - s - 1}
                          fill="#fff"
                          fontSize={1.8}
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {count}
                        </SvgText>
                      </G>
                    )}
                    {label ? (
                      <G>
                        <Rect
                          x={d.x - (label.length * 0.8)}
                          y={d.y + s + 0.6}
                          width={label.length * 1.6}
                          height={3}
                          rx={0.8}
                          fill="rgba(0,0,0,0.7)"
                        />
                        <SvgText
                          x={d.x}
                          y={d.y + s + 2.8}
                          fill="#fff"
                          fontSize={2}
                          fontWeight="600"
                          textAnchor="middle"
                        >
                          {label}
                        </SvgText>
                      </G>
                    ) : null}
                  </G>
                );
              })}
            </Svg>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  wrapperFullScreen: {
    borderRadius: 0,
    borderWidth: 0,
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
});
