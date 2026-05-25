import client from './client';

export async function stopPAAnnouncements(
  incidentId: string | undefined,
  zoneId?: string
): Promise<void> {
  await client.post('/v1/live-pa/stop-announcements', { incidentId: incidentId ?? undefined, zoneId });
}

export async function broadcastLivePA(
  audioBase64: string,
  options: { incidentId?: string; zoneId?: string } = {}
): Promise<void> {
  const { incidentId, zoneId } = options;
  await client.post('/v1/live-pa/broadcast', { incidentId, zoneId, audioBase64 });
}
