import {
  vacantesRepo, chatsRepo, mensajesRepo,
  notificacionesRepo, postulacionesRepo,
  tombstonesRepo, outboxRepo, imageAssetsRepo,
} from './repos';
import { getSyncState, setSyncState } from './database';
import { vacantesAPI, chatsAPI, notificacionesAPI } from '../services/api';
import { refreshNetworkState, getNetworkStateSync } from '../hooks/useNetworkStatus';
import { encolar as prefetchEncolar } from '../utils/mediaPrefetcher';

// Si el backend no soporta ?since= todavía, devolverá el listado completo.
// Eso está bien: simplemente sobrescribimos el cache. Cuando el backend
// agregue soporte, esto pasará a ser incremental sin tocar el cliente.

let _syncInProgress = false;
const listeners = new Set();

export function onSyncStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(payload) {
  listeners.forEach(fn => { try { fn(payload); } catch {} });
}

async function isOnline() {
  const s = getNetworkStateSync();
  if (!s.isOnline) return false;
  // chequeo barato; si falla, asume offline
  return await refreshNetworkState();
}

// Helper: extraer items y deleted_ids del response (formato flexible)
function extractItemsAndTombstones(data, primaryKey) {
  if (!data) return { items: [], deleted: [] };
  let items = [];
  let deleted = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data[primaryKey])) items = data[primaryKey];
  else if (Array.isArray(data.items)) items = data.items;
  if (Array.isArray(data.deleted_ids)) deleted = data.deleted_ids.map(Number);
  return { items, deleted };
}

// ─── Sync individual entities ─────────────────────────────────────────────────

