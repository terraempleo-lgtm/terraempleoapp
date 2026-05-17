import * as FileSystem from 'expo-file-system';
import { Image as ExpoImage } from 'expo-image';
import { tombstonesRepo, imageAssetsRepo, mensajesRepo } from './repos';
import { getDb } from './database';
import { borrarPorEntidad, MEDIA_PATHS } from '../utils/mediaCache';

/**
 * Borra del dispositivo todo el contenido asociado a una entidad eliminada:
 * - Archivos físicos del media_cache asociados (imágenes, audios)
 * - Mensajes huérfanos cuando se borra un chat
 * - Registros en SQLite (image_assets, mensajes)
 */
export async function limpiarEntidad(entity, entityId) {
  // 1) Archivos físicos + image_assets vía mediaCache.borrarPorEntidad
  try { await borrarPorEntidad(entity, entityId); } catch (_) {}

  // 2) Limpieza específica por tipo
  if (entity === 'chat') {
    // Borrar mensajes y sus medias asociados
    try {
      const db = await getDb();
      if (db) {
        const msgs = await db.getAllAsync('SELECT id FROM mensajes WHERE chat_id = ?', [entityId]);
        for (const m of (msgs || [])) {
          await borrarPorEntidad('mensaje', m.id);
        }
        await db.runAsync('DELETE FROM mensajes WHERE chat_id = ?', [entityId]);
      }
    } catch (_) {}
    // Borrar carpeta del chat completa
    try {
      await FileSystem.deleteAsync(`${MEDIA_PATHS.ROOT}chat/${entityId}/`, { idempotent: true });
    } catch (_) {}
  }
}

/**
 * Procesa todas las tombstones acumuladas y aplica la limpieza.
 * El sync ya borra los registros principales (vacantes, chats, etc.);
 * aquí nos enfocamos en los assets físicos asociados.
 */
export async function procesarTombstones() {
  const entidades = ['vacante', 'chat', 'mensaje'];
  for (const e of entidades) {
    const ts = await tombstonesRepo.listByEntity(e);
    for (const t of ts) {
      await limpiarEntidad(e, t.entity_id);
    }
  }
}

/**
 * Borra el cache de imágenes en disco de expo-image cuando ha pasado mucho
 * tiempo (semanal) o cuando el usuario libera espacio. Esto es agresivo:
 * las imágenes se vuelven a descargar al pedirlas. Útil cuando una vacante
 * eliminada deja su foto huérfana en el cache de expo-image (al cual no
 * tenemos acceso por URL individual).
 */
export async function limpiarCacheImagenesViejo({ maxDias = 30 } = {}) {
  const db = await getDb();
  if (!db) return;
  const limite = new Date(Date.now() - maxDias * 24 * 60 * 60 * 1000).toISOString();
  const viejos = await db.getAllAsync(
    'SELECT url, local_path FROM image_assets WHERE cached_at < ?',
    [limite]
  );
  for (const r of (viejos || [])) {
    try { await FileSystem.deleteAsync(r.local_path, { idempotent: true }); } catch (_) {}
  }
  await db.runAsync('DELETE FROM image_assets WHERE cached_at < ?', [limite]);
}

/**
 * Vacía completamente el cache en disco de expo-image. Llámese rara vez
 * (ej. una vez al mes o al ejecutar "Liberar espacio" desde Perfil).
 */
export async function vaciarCacheImagenes() {
  try {
    await ExpoImage.clearDiskCache();
    await ExpoImage.clearMemoryCache();
  } catch (_) {}
}
