/**
 * Load all checkpoints (assembly points) from floorplan overlays across the establishment.
 * Used for "I'm Safe" checkpoint selection and Presence & Accountability Mark as Safe reasons.
 */
import { useState, useEffect } from 'react';
import { getEstablishment } from '../api/maps';
import { getFloorplanOverlay } from '../api/maps';

export interface Checkpoint {
  id: string;
  name: string;
}

function collectFloorplanIds(establishment: { sites?: Array<{ buildings?: Array<{ floors?: Array<{ floorplanId?: string }> }> }> }): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const site of establishment.sites || []) {
    for (const building of site.buildings || []) {
      for (const floor of building.floors || []) {
        const fpId = floor.floorplanId;
        if (fpId && !seen.has(fpId)) {
          seen.add(fpId);
          ids.push(fpId);
        }
      }
    }
  }
  return ids;
}

export function useCheckpoints(orgId: string | undefined) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setCheckpoints([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function fetchCheckpoints() {
      try {
        const establishment = await getEstablishment();
        if (cancelled || !establishment) {
          setCheckpoints([]);
          return;
        }
        const floorplanIds = collectFloorplanIds(establishment);
        const byId = new Map<string, string>();
        for (const fpId of floorplanIds) {
          const overlay = await getFloorplanOverlay(fpId);
          if (cancelled) return;
          const zones = overlay.zones || [];
          const zoneMap = new Map(zones.map((z) => [z.id, z]));
          const devices = overlay.devices || [];
          for (const d of devices) {
            if (d.type === 'assembly' && d.id) {
              const zone = d.zoneId ? zoneMap.get(d.zoneId) : undefined;
              const label =
                (zone as { labelName?: string; name?: string })?.labelName ||
                (zone as { labelName?: string; name?: string })?.name ||
                (d as { zoneName?: string; name?: string }).zoneName ||
                (d as { zoneName?: string; name?: string }).name ||
                d.id;
              if (!byId.has(d.id)) {
                byId.set(d.id, label || d.id);
              }
            }
          }
        }
        if (!cancelled) {
          setCheckpoints(
            Array.from(byId.entries())
              .map(([id, name]) => ({ id, name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load checkpoints');
          setCheckpoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCheckpoints();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return { checkpoints, loading, error };
}
