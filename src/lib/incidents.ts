/**
 * Incident service — REST + polling implementation.
 *
 * Previously backed by Firebase Firestore + Cloud Functions.
 * All reads/writes now go to the Express REST API via src/api/client.ts.
 */
import client from '../api/client';
import type { Incident } from '../types/api';
import { socketOn, socketOff } from '../ws/socketInstance';

export interface MessageDelivery {
  channel: string;
  to: string;
  status: string;
  error?: string;
}

export interface IncidentTriggerStatus {
  messageDelivery: MessageDelivery[];
  timeline: Array<{ at: Date; action: string; by: string }>;
}

type Unsubscribe = () => void;

// Maps raw API Incident (DB fields) to the mobile Incident type.
// The DB uses incidentType, responsePlanName, activatedAt instead of type, title, timestamp.
function normalizeIncident(raw: Record<string, unknown>): Incident {
  return {
    id: raw.id as string,
    type: ((raw.type ?? raw.incidentType) as Incident['type'] | undefined) ?? 'lockdown',
    title: (raw.title ?? raw.responsePlanName ?? raw.incidentType ?? 'Incident') as string,
    timestamp: (raw.timestamp ?? raw.createdAt ?? raw.activatedAt) as string,
    createdAt: (raw.createdAt ?? raw.activatedAt) as string | undefined,
    triggeredBy: (raw.triggeredBy ?? raw.activatedBy) as string | undefined,
    triggeredByName: (raw.triggeredByName ?? raw.activatedByName) as string | undefined,
    activatedBy: raw.activatedBy as string | undefined,
    activatedByName: raw.activatedByName as string | undefined,
    isDrill: (raw.isDrill as boolean | undefined) ?? false,
    status: raw.status as 'active' | 'resolved',
    instructions: (raw.responsePlanSteps ?? raw.instructions) as string[] | undefined,
    responsePlanSteps: (raw.responsePlanSteps ?? raw.instructions ?? []) as string[],
    zone: raw.zone as string | undefined,
    assemblyPointId: raw.assemblyPointId as string | undefined,
  };
}

async function fetchActiveIncident(): Promise<Incident | null> {
  try {
    const res = await client.get<Record<string, unknown>[]>('/v1/incidents', { params: { status: 'active', limit: 1 } });
    if (res.status === 204 || !res.data || res.data.length === 0) return null;
    const incident = normalizeIncident(res.data[0]);
    if (incident.status !== 'active') return null;
    return incident;
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 204 || status === 404) return null;
    return null;
  }
}

export function subscribeToActiveIncident(
  _orgId: string,
  onIncident: (incident: Incident | null) => void
): Unsubscribe {
  fetchActiveIncident().then(onIncident).catch(() => onIncident(null));

  const handleActivated = () => {
    fetchActiveIncident()
      .then((i) => { if (i !== null) onIncident(i); })
      .catch(() => {});
  };

  const handleResolved = () => {
    onIncident(null);
    // Fetch only to confirm resolution — never restore a non-null result here.
    // If a new incident went active immediately after, incident:activated will handle it.
    fetchActiveIncident().then((result) => {
      if (result === null) onIncident(null);
    }).catch(() => {});
  };

  // On reconnect, restore incident state from server without clearing known-good state on failure.
  // This prevents a brief disconnect from losing an active incident.
  const handleConnect = () => {
    fetchActiveIncident()
      .then((i) => { if (i !== null) onIncident(i); })
      .catch(() => {});
  };

  socketOn('incident:activated', handleActivated);
  socketOn('incident:resolved', handleResolved);
  socketOn('connect', handleConnect);

  return () => {
    socketOff('incident:activated', handleActivated);
    socketOff('incident:resolved', handleResolved);
    socketOff('connect', handleConnect);
  };
}

export function subscribeToIncident(
  _orgId: string,
  incidentId: string,
  onUpdate: (data: IncidentTriggerStatus) => void
): Unsubscribe {
  interface IncidentDetail {
    messageDelivery?: MessageDelivery[];
    timeline?: Array<{ at: string; action?: string; by?: string }>;
  }

  const fetch = () => {
    client.get<IncidentDetail>(`/v1/incidents/${incidentId}`)
      .then(({ data }) => {
        onUpdate({
          messageDelivery: data.messageDelivery ?? [],
          timeline: (data.timeline ?? []).map((t) => ({
            at: new Date(t.at),
            action: t.action ?? '',
            by: t.by ?? '',
          })),
        });
      })
      .catch(() => {
        onUpdate({ messageDelivery: [], timeline: [] });
      });
  };

  fetch();

  socketOn('incident:activated', fetch);
  socketOn('incident:resolved', fetch);

  return () => {
    socketOff('incident:activated', fetch);
    socketOff('incident:resolved', fetch);
  };
}

export async function triggerIncident(params: {
  orgId: string;
  scenarioId: string;
  incidentType: 'lockdown' | 'evacuate' | 'invacuate' | 'standby' | 'test';
  zoneId?: string;
  isDrill?: boolean;
}): Promise<{ incidentId: string }> {
  // API endpoint is POST /v1/incidents (or /v1/incidents/activate)
  const { data } = await client.post<Record<string, unknown>>('/v1/incidents/activate', {
    scenarioId: params.scenarioId,
    incidentType: params.isDrill ? 'test' : params.incidentType,
    zoneId: params.zoneId || undefined,
  });
  console.log('[trigger] incident activated:', data.id);
  return { incidentId: data.id as string };
}

export async function resolveIncident(_orgId: string, incidentId: string): Promise<void> {
  await client.patch(`/v1/incidents/${incidentId}/resolve`);
}

export async function getIncident(_orgId: string, incidentId: string): Promise<Incident | null> {
  try {
    const { data } = await client.get<Record<string, unknown>>(`/v1/incidents/${incidentId}`);
    return normalizeIncident(data);
  } catch (err: unknown) {
    const status =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 404) return null;
    throw err;
  }
}

export async function getActiveIncidentOnce(_orgId: string): Promise<Incident | null> {
  return fetchActiveIncident();
}
