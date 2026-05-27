import client from './client';
import type { OnSitePerson } from '../types/api';

export async function getOnSiteRoster(incidentId?: string): Promise<OnSitePerson[]> {
  const params = incidentId ? { incidentId } : {};
  const { data } = await client.get<OnSitePerson[]>('/v1/presence/on-site-roster', { params });
  return data;
}

export async function markPersonSafe(
  personId: string,
  payload: { incidentId: string; reason: string }
): Promise<void> {
  await client.post('/v1/presence/mark-safe', { personId, ...payload });
}

export async function selfAcknowledge(incidentId: string): Promise<void> {
  const url = '/v1/presence/ack';
  const body = { incidentId };
  console.log('[acknowledge] calling:', url, body);
  const { status, data } = await client.post(url, body);
  console.log('[acknowledge] response:', status, data);
}

export async function getPresenceAuditLog(incidentId: string): Promise<{ entries: unknown[] }> {
  const { data } = await client.get<{ entries: unknown[] }>(`/v1/presence/audit-log/${incidentId}`);
  return data;
}
