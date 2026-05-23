/**
 * Read floorplan overlay (zones, devices, boundary) via REST API.
 * Uses /maps/floorplan-overlay/:id which reads from Firestore server-side - no proxy needed.
 */
import { useState, useEffect } from 'react';
import { getFloorplanOverlay } from '../api/maps';

export interface Point {
  x: number;
  y: number;
}

export interface Zone {
  id: string;
  name: string;
  type: 'zone';
  points: Point[];
  color: string;
  zoneId?: string;
  labelName?: string;
}

export interface Device {
  id: string;
  name: string;
  type: 'speaker' | 'signage' | 'assembly' | 'exitDoor' | 'exit' | 'camera' | 'doorAccess';
  x: number;
  y: number;
  zoneId?: string;
  zoneName?: string;
}

function toZone(raw: { id: string; name: string; points?: { x: number; y: number }[]; color?: string; labelName?: string }): Zone {
  return {
    id: raw.id,
    name: raw.name || 'Unnamed',
    type: 'zone',
    points: Array.isArray(raw.points) ? raw.points : [],
    color: raw.color || '#6db06e',
    labelName: raw.labelName,
  };
}

function toDevice(raw: { id: string; name: string; type: string; x: number; y: number; zoneId?: string }): Device {
  return {
    id: raw.id,
    name: raw.name || 'Unnamed',
    type: (raw.type as Device['type']) || 'speaker',
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    zoneId: raw.zoneId,
  };
}

export function useFloorplanOverlay(orgId: string | undefined, floorplanId: string | undefined) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [boundary, setBoundary] = useState<Point[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !floorplanId) {
      setZones([]);
      setDevices([]);
      setBoundary(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchOverlay() {
      try {
        const data = await getFloorplanOverlay(floorplanId!);
        if (cancelled) return;
        setZones((data.zones || []).map(toZone));
        setDevices((data.devices || []).map(toDevice));
        setBoundary(Array.isArray(data.boundary) && data.boundary.length > 0 ? data.boundary : null);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load floorplan overlay');
          setZones([]);
          setDevices([]);
          setBoundary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOverlay();
    return () => { cancelled = true; };
  }, [orgId, floorplanId]);

  return { zones, devices, boundary, loading, error };
}
