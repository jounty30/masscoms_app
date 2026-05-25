/**
 * Incident service — REST + polling implementation.
 *
 * Previously backed by Firebase Firestore + Cloud Functions.
 * All reads/writes now go to the Express REST API via src/api/client.ts.
 */
import client from '../api/client';
import type { Incident } from '../types/api';

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

async function fetchActiveIncident(): Promise<Incident | null> {
  try {
    const res = await client.get<Incident>('/v1/incidents/active');
    if (res.status === 204 || !res.data) return null;
    return res.data;
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

  // TODO Phase 2: replace with Socket.IO subscription
  const interval = setInterval(() => {
    fetchActiveIncident().then(onIncident).catch(() => onIncident(null));
  }, 15000);

  return () => clearInterval(interval);
}

export function subscribeToIncident(
  _orgId: string,
  _incidentId: string,
  onUpdate: (data: IncidentTriggerStatus) => void
): Unsubscribe {
  // TODO Phase 2: replace with Socket.IO subscription
  // REST API does not expose messageDelivery/timeline — fire empty status immediately
  const empty: IncidentTriggerStatus = { messageDelivery: [], timeline: [] };
  onUpdate(empty);

  const interval = setInterval(() => onUpdate(empty), 15000);
  return () => clearInterval(interval);
}

export async function triggerIncident(params: {
  orgId: string;
  scenarioId: string;
  incidentType: 'lockdown' | 'evacuate' | 'invacuate' | 'standby' | 'test';
  zoneId?: string;
  isDrill?: boolean;
}): Promise<{ incidentId: string }> {
  const { data } = await client.post<Incident>('/v1/incidents/trigger', {
    scenarioId: params.scenarioId,
    incidentType: params.isDrill ? 'test' : params.incidentType,
    zoneId: params.zoneId || undefined,
    isDrill: params.isDrill ?? false,
  });
  return { incidentId: data.id };
}

export async function resolveIncident(_orgId: string, incidentId: string): Promise<void> {
  await client.post(`/v1/incidents/${incidentId}/resolve`);
}

export async function getIncident(_orgId: string, incidentId: string): Promise<Incident | null> {
  try {
    const { data } = await client.get<Incident>(`/v1/incidents/${incidentId}`);
    return data;
  } catch {
    return null;
  }
}

export async function getActiveIncidentOnce(_orgId: string): Promise<Incident | null> {
  return fetchActiveIncident();
}
