# Mobile app – what works vs what’s not connected

## Connected (works with dashboard Firebase)

| Feature | How it works |
|--------|----------------|
| **Login** | Firebase Auth email/password. Same account as the Mass Coms web dashboard. |
| **Home** | Active incident comes from Firestore in real time (`organizations/{orgId}/incidents` where `status === 'active'`). If there’s an active incident, you’re taken to Live Incident. |
| **Trigger incident** | Calls the same Cloud Function as the dashboard: `onScenarioActivate`. Creates the incident in Firestore and sends Twilio SMS/voice to people. Zone/assembly point are optional; trigger works without them. |
| **Resolve incident (All Clear)** | Updates the incident document in Firestore to `status: 'resolved'`. Same data the dashboard would see. |
| **Live Incident – view** | Incident details are loaded from Firestore by id. You see the same incident as on the dashboard. |
| **Role-based UI** | Your role comes from Firebase Auth custom claims (same as dashboard). Trigger/Monitor/Presence are shown only for safety officer, fire warden, SLT. |
| **Session timeout** | 30-minute inactivity then logout (app-only). |
| **Offline banner** | NetInfo shows a banner when the device is offline. |
| **Push notifications** | Registers on login, unregisters on logout. Incident trigger and All Clear send push via Expo. Tap notification opens Live Incident. |
| **Dev panel** | Tap “App Information” 5 times in Settings to switch role for testing (app-only override). |

---

## Not connected (REST endpoints don’t exist – will fail or show empty)

These screens and actions call a REST API that the dashboard backend does not implement. The UI is there but the calls will error or return nothing.

| Feature | What happens |
|--------|----------------|
| **“I’m safe” (acknowledge)** | Calls `POST /incidents/{id}/acknowledge`. No such endpoint → request fails. Button does nothing useful. |
| **Request help** | Calls `POST /incidents/{id}/help-request`. No such endpoint → request fails. |
| **Acknowledgment Monitor – stats & lists** | Stats and lists use `GET .../stats`, `.../acknowledgments`, `.../help-requests`. No such endpoints → queries fail; screen may show loading or empty. **“Send All Clear”** is connected (Firebase) and works. |
| **Presence & Accountability** | Roster and “Mark as safe” use `GET /presence/on-site-roster` and `POST /presence/mark-safe`. No such endpoints → empty list and failed request. |
| **Map – zones, assembly points, building** | Uses `GET /maps/zones`, `/maps/assembly-points`, `/maps/building/{id}`. No such endpoints → map screen shows placeholder / empty. |
| **Trigger – zone & assembly dropdowns** | Same maps API → zones and assembly points stay empty. You can still trigger; zone is optional. |

---

## WebSocket

The app has a WebSocket client that connects to `WS_URL`. The dashboard backend has no WebSocket server, so:

- **Real-time for “is there an active incident?”** comes from **Firestore** (subscription in `useActiveIncident`), not from the WebSocket.
- The WebSocket does not provide live updates from the server. It can be removed or repurposed later (e.g. FCM for push).

---

## Summary

- **Works end-to-end with the dashboard:** login, see active incident, trigger incident (same as dashboard), view live incident, send All Clear (resolve), push notifications.
- **Does not work (no backend yet):** acknowledge safe, request help, monitor stats/ack list/help list (except All Clear), presence roster and mark safe, map data, zone/assembly dropdowns.
