// Stub web de database.js — SQLite no se usa en web.
// Metro carga este archivo automáticamente cuando se hace bundle para platform "web".
// Todas las funciones devuelven valores no-op para que el resto del código (repos,
// sync, screens) funcione sin romper. Las pantallas web pueden seguir consultando
// al servidor directamente cuando no hay cache local.

export async function getDb() { return null; }
export function isDbReady() { return false; }
export async function withTx(fn) { return await fn(null); }
export async function setSyncState() {}
export async function getSyncState() { return null; }
export async function setMeta() {}
export async function getMeta() { return null; }
export async function clearAll() {}
