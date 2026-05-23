/**
 * Crashlytics: no-op. Native React Native Firebase (Crashlytics) was removed
 * so the app builds without GoogleService-Info.plist. Use this for error reporting in JS only if needed.
 */
type CrashlyticsModule = () => { recordError: (e: Error) => void; log: (s: string) => void };

const noop: CrashlyticsModule = () => ({
  recordError: () => {},
  log: () => {},
});

export default function getCrashlytics(): CrashlyticsModule {
  return noop;
}
