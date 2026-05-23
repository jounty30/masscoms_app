/**
 * Incidents via the same Firestore + Cloud Functions as the Mass Coms dashboard.
 */
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Incident } from '../types/api';

export interface MessageDelivery {
  channel: string;
  to: string;
  status: string;
  error?: string;
}

export interface FirestoreIncident {
  id: string;
  scenarioId?: string | null;
  incidentType?: string | null;
  zoneId?: string | null;
  activatedBy: string;
  activatedByName?: string | null;
  activatedAt: { toDate: () => Date } | unknown;
  status: string;
  messageDelivery?: MessageDelivery[];
  timeline?: Array<{ at: unknown; action?: string; by?: string }>;
}

function toAppIncident(d: FirestoreIncident, id: string): Incident {
  const at = d.activatedAt && typeof (d.activatedAt as { toDate?: () => Date }).toDate === 'function'
    ? (d.activatedAt as { toDate: () => Date }).toDate()
    : new Date();
  const dashboardType = (d.incidentType as string) || 'lockdown';
  const typeMap: Record<string, Incident['type']> = {
    lockdown: 'lockdown',
    evacuate: 'evacuation',
    invacuate: 'evacuation',
    standby: 'medical',
    test: 'lockdown',
  };
  const type = typeMap[dashboardType] || 'lockdown';
  const titles: Record<string, string> = {
    lockdown: 'LOCKDOWN',
    evacuate: 'EVACUATION',
    invacuate: 'INVACUATE',
    standby: 'STANDBY',
    test: 'TEST',
  };
  return {
    id,
    type,
    title: titles[dashboardType] || 'INCIDENT',
    timestamp: at.toISOString(),
    triggeredBy: d.activatedBy,
    triggeredByName: d.activatedByName || 'Dashboard',
    isDrill: d.incidentType === 'test',
    status: d.status === 'active' ? 'active' : 'resolved',
  };
}

export function subscribeToActiveIncident(
  orgId: string,
  onIncident: (incident: Incident | null) => void
): Unsubscribe {
  const incidentsRef = collection(db, 'organizations', orgId, 'incidents');
  const q = query(incidentsRef, where('status', '==', 'active'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onIncident(null);
        return;
      }
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreIncident & { id: string }));
      docs.sort((a, b) => {
        const atA = a.activatedAt && typeof (a.activatedAt as { toDate?: () => Date }).toDate === 'function' ? (a.activatedAt as { toDate: () => Date }).toDate().getTime() : 0;
        const atB = b.activatedAt && typeof (b.activatedAt as { toDate?: () => Date }).toDate === 'function' ? (b.activatedAt as { toDate: () => Date }).toDate().getTime() : 0;
        return atB - atA;
      });
      const d = docs[0];
      onIncident(toAppIncident(d, d.id));
    },
    () => onIncident(null)
  );
}

export async function triggerIncident(params: {
  orgId: string;
  scenarioId: string;
  incidentType: 'lockdown' | 'evacuate' | 'invacuate' | 'standby' | 'test';
  zoneId?: string;
  isDrill?: boolean;
}): Promise<{ incidentId: string }> {
  const incidentType = params.isDrill ? 'test' : params.incidentType;
  const fn = httpsCallable(functions, 'onScenarioActivate');
  const result = await fn({
    orgId: params.orgId,
    scenarioId: params.scenarioId,
    incidentType,
    zoneId: params.zoneId || undefined,
  });
  const data = result.data as { incidentId?: string };
  if (!data?.incidentId) throw new Error('No incident ID returned');
  return { incidentId: data.incidentId };
}

export async function resolveIncident(orgId: string, incidentId: string): Promise<void> {
  const ref = doc(db, 'organizations', orgId, 'incidents', incidentId);
  await updateDoc(ref, { status: 'resolved' });
}

export async function getIncident(orgId: string, incidentId: string): Promise<Incident | null> {
  const ref = doc(db, 'organizations', orgId, 'incidents', incidentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as FirestoreIncident;
  return toAppIncident({ ...data, id: snap.id }, snap.id);
}

export interface IncidentTriggerStatus {
  messageDelivery: MessageDelivery[];
  timeline: Array<{ at: Date; action: string; by: string }>;
}

export function subscribeToIncident(
  orgId: string,
  incidentId: string,
  onUpdate: (data: IncidentTriggerStatus) => void
): Unsubscribe {
  const ref = doc(db, 'organizations', orgId, 'incidents', incidentId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as FirestoreIncident;
      const messageDelivery = data.messageDelivery || [];
      const timeline = (data.timeline || []).map((t) => {
        const at = t.at && typeof (t.at as { toDate?: () => Date }).toDate === 'function'
          ? (t.at as { toDate: () => Date }).toDate()
          : new Date();
        return { at, action: (t as { action?: string }).action || '', by: (t as { by?: string }).by || '' };
      });
      onUpdate({ messageDelivery, timeline });
    },
    () => onUpdate({ messageDelivery: [], timeline: [] })
  );
}

export async function getActiveIncidentOnce(orgId: string): Promise<Incident | null> {
  const incidentsRef = collection(db, 'organizations', orgId, 'incidents');
  const q = query(incidentsRef, where('status', '==', 'active'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreIncident & { id: string }));
  docs.sort((a, b) => {
    const atA = a.activatedAt && typeof (a.activatedAt as { toDate?: () => Date }).toDate === 'function' ? (a.activatedAt as { toDate: () => Date }).toDate().getTime() : 0;
    const atB = b.activatedAt && typeof (b.activatedAt as { toDate?: () => Date }).toDate === 'function' ? (b.activatedAt as { toDate: () => Date }).toDate().getTime() : 0;
    return atB - atA;
  });
  const d = docs[0];
  return toAppIncident(d, d.id);
}
