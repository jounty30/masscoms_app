/**
 * Incident service — single import point for all incident operations.
 *
 * Currently backed by Firebase Firestore + Cloud Functions.
 *
 * To switch to Postgres REST API, update the implementations below.
 * Screen files import from here and will NOT need to change when the backend swaps.
 *
 *   subscribeToActiveIncident → WebSocket subscription (src/ws/WebSocketContext)
 *   subscribeToIncident       → WebSocket subscription
 *   triggerIncident           → client.post('/incidents/trigger', ...)
 *   resolveIncident           → client.post('/incidents/:id/resolve')
 *   getIncident               → client.get('/incidents/:id')
 *   getActiveIncidentOnce     → client.get('/incidents/active')
 */
export type { IncidentTriggerStatus, MessageDelivery } from '../lib/firebaseIncidents';

export {
  subscribeToActiveIncident,
  subscribeToIncident,
  triggerIncident,
  resolveIncident,
  getIncident,
  getActiveIncidentOnce,
} from '../lib/firebaseIncidents';
