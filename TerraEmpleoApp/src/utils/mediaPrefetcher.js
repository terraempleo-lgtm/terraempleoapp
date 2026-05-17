import { descargarYCachear, tieneCacheLocal } from './mediaCache';
import { getNetworkStateSync } from '../hooks/useNetworkStatus';

const MAX_PARALLEL = 3;
const queue = [];
const inFlight = new Set();
let workers = 0;

function dedupKey(item) {
  return `${item.entity || ''}:${item.entityId || ''}:${item.url}`;
}

async function worker() {
  while (queue.length > 0) {
    // Pausar si offline; reintentaremos cuando vuelva el net (lo dispara OfflineSyncManager)
    const net = getNetworkStateSync();
    if (!net.isOnline) break;

    const item = queue.shift();
    if (!item) break;
    const k = dedupKey(item);
    if (inFlight.has(k)) continue;
    inFlight.add(k);

    try {
      // Si ya está local, saltar
      const local = await tieneCacheLocal(item.url);
      if (!local) {
        await descargarYCachear(item.url, { entity: item.entity, entityId: item.entityId });
      }
    } catch (_) {
      // continuar; reintentos los maneja el siguiente sync
    } finally {
      inFlight.delete(k);
    }
  }
  workers--;
}

function bumpWorkers() {
  while (workers < MAX_PARALLEL && queue.length > 0) {
    workers++;
    worker();
  }
}

/**
 * Encola descargas en background con paralelismo limitado.
 * items = [{ url, entity, entityId }]
 * Ignora silenciosamente URLs ya cacheadas o nulas.
 */
export function encolar(items) {
  if (!Array.isArray(items)) items = [items];
  for (const it of items) {
    if (!it?.url) continue;
    if (typeof it.url !== 'string') continue;
    if (it.url.startsWith('file://')) continue;
    queue.push(it);
  }
  bumpWorkers();
}

export function tamanoCola() {
  return queue.length + inFlight.size;
}

export function vaciarCola() {
  queue.length = 0;
}
