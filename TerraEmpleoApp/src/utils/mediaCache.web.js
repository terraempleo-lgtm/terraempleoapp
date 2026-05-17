// Stub web de mediaCache.js — no hay FileSystem persistente en web, todas las
// funciones son no-op y devuelven la URL original (que el navegador cachea solo).

export function getStableKey(url) {
  if (!url || typeof url !== 'string') return null;
  const q = url.indexOf('?');
  return q >= 0 ? url.slice(0, q) : url;
}
export function getLocalPath() { return null; }
export async function tieneCacheLocal() { return null; }
export async function descargarYCachear(url) { return url || null; }
export async function resolverFuente(url) { return url || null; }
export async function borrarPorEntidad() {}
export async function getTamanoCacheMB() { return 0; }
export async function purgarLRU() { return { total: 0, borrados: 0 }; }
export async function copiarAlOutbox() {
  throw new Error('FileSystem no disponible en web');
}
export async function borrarOutboxFile() {}
export const MEDIA_PATHS = { ROOT: '', OUTBOX_DIR: '' };
