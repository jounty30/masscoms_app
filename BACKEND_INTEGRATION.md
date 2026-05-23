# Mobile app ↔ Mass Coms dashboard backend

The mobile app is the **companion to the existing Strive MassCom web dashboard**. Both use the **same backend**: Firebase (Auth, Firestore, Cloud Functions).

## What I got wrong initially

The "Mobile App Design for Martyn's Law" folder included an **API spec** (OpenAPI, REST, WebSocket) that described a *hypothetical* REST backend. I implemented the mobile app against that spec and assumed a separate backend or mock. I did not treat the **existing Mass Coms dashboard** (Firebase Auth, Firestore, `onScenarioActivate`, etc.) as the backend the app should use.

## Actual backend (shared with dashboard)

- **Auth**: Firebase Auth (email/password). Custom claims: `role`, `orgId` (set via `setupUser` or scripts).
- **Data**: Firestore  
  - `organizations/{orgId}/incidents` – incidents created when a scenario is activated  
  - `organizations/{orgId}/scenarios`, `people`, `integrations`, etc.
- **Actions**: Cloud Functions  
  - `onScenarioActivate` – creates an incident doc and sends Twilio SMS/voice to people

So the mobile app must use **Firebase Auth** and **Firestore** (and callable functions), not a separate REST API.

## Changes made to connect the mobile app

1. **Firebase in the mobile app**  
   Same Firebase project/config as the dashboard. Uses Firebase JS SDK (Auth + Firestore + callable) so the same users and data are shared.

2. **Login**  
   Switched to **email + password** (Firebase `signInWithEmailAndPassword`) so mobile users are the same as dashboard users. OTP flow from the design doc can be added later (e.g. a Cloud Function that sends OTP and then issues a custom token).

3. **Trigger incident**  
   Mobile calls the same callable: **`onScenarioActivate`** with `{ orgId, incidentType, zoneId }`. Incident types are mapped from mobile to dashboard (e.g. lockdown→lockdown, evacuation→evacuate, fire→evacuate).

4. **Active incident**  
   Mobile listens to Firestore: `organizations/{orgId}/incidents` where `status === 'active'` (e.g. `orderBy('activatedAt', 'desc').limit(1)`). No REST endpoint.

5. **Resolve incident**  
   Mobile updates the incident doc: `status: 'resolved'` (and can extend dashboard/Cloud Functions later for “All Clear” notifications if needed).

6. **Acknowledgments / help requests / presence / maps (REST API)**  
   A REST API runs in Cloud Functions (same project as the dashboard), mounted at `/api` with routes under `/v1`. The mobile app calls it with the **Firebase ID token** (`Authorization: Bearer <token>`). Endpoints:
   - `POST /v1/incidents/:id/acknowledge` – “I’m safe”
   - `POST /v1/incidents/:id/help-request` – request help
   - `GET /v1/incidents/:id/stats`, `.../acknowledgments`, `.../help-requests`
   - `GET /v1/presence/on-site-roster`, `POST /v1/presence/mark-safe`, `GET /v1/presence/audit-log/:id`
   - `GET /v1/maps/zones`, `GET /v1/maps/assembly-points`, `GET /v1/maps/building/:id`
   Set **`EXPO_PUBLIC_API_BASE_URL`** (or `extra.API_BASE_URL` in app config) to the deployed function base including `/v1`, e.g. `https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/v1`.

## Role mapping (dashboard → mobile)

Dashboard roles: `superAdmin`, `responsiblePerson`, `safetyOfficer`, `staff`, `firstResponder`.  
Mobile roles: `staff`, `safety-officer`, `fire-warden`, `slt`, `contractor`, `student`, `visitor`.  
Mapping used in the app:  
- `safetyOfficer` → `safety-officer`  
- `firstResponder` → `fire-warden`  
- `responsiblePerson` → `slt`  
- `staff` → `staff`  
- `superAdmin` → `safety-officer` (can do everything)  
- No dashboard role for contractor/student/visitor; they are treated as `staff` for backend and can be refined when the dashboard has a concept for them.

## Running with the same backend

1. Use the **same Firebase project** as the dashboard (same config in dashboard `.env` / Vite env and in the mobile app env/config).
2. Ensure at least one user exists in Firebase Auth with custom claims (`orgId`, `role`) – e.g. via dashboard login or `npm run setup-user` in the main project.
3. Run the mobile app and log in with that user’s **email and password**. Triggering an incident from the app creates an incident in Firestore and sends notifications via the same Cloud Function the dashboard uses.
4. **REST API (acknowledge, help, presence, maps)**: Deploy Cloud Functions from the main repo (`firebase deploy --only functions`). Set `EXPO_PUBLIC_API_BASE_URL` to `https://<region>-<project>.cloudfunctions.net/api/v1` so the app hits the deployed `api` function. The app sends the Firebase ID token on every request; no separate API login.
