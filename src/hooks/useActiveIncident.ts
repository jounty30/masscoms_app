import { useEffect, useState } from 'react';
import { subscribeToActiveIncident, getActiveIncidentOnce } from '../services/incidents';
import { socketOn, socketOff } from '../ws/socketInstance';
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
      getActiveIncidentOnce(orgId).then(setIncident).catch(() => {});
    }, 30000);

    // Clear immediately on resolved without waiting for the next poll
    const handleResolved = () => setIncident(null);
    socketOn('incident:resolved', handleResolved);

    return () => {
      unsubscribe();
      clearInterval(interval);
      socketOff('incident:resolved', handleResolved);
    };
  }, [orgId]);

  return incident;
}
