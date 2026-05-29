/**
 * Read establishment config (sites, buildings, floors) via REST API.
 * Uses /maps/establishment which reads from Firestore server-side - no proxy needed.
 */
import { useState, useEffect, useCallback } from 'react';
import { getEstablishment, type Establishment as ApiEstablishment } from '../api/maps';

export interface Floor {
  id: string;
  name: string;
  floorplanId?: string;
  floorplanUrl?: string;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
}

export interface Site {
  id: string;
  name: string;
  address: string;
  buildings: Building[];
}

export interface Establishment {
  name: string;
  type: 'school' | 'college' | 'university' | 'other';
  sites: Site[];
}

function toEstablishment(api: ApiEstablishment | null): Establishment | null {
  if (!api) return null;
  return {
    name: api.name || '',
    type: (api.type as Establishment['type']) || 'school',
    sites: (api.sites || []).map((s) => ({
      id: String(s.id ?? ''),
      name: String(s.name ?? ''),
      address: String(s.address ?? ''),
      buildings: (s.buildings || []).map((b) => ({
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        floors: (b.floors || []).map((f) => ({
          id: String(f.id ?? ''),
          name: String(f.name ?? ''),
          floorplanId: f.floorplanId ?? undefined,
          floorplanUrl: f.floorplanUrl ?? undefined,
        })),
      })),
    })),
  };
}

export function useEstablishment(orgId: string | undefined) {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchEstablishment = useCallback(async () => {
    if (!orgId) {
      setEstablishment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const api = await getEstablishment();
      const est = toEstablishment(api);
      setEstablishment(est);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load establishment');
      setEstablishment(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchEstablishment();
  }, [fetchEstablishment]);

  return { establishment, loading, error, refetch: fetchEstablishment };
}
