# Fixing Firebase Login (-1017) in iOS Simulator

The iOS 18.4 simulator has a known bug with HTTP/3 (QUIC) that causes Firebase Auth to fail with error -1017 ("cannot parse response"). This affects `identitytoolkit.googleapis.com` and other Google APIs.

## Option 1: Use Web Instead (Fastest)

Run the app in the browser—it uses the Mac's network stack, which works correctly:

```bash
cd masscoms-mobile
npm run web
```

Then open http://localhost:8081 (or the URL shown) in your browser. Login should work.

## Option 2: Use an Older Simulator

Use an iOS 18.2 or 18.3 simulator instead of 18.4:

1. **Download older runtime**: Xcode → Settings → Platforms → click **+** → select **iOS 18.2** or **18.3** → Get
2. **Run on that simulator**:
   ```bash
   npx expo run:ios --device "iPhone 15"
   ```
   (Use a device name that matches the older runtime, e.g. "iPhone 15" for 18.2)

## Option 3: Upgrade Xcode

Xcode 16.4 includes a fix for URLSession in the simulator. If you upgrade to Xcode 16.4+, the -1017 error may be resolved.

## Option 4: mitmproxy (Advanced)

Use an older mitmproxy (pre-HTTP/3) as a proxy so the simulator falls back to HTTP/2:

```bash
pip install 'mitmproxy<11'
mitmproxy -p 8888
```

Then set your Mac's HTTP/HTTPS proxy to 127.0.0.1:8888 (System Settings → Network → Wi-Fi → Proxies). Install the mitmproxy CA cert on the simulator by visiting http://mitm.it in Safari on the simulator.
