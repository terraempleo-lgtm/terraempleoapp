import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  VACANTES: 'cache_vacantes_v1',
  VACANTES_TS: 'cache_vacantes_ts_v1',
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function guardarVacantesCache(vacantes) {
  try {
    await AsyncStorage.multiSet([
      [KEYS.VACANTES, JSON.stringify(vacantes)],
      [KEYS.VACANTES_TS, String(Date.now())],
    ]);
  } catch (_) {}
}

export async function leerVacantesCache() {
  try {
    const [[, data], [, ts]] = await AsyncStorage.multiGet([KEYS.VACANTES, KEYS.VACANTES_TS]);
    if (!data) return null;
    const edad = Date.now() - Number(ts || 0);
    if (edad > MAX_AGE_MS) return null;
    return JSON.parse(data);
  } catch (_) {
    return null;
  }
}

export async function limpiarCache() {
  try {
    await AsyncStorage.multiRemove([KEYS.VACANTES, KEYS.VACANTES_TS]);
  } catch (_) {}
}
