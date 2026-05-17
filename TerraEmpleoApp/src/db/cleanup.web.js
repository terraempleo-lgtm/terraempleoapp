// Stub web de cleanup.js — sin acceso a FileSystem ni a SQLite, todo no-op.

export async function limpiarEntidad() {}
export async function procesarTombstones() {}
export async function limpiarCacheImagenesViejo() {}
export async function vaciarCacheImagenes() {
  try {
    const { Image } = require('expo-image');
    await Image.clearMemoryCache();
    await Image.clearDiskCache();
  } catch (_) {}
}
