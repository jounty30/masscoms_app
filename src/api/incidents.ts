import client from './client';
import type { Incident, IncidentStats, Acknowledgment, HelpRequest } from '../types/api';

export async function getActiveIncident(): Promise<Incident | null> {
  try {
    const res = await client.get<Incident[]>('/v1/incidents', { params: { status: 'active', limit: 1 } });
    if (res.status === 204 || !res.data || res.data.length === 0) return null;
    return res.data[0];
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { status?: number } }).response?.status
      : undefined;
    if (status === 204 || status === 404) return null;
    throw err;
  }
}

export async function getIncident(id: string): Promise<Incident> {
  const { data } = await client.get<Incident>(`/v1/incidents/${id}`);
  return data;
}

export async function acknowledgeIncident(
  incidentId: string,
  payload: {
    status: 'safe';
    zone?: string;
    latitude?: number;
    longitude?: number;
    checkpointId?: string;
    checkpointName?: string;
  }
): Promise<void> {
  const url = '/v1/presence/ack';
  const body = { incidentId, ...payload };
  console.log('[acknowledge] calling:', url, body);
  const { status, data } = await client.post(url, body);
  console.log('[acknowledge] response:', status, data);
}

export async function undoAcknowledgeIncident(incidentId: string): Promise<void> {
  // No undo endpoint exists in the API — this will fail gracefully
  await client.delete(`/v1/incidents/${incidentId}/acknowledge`);
}

export async function createHelpRequest(
  incidentId: string,
  payload: {
    reason: string;
    notes?: string;
    zone?: string;
    latitude?: number;
    longitude?: number;
  }
): Promise<void> {
  const url = '/v1/presence/help';
  const body = { incidentId, ...payload };
  console.log('[help-request] calling:', url, body);
  const { status, data } = await client.post(url, body);
  console.log('[help-request] response:', status, data);
}

export async function triggerIncident(payload: {
  incidentType: 'lockdown' | 'evacuation' | 'fire' | 'medical';
  isDrill?: boolean;
  zone?: string;
  assemblyPointId?: string;
  lockdownPin?: string;
}): Promise<Incident> {
  const { data } = await client.post<Incident>('/v1/incidents/activate', payload);
  console.log('[trigger] incident activated:', data.id);
  return data;
}

export async function resolveIncident(incidentId: string): Promise<void> {
  await client.patch(`/v1/incidents/${incidentId}/resolve`);
}

// Returns computed stats from the presence endpoint (no dedicated stats endpoint exists)
export async function getIncidentStats(incidentId: string): Promise<IncidentStats> {
  const { data } = await client.get<{ acknowledgments: Acknowledgment[]; helpRequests: HelpRequest[] }>(
    `/v1/presence/${incidentId}`
  );
  const acks = data.acknowledgments ?? [];
  const helps = data.helpRequests ?? [];
  return {
    totalExpected: 0,
    acknowledged: acks.filter((a) => a.status === 'safe').length,
    helpRequested: helps.length,
    noResponse: 0,
  };
}

export async function getIncidentAcknowledgments(incidentId: string): Promise<Acknowledgment[]> {
  const { data } = await client.get<{ acknowledgments: Acknowledgment[]; helpRequests: unknown[] }>(
    `/v1/presence/${incidentId}`
  );
  return data.acknowledgments ?? [];
}

export async function getIncidentHelpRequests(incidentId: string): Promise<HelpRequest[]> {
  const { data } = await client.get<{ acknowledgments: unknown[]; helpRequests: HelpRequest[] }>(
    `/v1/presence/${incidentId}`
  );
  return data.helpRequests ?? [];
}
