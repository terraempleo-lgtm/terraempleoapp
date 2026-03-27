/**
 * passkeyService.js
 *
 * Wrapper alrededor de react-native-passkey.
 * En web o dispositivos sin soporte retorna null / lanza error controlado.
 *
 * Instalar: npx expo install react-native-passkey
 * Requiere EAS build (módulo nativo, no funciona en Expo Go).
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PASSKEY_CELULAR_KEY = '@terraempleo_passkey_celular';
const PASSKEY_PROMPTED_KEY = '@terraempleo_passkey_prompted';

// Carga lazy del módulo nativo para no romper en web
let _Passkey = null;
function getNativePasskey() {
  if (Platform.OS === 'web') return null;
  if (_Passkey) return _Passkey;
  try {
    _Passkey = require('react-native-passkey').Passkey;
    return _Passkey;
  } catch {
    return null;
  }
}

/** true si el dispositivo soporta passkeys (iOS 16+ / Android 9+) */
export function isPasskeySupported() {
  const P = getNativePasskey();
  if (!P) return false;
  return P.isSupported?.() ?? false;
}

/**
 * Inicia la ceremonia de registro (create).
 * @param {object} credentialCreationOptions  — viene del backend / Cognito
 * @returns {object} credential — PublicKeyCredential serializable a JSON
 */
export async function createPasskey(credentialCreationOptions) {
  const P = getNativePasskey();
  if (!P) throw new Error('Passkeys no disponibles en este dispositivo.');
  return await P.create(credentialCreationOptions);
}

/**
 * Inicia la ceremonia de autenticación (get).
 * @param {object} credentialRequestOptions — viene del backend / Cognito
 * @returns {object} assertion — PublicKeyCredential serializable a JSON
 */
export async function getPasskey(credentialRequestOptions) {
  const P = getNativePasskey();
  if (!P) throw new Error('Passkeys no disponibles en este dispositivo.');
  return await P.get(credentialRequestOptions);
}

// ── Helpers AsyncStorage ──────────────────────────────────────────────────────

export async function savePasskeyCelular(celular) {
  await AsyncStorage.setItem(PASSKEY_CELULAR_KEY, celular);
}

export async function getPasskeyCelular() {
  return AsyncStorage.getItem(PASSKEY_CELULAR_KEY);
}

export async function removePasskeyCelular() {
  await AsyncStorage.removeItem(PASSKEY_CELULAR_KEY);
}

export async function markPasskeyPrompted() {
  await AsyncStorage.setItem(PASSKEY_PROMPTED_KEY, '1');
}

export async function wasPasskeyPrompted() {
  const val = await AsyncStorage.getItem(PASSKEY_PROMPTED_KEY);
  return val === '1';
}
