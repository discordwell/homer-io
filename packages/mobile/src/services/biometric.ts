import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from './mmkv';

const BIOMETRIC_ENABLED_KEY = 'homer_biometric_enabled';

/** Check if biometric hardware is available and enrolled */
export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

/** Get the type of biometric available (for display purposes) */
export async function getBiometricType(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'Fingerprint';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }
  return 'Biometric';
}

/** Check if the user has enabled biometric unlock */
export function isBiometricEnabled(): boolean {
  return storage.getBoolean(BIOMETRIC_ENABLED_KEY) ?? false;
}

/** Enable or disable biometric unlock preference */
export function setBiometricEnabled(enabled: boolean): void {
  storage.set(BIOMETRIC_ENABLED_KEY, enabled);
}

/** Authenticate using biometric — returns true on success */
export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock HOMER',
    fallbackLabel: 'Use password',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}
