import client from './client';
import type { Incident, IncidentStats, Acknowledgment, HelpRequest } from '../types/api';

export async function getActiveIncident(): Promise<Incident | null> {
  try {
    const res = await client.get<Incident>('/incidents/active');
    if (res.status === 204 || !res.data) return null;
    return res.data;
  } catch (err: unknown) {
    const status = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { status?: number } }).response?.status
      : undefined;
    if (status === 204 || status === 404) return null;
    throw err;
  }
}

export async function getIncident(id: string): Promise<Incident> {
  const { data } = await client.get<Incident>(`/incidents/${id}`);
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
  await client.post(`/incidents/${incidentId}/acknowledge`, payload);
}

export async function undoAcknowledgeIncident(incidentId: string): Promise<void> {
  await client.delete(`/incidents/${incidentId}/acknowledge`);
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
  await client.post(`/incidents/${incidentId}/help-request`, payload);
}

export async function triggerIncident(payload: {
  type: 'lockdown' | 'evacuation' | 'fire' | 'medical';
  isDrill?: boolean;
  zone?: string;
  assemblyPointId?: string;
  lockdownPin?: string;
}): Promise<Incident> {
  const { data } = await client.post<Incident>('/incidents/trigger', payload);
  return data;
}

export async function resolveIncident(incidentId: string): Promise<void> {
  await client.post(`/incidents/${incidentId}/resolve`);
}

export async function getIncidentStats(incidentId: string): Promise<IncidentStats> {
  const { data } = await client.get<IncidentStats>(`/incidents/${incidentId}/stats`);
  return data;
}

export async function getIncidentAcknowledgments(incidentId: string): Promise<Acknowledgment[]> {
  const { data } = await client.get<Acknowledgment[]>(`/incidents/${incidentId}/acknowledgments`);
  return data;
}

export async function getIncidentHelpRequests(incidentId: string): Promise<HelpRequest[]> {
  const { data } = await client.get<HelpRequest[]>(`/incidents/${incidentId}/help-requests`);
  return data;
}
