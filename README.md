# Mass Coms Mobile – Martyn's Law Incident Response

React Native (Expo) mobile app for the Mass Coms incident response system. It is the **companion to the Strive MassCom web dashboard** and uses the **same backend**: Firebase (Auth, Firestore, Cloud Functions).

## Features

- **9 screens**: Login, Home, Live Incident, Response Plan, Trigger Incident, Map, Acknowledgment Monitor, Presence & Accountability, Settings
- **6 user roles**: Staff, Safety Officer, Fire Warden, SLT, Contractor, Student, Visitor with role-based permissions
- **Auth**: Same as dashboard – **email/password** (Firebase Auth). Use the same account you use on the web.
- **Real-time**: Firestore subscription for active incident (same data as dashboard).
- **Trigger incident**: Calls the same Cloud Function as the dashboard (`onScenarioActivate`); creates an incident and sends Twilio SMS/voice to people.
- **Resolve incident**: Updates the incident in Firestore to `status: 'resolved'`.
- **Session**: 30-minute inactivity timeout; activity resets on touch
- **Offline**: NetInfo-based banner when disconnected
- **Dev panel**: Tap "App Information" 5 times in Settings to switch role for UI testing

## Setup

```bash
cd masscoms-mobile
npm install
```

Firebase uses the same project as the dashboard. Default config is in `src/lib/firebase.ts`. To override, set in `.env` or `app.config.js`:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- (etc.)

## Run

```bash
npm start
# Then press i for iOS or a for Android
# Or: npx expo run:ios  (Xcode)
```

## Run on a physical iPhone (no Metro / no same Wi‑Fi)

If the app on your phone shows "The request timed out" to your Mac’s IP or "No script URL provided", the device can’t reach Metro. Use a **Release** build so the JS is bundled into the app and no packager is needed:

1. In **Xcode**: **Product → Scheme → Edit Scheme…** (or click the scheme name next to the Run button → Edit Scheme).
2. Select **Run** in the left column.
3. Set **Build Configuration** to **Release** (instead of Debug).
4. Close the window, then choose your **iPhone** as the run destination and press **Run** (⌘R).

The first Release build can take a bit longer; after that the app runs on the device without Metro and without being on the same Wi‑Fi as your Mac.

To go back to development with Metro (e.g. hot reload), set Build Configuration back to **Debug** and run with `npm start` (or `npx expo start`) on your Mac.

## Troubleshooting

**Login fails in the iOS Simulator with "Connection error (-1017)"**  
The simulator’s network stack can fail when talking to Firebase Auth (QUIC/HTTP/2 protocol issues). The logs show `cannot parse response` and `Server protocol violation 0x02`.

- **Reliable fix:** Run the app on a **real iPhone** (connect via USB, select your device in Xcode, then Run). Login works on device.
- **Optional:** Update Xcode to the latest (e.g. 16.4+); some simulator URLSession issues were fixed in newer Xcode.

**App on phone: "The request timed out" or "No script URL provided"**  
The phone is trying to load the app from Metro on your Mac and can’t reach it (timeout or "Local network prohibited"). Use a **Release** build so the JS is inside the app; see **Run on a physical iPhone** above.

**Empty dSYM / UIScene lifecycle warnings**  
These are safe to ignore for local development. The dSYM warning is a known React Native simulator/device quirk; the UIScene message is an Apple deprecation notice for a future OS version.

## Backend (shared with dashboard)

The app talks to **Firebase** (same project as the web app):

- **Auth**: Firebase Auth email/password; roles from custom claims (`orgId`, `role`). Create users via the dashboard or `npm run setup-user` in the **main project** (Masscoms repo root).
- **Incidents**: Firestore `organizations/{orgId}/incidents`; trigger via Cloud Function `onScenarioActivate`.
- See `BACKEND_INTEGRATION.md` in this folder for details and role mapping.

## Project structure

- `src/api/` – REST client, auth, incidents, maps, presence, notifications
- `src/auth/` – AuthContext, secure storage
- `src/config/` – env (API_BASE_URL, WS_URL)
- `src/context/` – Network (offline), Dev (role override)
- `src/hooks/` – useEffectiveRole
- `src/navigation/` – RootNavigator (auth vs main stack)
- `src/screens/` – All 9 screens
- `src/theme.ts` – Dark theme colors
- `src/ws/` – WebSocket context and events

## License

Proprietary – Mass Coms.
