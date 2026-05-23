import { useEffect, useState } from 'react';
import { subscribeToActiveIncident } from '../services/incidents';
import type { Incident } from '../types/api';

export function useActiveIncident(orgId: string | undefined): Incident | null {
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (!orgId) {
      setIncident(null);
      return;
    }
    const unsubscribe = subscribeToActiveIncident(orgId, setIncident);
    return () => unsubscribe();
  }, [orgId]);

  return incident;
}