export async function syncVacantes({ force = false } = {}) {
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  try {
    const state = await getSyncState('vacantes');
    const since = !force && state?.last_sync_at ? state.last_sync_at : undefined;
    const res = await vacantesAPI.listar(since ? { since } : undefined);
    const { items, deleted } = extractItemsAndTombstones(res.data, 'vacantes');
    if (items.length) await vacantesRepo.upsertMany(items);
    if (deleted.length) {
      await vacantesRepo.deleteByIds(deleted);
      await tombstonesRepo.add('vacante', deleted);
    }
    // Pre-fetch foto de portada de cada vacante para verla offline luego
    prefetchEncolar(
      items
        .filter(v => v.foto_portada)
        .map(v => ({ url: v.foto_portada, entity: 'vacante', entityId: v.id }))
    );
    await setSyncState('vacantes', new Date().toISOString());
    emit({ entity: 'vacantes', count: items.length, deleted: deleted.length });
    return { ok: true, count: items.length, deleted: deleted.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function syncPostulaciones() {
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  try {
    const res = await vacantesAPI.misPostulaciones();
    const items = Array.isArray(res.data?.postulaciones)
      ? res.data.postulaciones
      : (Array.isArray(res.data) ? res.data : []);
    await postulacionesRepo.replaceAll(items);
    await setSyncState('postulaciones', new Date().toISOString());
    emit({ entity: 'postulaciones', count: items.length });
    return { ok: true, count: items.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function syncChats() {
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  try {
    const state = await getSyncState('chats');
    const since = state?.last_sync_at;
    const res = await chatsAPI.misChats(since ? { since } : undefined);
    const items = Array.isArray(res.data?.chats) ? res.data.chats : [];
    const deleted = Array.isArray(res.data?.deleted_ids) ? res.data.deleted_ids.map(Number) : [];
    if (items.length) await chatsRepo.upsertMany(items);
    if (deleted.length) {
      await chatsRepo.deleteByIds(deleted);
      await tombstonesRepo.add('chat', deleted);
    }
    // Pre-fetch avatar del otro usuario para verlo offline
    prefetchEncolar(
      items
        .filter(c => c.otro_foto)
        .map(c => ({ url: c.otro_foto, entity: 'usuario', entityId: c.otro_usuario_id || c.id }))
    );
    await setSyncState('chats', new Date().toISOString());
    emit({ entity: 'chats', count: items.length, deleted: deleted.length });
    return { ok: true, count: items.length, deleted: deleted.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function syncMensajesDeChat(chatId) {
  if (!chatId) return { ok: false, reason: 'no-chat' };
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  try {
    // Si el backend soporta ?since=, pasamos el último created_at conocido.
    const lastAt = await mensajesRepo.ultimoCreatedAtPorChat(chatId);
    const params = lastAt ? { since: lastAt } : { page: 1 };
    const { data } = await chatsAPI.getMensajes(chatId, params);
    const items = Array.isArray(data?.mensajes) ? data.mensajes : [];
    if (items.length) await mensajesRepo.upsertMany(chatId, items);
    // Pre-fetch automático de imágenes (audios on-demand)
    prefetchEncolar(
      items
        .filter(m => m.tipo === 'imagen' && m.archivo_url)
        .map(m => ({ url: m.archivo_url, entity: 'mensaje', entityId: m.id }))
    );
    return { ok: true, count: items.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function syncNotificaciones() {
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  try {
    const state = await getSyncState('notificaciones');
    const since = state?.last_sync_at;
    const res = await notificacionesAPI.listar(since ? { since } : undefined);
    const items = Array.isArray(res.data?.notificaciones) ? res.data.notificaciones
                 : Array.isArray(res.data) ? res.data : [];
    if (items.length) await notificacionesRepo.upsertMany(items);
    await setSyncState('notificaciones', new Date().toISOString());
    emit({ entity: 'notificaciones', count: items.length });
    return { ok: true, count: items.length };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ─── Outbox: procesa operaciones pendientes ───────────────────────────────────
export async function flushOutbox() {
  if (!(await isOnline())) return { ok: false, reason: 'offline' };
  const pending = await outboxRepo.list();
  let success = 0, failed = 0;
  for (const op of pending) {
    try {
      await ejecutarOperacionOutbox(op);
      await outboxRepo.remove(op.id);
      success++;
    } catch (e) {
      await outboxRepo.markError(op.id, e?.message || String(e));
      failed++;
    }
  }
  if (success > 0) emit({ entity: 'outbox', synced: success, failed });
  return { ok: true, success, failed };
}

async function ejecutarOperacionOutbox(op) {
  const { type, payload } = op;
  if (type === 'postulacion') {
    await vacantesAPI.postularse(payload);
  } else if (type === 'mensaje_texto') {
    await chatsAPI.enviarMensaje(payload.chatId, payload.mensaje);
  } else if (type === 'mensaje_media') {
    const { chatId, tipo, localPath, duracion } = payload;
    const res = await chatsAPI.enviarMedia(chatId, localPath, tipo, duracion);
    // Tras subir con éxito, persistir el mensaje "real" del servidor en SQLite
    // y limpiar el archivo del outbox del FileSystem.
    try {
      const { mensajesRepo } = require('./repos');
      if (res?.data?.mensaje) await mensajesRepo.upsertMany(chatId, [res.data.mensaje]);
    } catch (_) {}
    try {
      const { borrarOutboxFile } = require('../utils/mediaCache');
      await borrarOutboxFile(localPath);
    } catch (_) {}
  } else if (type === 'marcar_leida_notificacion') {
    await notificacionesAPI.marcarLeida(payload.id);
  } else {
    // tipo desconocido: lo dejamos en outbox para inspección manual
    throw new Error(`Tipo outbox desconocido: ${type}`);
  }
}

// ─── Sync orquestado (todo a la vez) ──────────────────────────────────────────
export async function syncAll({ force = false } = {}) {
  if (_syncInProgress) return { ok: false, reason: 'in-progress' };
  _syncInProgress = true;
  emit({ phase: 'start' });
  try {
    // primero limpiamos lo pendiente que el usuario hizo offline
    await flushOutbox();
    // luego bajamos datos del servidor en paralelo
    const results = await Promise.all([
      syncVacantes({ force }),
      syncPostulaciones(),
      syncChats(),
      syncNotificaciones(),
    ]);
    // procesar tombstones (limpieza de imágenes locales si las hubiera)
    try {
      const { procesarTombstones } = require('./cleanup');
      await procesarTombstones();
    } catch (_) {}
    emit({ phase: 'end', results });
    return { ok: true, results };
  } finally {
    _syncInProgress = false;
  }
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────
export const syncRepos = {
  vacantesRepo, chatsRepo, mensajesRepo,
  notificacionesRepo, postulacionesRepo,
  tombstonesRepo, outboxRepo, imageAssetsRepo,
};
