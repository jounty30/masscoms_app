import { useEffect, useState } from 'react';
import { subscribeToActiveIncident, getActiveIncidentOnce } from '../services/incidents';
import type { Incident } from '../types/api';

export function useActiveIncident(orgId: string | undefined): Incident | null {
  const [incident, setIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (!orgId) {
      setIncident(null);
      return;
    }
    const unsubscribe = subscribeToActiveIncident(orgId, setIncident);
    const interval = setInterval(() => {
      getActiveIncidentOnce(orgId).then((i) => { if (i !== null) setIncident(i); }).catch(() => {});
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [orgId]);

  return incident;
}
