# Deploy to TestFlight

This guide walks you through getting the Mass Coms mobile app onto TestFlight.

## Prerequisites

- **Apple Developer Program** membership ($99/year) – [developer.apple.com/programs](https://developer.apple.com/programs)
- **Expo account** – [expo.dev/signup](https://expo.dev/signup)

## Step 1: Create the app in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) and sign in.
2. Click **My Apps** → **+** → **New App**.
3. Fill in:
   - **Platforms**: iOS
   - **Name**: Mass Coms (or your preferred name)
   - **Primary Language**: English
   - **Bundle ID**: `com.awecreative.masscoms-mobile` (must match `app.json`)
   - **SKU**: e.g. `masscoms-mobile`
4. Click **Create**.
5. Note the **Apple ID** (numeric, e.g. `1234567890`) – you’ll need this for `ascAppId`.

## Step 2: Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

## Step 3: Configure the project

```bash
cd masscoms-mobile
eas build:configure
```

When prompted, choose **All** or **iOS** and let EAS create/update `eas.json`.

## Step 4: Add your App Store Connect App ID

Edit `eas.json` and replace `YOUR_ASC_APP_ID` with the numeric Apple ID from Step 1:

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "1234567890"
    }
  }
}
```

## Step 5: Build and submit to TestFlight

```bash
eas build --platform ios --profile production --auto-submit
```

EAS will:

1. Build the app in the cloud.
2. Ask you to sign in with your Apple ID (first time only).
3. Manage signing credentials (or use yours if configured).
4. Submit the build to App Store Connect when the build finishes.

## Step 6: Wait for processing

- Build: ~10–20 minutes.
- After upload, Apple processes the build (10–30 minutes).
- Check status in App Store Connect → Your App → TestFlight.

## Step 7: Add testers

In App Store Connect → TestFlight:

- **Internal testing**: Up to 100 team members (no review).
- **External testing**: Add testers by email; first build needs a short Beta App Review.

---

## Troubleshooting

**"No valid signing certificate"**  
EAS will offer to create one. Choose **Yes** and sign in with your Apple ID.

**"Bundle ID already in use"**  
The app must already exist in App Store Connect with this bundle ID. Create it in Step 1.

**Build fails on env vars**  
Ensure `EXPO_PUBLIC_API_BASE_URL` in `eas.json` matches your deployed Cloud Functions URL. The default is `https://us-central1-masscoms.cloudfunctions.net/api/v1`.

**Submit fails**  
Run `eas submit --platform ios --profile production` and follow the prompts. You may need to provide an App-Specific Password: [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords.
