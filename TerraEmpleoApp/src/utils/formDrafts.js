import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'draft:';
const INDEX_KEY = 'draft:_index';

// ─── Sanitizers ──────────────────────────────────────────────────────────────
const ALWAYS_EXCLUDE = new Set([
  'password', 'confirmPassword', 'passwordRepetir',
  'codigoSMS', 'codigoEnviado', 'codigoEmail',
  'loading', 'errors', 'enviando', 'guardadoExitoso', 'publicadoExitoso',
]);

// Cualquier string que parezca path local de imagen/archivo no se persiste
// porque las URIs `file://`, `content://`, `ph://` pueden invalidarse cuando
// el SO limpia su cache temporal.
function looksLikeLocalUri(v) {
  if (typeof v !== 'string') return false;
  return /^(file|content|ph|asset|blob):\/\//i.test(v) ||
         /(ImagePicker|cache|tmp|temp|Documents)\//i.test(v);
}

function sanitize(data, excludeFields = []) {
  const out = {};
  const skip = new Set([...ALWAYS_EXCLUDE, ...(excludeFields || [])]);
  for (const [k, v] of Object.entries(data || {})) {
    if (skip.has(k)) continue;
    if (v === undefined || v === null) continue;
    if (typeof v === 'function') continue;
    // String que parece path local → omitir
    if (looksLikeLocalUri(v)) continue;
    // Arrays con URIs locales → filtrar; si queda vacío, omitir
    if (Array.isArray(v)) {
      const cleaned = v.filter(item => !looksLikeLocalUri(item));
      if (cleaned.length === 0) continue;
      out[k] = cleaned;
      continue;
    }
    // Objetos planos: serializables JSON
    if (typeof v === 'object') {
      try { JSON.stringify(v); out[k] = v; continue; } catch { continue; }
    }
    out[k] = v;
  }
  return out;
}

// ─── Index de drafts (para clearAll y debug) ─────────────────────────────────
async function readIndex() {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeIndex(keys) {
  try { await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(Array.from(new Set(keys)))); } catch {}
}

async function registerKey(key) {
  const idx = await readIndex();
  if (!idx.includes(key)) {
    idx.push(key);
    await writeIndex(idx);
  }
}

async function unregisterKey(key) {
  const idx = await readIndex();
  await writeIndex(idx.filter(k => k !== key));
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Guarda un borrador asociado a `key`. Filtra automáticamente campos
 * sensibles (passwords, OTPs) y URIs locales que pueden invalidarse.
 */
export async function saveDraft(key, data, { excludeFields = [], ttlDays = 7 } = {}) {
  if (!key) return;
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  const clean = sanitize(data, excludeFields);
  if (Object.keys(clean).length === 0) {
    // Nada significativo que guardar → equivalente a clear
    return clearDraft(key);
  }
  const payload = {
    data: clean,
    savedAt: new Date().toISOString(),
    ttlDays,
  };
  try {
    await AsyncStorage.setItem(fullKey, JSON.stringify(payload));
    await registerKey(fullKey);
  } catch (e) {
    console.warn('saveDraft falló:', e?.message);
  }
}

/**
 * Carga un borrador. Devuelve `{ data, savedAt }` o null si no existe / expiró.
 * Si expiró, lo borra silenciosamente.
 */
export async function loadDraft(key) {
  if (!key) return null;
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  try {
    const raw = await AsyncStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const savedAt = new Date(parsed.savedAt);
    const ttlMs = (parsed.ttlDays || 7) * 24 * 60 * 60 * 1000;
    if (Date.now() - savedAt.getTime() > ttlMs) {
      // expirado
      await clearDraft(key);
      return null;
    }
    return { data: parsed.data || {}, savedAt };
  } catch {
    return null;
  }
}

export async function clearDraft(key) {
  if (!key) return;
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  try {
    await AsyncStorage.removeItem(fullKey);
    await unregisterKey(fullKey);
  } catch {}
}

/**
 * Borra todos los drafts. Llamado en signOut para no mezclar entre cuentas.
 */
export async function clearAllDrafts() {
  try {
    const idx = await readIndex();
    await Promise.all(idx.map(k => AsyncStorage.removeItem(k)));
    await AsyncStorage.removeItem(INDEX_KEY);
  } catch {}
}

/**
 * Formato relativo en español: "hace 5 min", "hace 2 horas", "hace 3 días".
 */
export function formatTiempoRelativo(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const segundos = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (segundos < 60) return 'hace unos segundos';
  const min = Math.floor(segundos / 60);
  if (min < 60) return `hace ${min} ${min === 1 ? 'min' : 'min'}`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
