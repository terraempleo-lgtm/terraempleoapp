import { Platform } from 'react-native';

const DB_NAME = 'terraempleo_offline.db';
const SCHEMA_VERSION = 1;

let _dbPromise = null;
let _ready = false;

// En web SQLite no funciona; expo-sqlite v16 lo soporta vía WASM pero requiere
// setup adicional. Para evitar que el bundler web intente resolver el módulo,
// hacemos require LAZY dentro de getDb() — solo se evalúa en native.
function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function migrate(db) {
  // PRAGMAs para mejor performance / FKs
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      entity TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL,
      last_remote_updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS vacantes (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mensajes_chat_created
      ON mensajes (chat_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notif_created
      ON notificaciones (created_at DESC);
    CREATE TABLE IF NOT EXISTS postulaciones (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT,
      cached_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tombstones (
      entity TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      deleted_at TEXT NOT NULL,
      PRIMARY KEY (entity, entity_id)
    );
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS image_assets (
      url TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      entity TEXT,
      entity_id INTEGER,
      cached_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_image_entity
      ON image_assets (entity, entity_id);
  `);

  // Versioning
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', ['schema_version']);
  if (!row) {
    await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?)', ['schema_version', String(SCHEMA_VERSION)]);
  }
}

export async function getDb() {
  if (!isSupported()) return null;
  if (_dbPromise) return _dbPromise;
  // require lazy: solo se evalúa en native, NO en el bundle web.
  // eslint-disable-next-line global-require
  const SQLite = require('expo-sqlite');
  _dbPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await migrate(db);
    _ready = true;
    return db;
  })();
  return _dbPromise;
}

export function isDbReady() {
  return _ready;
}

// Helper: ejecutar bloque dentro de una transacción
export async function withTx(fn) {
  const db = await getDb();
  if (!db) return await fn(null);
  let result;
  await db.withTransactionAsync(async () => { result = await fn(db); });
  return result;
}

// Helpers genéricos
export async function setSyncState(entity, lastSyncAt, lastRemoteUpdatedAt = null) {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO sync_state (entity, last_sync_at, last_remote_updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(entity) DO UPDATE SET last_sync_at = excluded.last_sync_at,
       last_remote_updated_at = COALESCE(excluded.last_remote_updated_at, last_remote_updated_at)`,
    [entity, lastSyncAt, lastRemoteUpdatedAt]
  );
}

export async function getSyncState(entity) {
  const db = await getDb();
  if (!db) return null;
  return await db.getFirstAsync('SELECT * FROM sync_state WHERE entity = ?', [entity]);
}

export async function setMeta(key, value) {
  const db = await getDb();
  if (!db) return;
  await db.runAsync(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

export async function getMeta(key) {
  const db = await getDb();
  if (!db) return null;
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

// Borra todo. Útil al hacer signOut para no mezclar datos de cuentas.
export async function clearAll() {
  const db = await getDb();
  if (!db) return;
  await db.execAsync(`
    DELETE FROM vacantes;
    DELETE FROM chats;
    DELETE FROM mensajes;
    DELETE FROM notificaciones;
    DELETE FROM postulaciones;
    DELETE FROM tombstones;
    DELETE FROM outbox;
    DELETE FROM image_assets;
    DELETE FROM sync_state;
  `);
}
