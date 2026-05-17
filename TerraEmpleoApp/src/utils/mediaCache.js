import { Platform } from 'react-native';
import { imageAssetsRepo } from '../db/repos';
import { getDb } from '../db/database';
import { getNetworkStateSync } from '../hooks/useNetworkStatus';

// Lazy require de expo-file-system: en web no se necesita acceso al
// FileSystem (no hay cache local persistente), y evitamos que el bundler
// intente resolver el módulo en el bundle web.
let _FS = null;
function fs() {
  if (Platform.OS === 'web') return null;
  if (!_FS) {
    // eslint-disable-next-line global-require
    _FS = require('expo-file-system');
  }
  return _FS;
}

function getRoot() { return `${fs()?.documentDirectory || ''}media_cache/`; }
function getOutboxDir() { return `${fs()?.documentDirectory || ''}outbox/`; }

let _rootEnsured = false;
async function ensureDirs() {
  if (_rootEnsured) return;
  const F = fs();
  if (!F) { _rootEnsured = true; return; }
  try {
    await F.makeDirectoryAsync(getRoot(), { intermediates: true });
    await F.makeDirectoryAsync(getOutboxDir(), { intermediates: true });
    _rootEnsured = true;
  } catch (_) {
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
  const base = key.split('/').slice(-2).join('_');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return mensajeIdHint ? `${mensajeIdHint}_${cleaned}` : cleaned;
}

/**
 * Construye el path local destino para una URL+entidad.
 */
export function getLocalPath(stableKey, entity, entityId) {
  const dir = `${getRoot()}${entity || 'misc'}/${entityId || '0'}/`;
  const filename = safeFilename(stableKey, entity === 'mensaje' ? entityId : null);
  return `${dir}${filename}`;
}

async function ensureEntityDir(entity, entityId) {
  await ensureDirs();
  const F = fs();
  if (!F) return null;
  const dir = `${getRoot()}${entity || 'misc'}/${entityId || '0'}/`;
  try { await F.makeDirectoryAsync(dir, { intermediates: true }); } catch (_) {}
  return dir;
}

/**
 * Consulta SQLite si ya hay una entrada local para esta URL (por stableKey).
 * Devuelve `file://...` o null.
 */
export async function tieneCacheLocal(url) {
  const key = getStableKey(url);
  if (!key) return url?.startsWith('file://') ? url : null;
  const F = fs();
  if (!F) return null;
  try {
    const local = await imageAssetsRepo.getLocalPath(key);
    if (!local) return null;
    const info = await F.getInfoAsync(local);
    if (info.exists && info.size > 0) return local;
    // archivo borrado físicamente pero SQLite cree presente: limpiar
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
  const F = fs();
  if (!F) return null; // web: sin acceso a FileSystem
  const key = getStableKey(url);
  if (!key) return null;

  const existente = await tieneCacheLocal(url);
  if (existente) return existente;

  const net = getNetworkStateSync();
  if (!net.isOnline) return null;

  try {
    const dir = await ensureEntityDir(entity, entityId);
    if (!dir) return null;
    const local = `${dir}${safeFilename(key, entity === 'mensaje' ? entityId : null)}`;
    const res = await F.downloadAsync(url, local);
    if (!res || res.status !== 200) {
      try { await F.deleteAsync(local, { idempotent: true }); } catch (_) {}
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
 * Resuelve una URL a la mejor fuente disponible.
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
  const F = fs();
  const assets = await imageAssetsRepo.deleteByEntity(entity, entityId);
  if (!F) return;
  for (const a of (assets || [])) {
    try { await F.deleteAsync(a.local_path, { idempotent: true }); } catch (_) {}
  }
  try {
    const dir = `${getRoot()}${entity}/${entityId}/`;
    await F.deleteAsync(dir, { idempotent: true });
  } catch (_) {}
}

/**
 * Tamaño total del cache (MB).
 */
export async function getTamanoCacheMB() {
  const F = fs();
  if (!F) return 0;
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.getAllAsync('SELECT local_path FROM image_assets');
  let total = 0;
  for (const r of (rows || [])) {
    try {
      const info = await F.getInfoAsync(r.local_path);
      if (info.exists && info.size) total += info.size;
    } catch (_) {}
  }
  return Math.round((total / (1024 * 1024)) * 100) / 100;
}

/**
 * Política LRU: si el cache excede maxMB, borra los más viejos.
 */
export async function purgarLRU(maxMB = 250) {
  const F = fs();
  const total = await getTamanoCacheMB();
  if (total <= maxMB) return { total, borrados: 0 };
  const db = await getDb();
  if (!db || !F) return { total, borrados: 0 };
  const rows = await db.getAllAsync(
    'SELECT url, local_path, cached_at FROM image_assets ORDER BY cached_at ASC'
  );
  let borrados = 0;
  let acumulado = total;
  for (const r of (rows || [])) {
    if (acumulado <= maxMB) break;
    try {
      const info = await F.getInfoAsync(r.local_path);
      const size = info.exists ? (info.size || 0) : 0;
      await F.deleteAsync(r.local_path, { idempotent: true });
      await db.runAsync('DELETE FROM image_assets WHERE url = ?', [r.url]);
      acumulado -= size / (1024 * 1024);
      borrados++;
    } catch (_) {}
  }
  return { total: acumulado, borrados };
}

/**
 * Copia un archivo al outbox con un uuid persistente.
 */
export async function copiarAlOutbox(uri, hintExt = null) {
  const F = fs();
  if (!F) throw new Error('FileSystem no disponible en esta plataforma');
  await ensureDirs();
  const ext = hintExt || inferExt(uri) || 'bin';
  const uuid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const localPath = `${getOutboxDir()}${uuid}.${ext}`;
  await F.copyAsync({ from: uri, to: localPath });
  return { uuid, localPath, ext };
}

export async function borrarOutboxFile(localPath) {
  const F = fs();
  if (!F) return;
  try { await F.deleteAsync(localPath, { idempotent: true }); } catch (_) {}
}

export const MEDIA_PATHS = {
  get ROOT() { return getRoot(); },
  get OUTBOX_DIR() { return getOutboxDir(); },
};
