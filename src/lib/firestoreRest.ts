/**
 * Firestore REST API client using fetch().
 *
 * The Firebase JS SDK's WebChannel transport fails on the iOS simulator.
 * This module reads documents via the Firestore REST API, which uses
 * simple request-response HTTPS — works reliably everywhere.
 */
import { auth, firebaseConfig } from './firebase';

const PROXY_HOST = '192.168.1.253';
const PROXY_PORT = 9199;

const BASE = __DEV__
  ? `http://${PROXY_HOST}:${PROXY_PORT}`
  : `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function decodeValue(v: FirestoreValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return { toDate: () => new Date(v.timestampValue) };
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = decodeValue(val);
  }
  return result;
}

export interface RestDocument {
  exists: boolean;
  id: string;
  data: Record<string, unknown>;
}

export async function getDocument(path: string): Promise<RestDocument> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${BASE}/${path}`;
  console.log(`[FirestoreREST] GET ${path} (auth: ${!!token})`);

  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    console.log(`[FirestoreREST] ${path} -> ${res.status}`);

    if (res.status === 404) {
      const id = path.split('/').pop() || '';
      return { exists: false, id, data: {} };
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore REST error ${res.status}: ${text}`);
    }

    const json = await res.json();
    const name: string = json.name || '';
    const id = name.split('/').pop() || '';
    const data = json.fields ? decodeFields(json.fields) : {};
    console.log(`[FirestoreREST] ${path} -> document found, fields: ${Object.keys(data).join(', ')}`);
    return { exists: true, id, data };
  } catch (err) {
    console.error(`[FirestoreREST] ${path} FAILED:`, err);
    throw err;
  }
}

export async function queryDocuments(
  collectionPath: string,
  field: string,
  op: 'EQUAL',
  value: string,
): Promise<RestDocument[]> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const parts = collectionPath.split('/');
  const parent = parts.slice(0, -1).join('/');
  const collectionId = parts[parts.length - 1];

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op,
          value: { stringValue: value },
        },
      },
    },
  };

  const url = `${BASE}/${parent}:runQuery`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore REST query error ${res.status}: ${text}`);
  }

  const results = await res.json();
  return (results as Array<{ document?: { name: string; fields: Record<string, FirestoreValue> } }>)
    .filter((r) => r.document)
    .map((r) => {
      const doc = r.document!;
      const id = doc.name.split('/').pop() || '';
      return { exists: true, id, data: decodeFields(doc.fields || {}) };
    });
}
