# MassComs Mobile

React Native (Expo) app for real-time incident management and emergency response.

## Prerequisites

- Node 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio + Android SDK (Android)
- Xcode 15+ (iOS)
- EAS CLI for builds (`npm install -g eas-cli`)

## Setup

```sh
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_API_BASE_URL if using a non-production backend
npm install
```

## Run

### Android

```sh
npm run android
```

### iOS

```sh
npm run ios
```

## Build

### Android (APK / AAB)

```sh
# Preview APK (sideload / internal testing)
npm run build:android:preview

# Production AAB (Google Play)
npm run build:android
```

### iOS (TestFlight)

```sh
# Build + submit to TestFlight automatically
npm run build:ios:testflight

# Build only
npm run build:ios
```

Requires `eas login` and an EAS project configured in `eas.json`.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | REST API base URL (e.g. `https://admin.masscoms.com`) |
| `EXPO_PUBLIC_WS_URL` | No | WebSocket URL — defaults to `wss://admin.masscoms.com/ws` |
| `EXPO_PUBLIC_SKIP_BIOMETRICS` | No | Set to `1` to bypass Face ID gate on simulator/CI |

## Troubleshooting

- **Metro cache issues**: run `npm run reset` to clear cache and restart
- **iOS build fails**: run `cd ios && pod install` then rebuild
- **Android emulator not detected**: ensure `ANDROID_HOME` is set and an AVD is running
- **WebSocket not connecting**: verify `EXPO_PUBLIC_API_BASE_URL` is reachable and uses `https://`
- **Biometrics loop on simulator**: set `EXPO_PUBLIC_SKIP_BIOMETRICS=1` in `.env`
