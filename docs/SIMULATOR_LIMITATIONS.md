# iOS Simulator Limitations

The iOS simulator has known connectivity issues with Firebase that can prevent the app from working correctly.

## What Fails on Simulator

1. **Firebase Auth** – Sign-in often fails with network errors (-1017, "cannot parse response"). The app falls back to a dev user, but this user has no valid Firebase token.
2. **Firestore** – WebChannel transport errors: "Could not reach Cloud Firestore backend". Real-time listeners (e.g. active incident) fail.
3. **REST API** – Requires a Bearer token. With dev fallback, `auth.currentUser` is null, so no token is sent → 401 Unauthorized. Map data, scenarios, zones, etc. won't load.

## Recommended: Use a Real Device

For full functionality, test on a **physical iPhone** over Wi-Fi:

```bash
# Option 1: Run directly on device
npx expo run:ios --device

# Option 2: Start dev server, scan QR code with Expo Go on your iPhone
npx expo start
```

On a real device, Firebase Auth and Firestore work normally, and the REST API receives valid tokens.

## Simulator Workarounds (Limited)

- **Dev fallback** – Lets you navigate the app when Auth fails, but API calls (map, scenarios, zones) will fail without a token.
- **Firestore errors** – The console will show repeated "WebChannelConnection RPC 'Listen' transport errored" messages. These come from the Firebase SDK; the app handles them by treating the incident as null.

## Summary

| Feature           | Simulator | Real Device |
|------------------|-----------|-------------|
| Login (real)     | Often fails | Works      |
| Dev fallback     | Works     | N/A         |
| Map / sites      | Fails (no token) | Works  |
| Scenarios        | Fails (no token) | Works  |
| Trigger incident | Fails (no token) | Works  |
| Firestore listeners | Fails  | Works      |
