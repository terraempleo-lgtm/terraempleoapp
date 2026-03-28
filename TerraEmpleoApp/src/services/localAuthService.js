import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** true si el dispositivo tiene biométrico o PIN configurado */
export async function isLocalAuthAvailable() {
  if (Platform.OS === 'web') return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

/**
 * Lanza el diálogo de biométrico / PIN.
 * Retorna { success: boolean, error?: string }
 */
export async function authenticateLocally(promptMessage) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: promptMessage || 'Verifica tu identidad para ingresar',
    cancelLabel: 'Cancelar',
    disableDeviceFallback: false, // permite PIN como fallback
  });
  return result;
}
