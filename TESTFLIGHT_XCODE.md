# Deploy to TestFlight via Xcode

## Prerequisites

- **Apple Developer Program** membership ($99/year)
- App created in [App Store Connect](https://appstoreconnect.apple.com/) with bundle ID `com.awecreative.masscoms-mobile`

## Step 1: Open the project in Xcode

```bash
cd masscoms-mobile
open ios/masscomsmobile.xcworkspace
```

Use the `.xcworkspace` file (not `.xcodeproj`) so CocoaPods is included.

## Step 2: Set the signing team

1. Select the **masscomsmobile** project in the left sidebar.
2. Select the **masscomsmobile** target.
3. Open the **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. Choose your **Team** (your Apple Developer account).
6. Confirm the **Bundle Identifier** is `com.awecreative.masscoms-mobile`.

## Step 3: Set build configuration to Release

1. **Product** → **Scheme** → **Edit Scheme…** (or click the scheme name next to the Run button).
2. Select **Run** in the left column.
3. Set **Build Configuration** to **Release**.
4. Close the window.

## Step 4: Select “Any iOS Device” as destination

In the device dropdown next to the Run button, choose **Any iOS Device (arm64)** (not a simulator).

## Step 5: Archive the app

1. **Product** → **Archive**.
2. Wait for the archive to finish (several minutes).
3. The **Organizer** window opens with your archive.

## Step 6: Distribute to App Store Connect

1. In Organizer, select your archive and click **Distribute App**.
2. Choose **App Store Connect** → **Next**.
3. Choose **Upload** → **Next**.
4. Leave defaults (e.g. “Upload your app’s symbols”) → **Next**.
5. Choose **Automatically manage signing** (or your distribution profile) → **Next**.
6. Review and click **Upload**.
7. Wait for the upload to complete.

## Step 7: Wait for processing

- Processing usually takes 10–30 minutes.
- Check status in [App Store Connect](https://appstoreconnect.apple.com/) → Your App → **TestFlight**.
- When processing finishes, the build appears under TestFlight.

## Step 8: Add testers

In App Store Connect → TestFlight:

- **Internal testing**: Add team members (no review).
- **External testing**: Add testers by email; first build needs Beta App Review.

---

## Troubleshooting

**“No signing certificate”**  
Xcode → Settings → Accounts → select your Apple ID → **Manage Certificates** → create an **Apple Distribution** certificate.

**“Bundle ID doesn’t match”**  
Create an app in App Store Connect with bundle ID `com.awecreative.masscoms-mobile`, or change the bundle ID in Xcode to match an existing app.

**Archive option is disabled**  
Ensure **Any iOS Device** is selected (not a simulator) and the scheme’s Run configuration is **Release**.

**“Provisioning profile doesn’t include signing certificate”**  
Enable **Automatically manage signing** and select the correct Team.
