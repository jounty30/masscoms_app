# TestFlight White Screen – Troubleshooting

If the app opens to a white screen on TestFlight, try these fixes in order.

## 1. Use EAS Build (Recommended)

Building with EAS is more reliable than Xcode for production:

```bash
cd masscoms-mobile
eas build --platform ios --profile production
```

Then upload the `.ipa` from the EAS build page to App Store Connect, or use:

```bash
eas build --platform ios --profile production --auto-submit
```

EAS ensures the correct production bundle, env vars, and native config.

---

## 2. If Using Xcode – Regenerate Native Project

After adding `app.config.js` or changing plugins, regenerate the iOS project:

```bash
cd masscoms-mobile
npx expo prebuild --platform ios --clean
```

Then open Xcode and archive again. The `--clean` flag removes the old `ios/` folder so config changes are applied.

---

## 3. Verify Archive Uses Release

In Xcode:

1. **Product** → **Scheme** → **Edit Scheme…**
2. Select **Archive** in the left column
3. Set **Build Configuration** to **Release**
4. Close

If this is set to Debug, the app may try to load from Metro and show a white screen.

---

## 4. Check Info.plist for NSMicrophoneUsageDescription

The app needs microphone permission for Live PA. If it’s missing, the app can crash before React loads.

`app.config.js` adds it. After changing config, run:

```bash
npx expo prebuild --platform ios --clean
```

---

## 5. View Device Logs

To see the actual error:

1. Connect the iPhone to your Mac
2. Open **Console.app**
3. Select the device
4. Launch the app from TestFlight
5. Filter by your app name or “masscoms”

Look for crash logs or errors such as “NSMicrophoneUsageDescription” or “EXPermissionsService”.
