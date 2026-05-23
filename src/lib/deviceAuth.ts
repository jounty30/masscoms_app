import * as LocalAuthentication from 'expo-local-authentication';

export type DeviceAuthType = 'face' | 'fingerprint' | 'pin' | 'none';

export interface DeviceAuthInfo {
  type: DeviceAuthType;
  label: string;
  icon: string;
  canAuthenticate: boolean;
}

export async function getDeviceAuthInfo(): Promise<DeviceAuthInfo> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();

  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return { type: 'none', label: 'No screen lock', icon: 'lock-off', canAuthenticate: false };
  }

  if (level === LocalAuthentication.SecurityLevel.SECRET) {
    return { type: 'pin', label: 'Screen lock', icon: 'lock', canAuthenticate: true };
  }

  // BIOMETRIC — detect which type
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { type: 'face', label: 'Face unlock', icon: 'face-recognition', canAuthenticate: true };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { type: 'fingerprint', label: 'Fingerprint', icon: 'fingerprint', canAuthenticate: true };
  }
  return { type: 'pin', label: 'Screen lock', icon: 'lock', canAuthenticate: true };
}

/**
 * Authenticate using whatever the device supports: biometrics first, PIN/pattern as fallback.
 * Never call this on simulator in dev — check __DEV__ before calling.
 */
export async function authenticateDevice(
  promptMessage: string
): Promise<{ success: boolean; error?: string }> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();

  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      success: false,
      error:
        'No screen lock is set up on this device. Please set a PIN, fingerprint, or face unlock in device settings.',
    };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (result.success) return { success: true };
  if (result.error === 'user_cancel' || result.error === 'system_cancel') {
    return { success: false };
  }
  return { success: false, error: result.error };
}
