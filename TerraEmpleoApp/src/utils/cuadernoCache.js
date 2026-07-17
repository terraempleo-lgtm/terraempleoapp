import AsyncStorage from '@react-native-async-storage/async-storage';

const LABORES_KEY = 'cuaderno:labores_custom';
const WEEKLY_KEY = 'cuaderno:weekly_cache';

function lunesActual() {
  const d = new Date();
  const dia = d.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes.toISOString().slice(0, 10);
}

// ─── Labores personalizadas ("Otro" en labor general o por trabajador) ────
export async function getLaboresCustom() {
  try {
    const raw = await AsyncStorage.getItem(LABORES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function addLaborCustom(labor) {
  if (!labor || !labor.trim()) return;
  try {
    const actuales = await getLaboresCustom();
    const val = labor.trim();
    if (!actuales.includes(val)) {
      await AsyncStorage.setItem(LABORES_KEY, JSON.stringify([...actuales, val]));
    }
  } catch {}
}

// ─── Caché semanal de valores repetidos (finca, vacante, labor, precios, sugeridos) ──
// Expira cada lunes para no arrastrar datos de semanas anteriores.
export async function getWeeklyCache() {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.weekStart !== lunesActual()) return {};
    return parsed.data || {};
  } catch { return {}; }
}

export async function setWeeklyCache(partial) {
  try {
    const actual = await getWeeklyCache();
    const merged = { ...actual, ...partial };
    await AsyncStorage.setItem(WEEKLY_KEY, JSON.stringify({ weekStart: lunesActual(), data: merged }));
  } catch {}
}
