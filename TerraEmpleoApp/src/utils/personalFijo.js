import AsyncStorage from '@react-native-async-storage/async-storage';

// Personal fijo de la finca: trabajadores que siempre están (atajo pedido
// por los usuarios para no tener que agregarlos jornada por jornada).
// Se guarda por finca en el dispositivo. Cada entrada:
// { trabajador_id: number|null, nombre: string, foto: string|null, manual_telefono: string }

export const PERSONAL_FIJO_KEY = (fincaId) => `personal_fijo_finca_${fincaId || 'sin'}`;

export async function leerPersonalFijo(fincaId) {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_FIJO_KEY(fincaId));
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export async function guardarPersonalFijo(fincaId, lista) {
  try {
    await AsyncStorage.setItem(PERSONAL_FIJO_KEY(fincaId), JSON.stringify(lista || []));
  } catch { /* no-op */ }
}
