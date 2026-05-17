import * as FileSystem from 'expo-file-system';
import { imageAssetsRepo } from '../db/repos';
import { getDb } from '../db/database';
import { getNetworkStateSync } from '../hooks/useNetworkStatus';

const ROOT = `${FileSystem.documentDirectory}media_cache/`;
const OUTBOX_DIR = `${FileSystem.documentDirectory}outbox/`;

let _rootEnsured = false;
async function ensureDirs() {
  if (_rootEnsured) return;
  try {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
    await FileSystem.makeDirectoryAsync(OUTBOX_DIR, { intermediates: true });
    _rootEnsured = true;
  } catch (_) {
    // Si ya existe, ignorar
    _rootEnsured = true;
  }
}

/**
 * Extrae la clave estable de S3 (la parte antes del `?`).
 * Para URLs no-S3 devuelve la URL completa.
 */
export function getStableKey(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('file://')) return null; // ya es local
  const q = url.indexOf('?');
  return q >= 0 ? url.slice(0, q) : url;
}

function inferExt(key, fallback = 'bin') {
  const m = (key || '').match(/\.([a-zA-Z0-9]+)$/);
  return (m ? m[1] : fallback).toLowerCase();
}

function safeFilename(key, mensajeIdHint) {
  // toma últimos 2 segmentos para evitar paths muy profundos
  const base = key.split('/').slice(-2).join('_');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return mensajeIdHint ? `${mensajeIdHint}_${cleaned}` : cleaned;
}

/**
 * Construye el path local destino para una URL+entidad.
 */
export function getLocalPath(stableKey, entity, entityId) {
  const dir = `${ROOT}${entity || 'misc'}/${entityId || '0'}/`;
  const filename = safeFilename(stableKey, entity === 'mensaje' ? entityId : null);
  return `${dir}${filename}`;
}

async function ensureEntityDir(entity, entityId) {
  await ensureDirs();
  const dir = `${ROOT}${entity || 'misc'}/${entityId || '0'}/`;
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch (_) {}
  return dir;
}

/**
 * Consulta SQLite si ya hay una entrada local para esta URL (por stableKey).
 * Devuelve `file://...` o null.
 */
export async function tieneCacheLocal(url) {
  const key = getStableKey(url);
  if (!key) return url?.startsWith('file://') ? url : null;
  try {
    const local = await imageAssetsRepo.getLocalPath(key);
    if (!local) return null;
    const info = await FileSystem.getInfoAsync(local);
    if (info.exists && info.size > 0) return local;
    // archivo borrado físicamente pero SQLite lo cree presente: limpiar
    const db = await getDb();
    if (db) await db.runAsync('DELETE FROM image_assets WHERE url = ?', [key]);
    return null;
  } catch {
    return null;
  }
}

/**
 * Descarga la URL al sistema de archivos local y registra en SQLite.
 * Devuelve el path local `file://...` o null en error.
 * Si ya está cacheado, no descarga otra vez.
 */
export async function descargarYCachear(url, { entity, entityId } = {}) {
  if (!url) return null;
  if (url.startsWith('file://')) return url;
  const key = getStableKey(url);
  if (!key) return null;

  // ¿ya está?
  const existente = await tieneCacheLocal(url);
  if (existente) return existente;

  // chequeo de red — si offline, no intentar (queda para próximo sync)
  const net = getNetworkStateSync();
  if (!net.isOnline) return null;

  try {
    const dir = await ensureEntityDir(entity, entityId);
    const local = `${dir}${safeFilename(key, entity === 'mensaje' ? entityId : null)}`;
    const res = await FileSystem.downloadAsync(url, local);
    if (!res || res.status !== 200) {
      try { await FileSystem.deleteAsync(local, { idempotent: true }); } catch (_) {}
      return null;
    }
    await imageAssetsRepo.upsert(key, local, entity || null, entityId || null);
    return local;
  } catch (e) {
    console.warn('mediaCache.descargar falló:', e?.message);
    return null;
  }
}

/**
 * Resuelve una URL a la mejor fuente disponible:
 * - si hay local, devuelve `file://...`
 * - si no y autoDescargar=true y online, descarga y devuelve local
 * - si no, devuelve la URL original (puede fallar offline)
 */
export async function resolverFuente(url, { entity, entityId, autoDescargar = true } = {}) {
  if (!url) return null;
  if (url.startsWith('file://')) return url;
  const local = await tieneCacheLocal(url);
  if (local) return local;
  if (!autoDescargar) return url;
  const fresco = await descargarYCachear(url, { entity, entityId });
  return fresco || url;
}

/**
 * Borra todos los archivos físicos y registros de una entidad+id.
 */
export async function borrarPorEntidad(entity, entityId) {
  const assets = await imageAssetsRepo.deleteByEntity(entity, entityId);
  for (const a of (assets || [])) {
    try { await FileSystem.deleteAsync(a.local_path, { idempotent: true }); } catch (_) {}
  }
  // borrar el directorio si quedó vacío
  try {
    const dir = `${ROOT}${entity}/${entityId}/`;
    await FileSystem.deleteAsync(dir, { idempotent: true });
  } catch (_) {}
}

/**
 * Tamaño total del cache (MB).
 */
export async function getTamanoCacheMB() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.getAllAsync('SELECT local_path FROM image_assets');
  let total = 0;
  for (const r of (rows || [])) {
    try {
      const info = await FileSystem.getInfoAsync(r.local_path);
      if (info.exists && info.size) total += info.size;
    } catch (_) {}
  }
  return Math.round((total / (1024 * 1024)) * 100) / 100;
}

/**
 * Política LRU: si el cache excede maxMB, borra los más viejos hasta volver bajo el límite.
 */
export async function purgarLRU(maxMB = 250) {
  const total = await getTamanoCacheMB();
  if (total <= maxMB) return { total, borrados: 0 };
  const db = await getDb();
  if (!db) return { total, borrados: 0 };
  const rows = await db.getAllAsync(
    'SELECT url, local_path, cached_at FROM image_assets ORDER BY cached_at ASC'
  );
  let borrados = 0;
  let acumulado = total;
  for (const r of (rows || [])) {
    if (acumulado <= maxMB) break;
    try {
      const info = await FileSystem.getInfoAsync(r.local_path);
      const size = info.exists ? (info.size || 0) : 0;
      await FileSystem.deleteAsync(r.local_path, { idempotent: true });
      await db.runAsync('DELETE FROM image_assets WHERE url = ?', [r.url]);
      acumulado -= size / (1024 * 1024);
      borrados++;
    } catch (_) {}
  }
  return { total: acumulado, borrados };
}

/**
 * Copia un archivo al outbox con un uuid persistente.
 * Devuelve `{ uuid, localPath, ext }`.
 */
export async function copiarAlOutbox(uri, hintExt = null) {
  await ensureDirs();
  const ext = hintExt || inferExt(uri) || 'bin';
  const uuid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const localPath = `${OUTBOX_DIR}${uuid}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: localPath });
  return { uuid, localPath, ext };
}

export async function borrarOutboxFile(localPath) {
  try { await FileSystem.deleteAsync(localPath, { idempotent: true }); } catch (_) {}
}

export const MEDIA_PATHS = { ROOT, OUTBOX_DIR };
