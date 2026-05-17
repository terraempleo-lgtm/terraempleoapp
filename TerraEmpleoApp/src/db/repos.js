import { getDb, withTx } from './database';

// ─── Generic helpers ──────────────────────────────────────────────────────────
function nowIso() { return new Date().toISOString(); }
function safeStr(v) { return v == null ? null : String(v); }
function parseRow(row) {
  if (!row) return null;
  try { return JSON.parse(row.data); } catch { return null; }
}
function parseRows(rows) {
  return (rows || []).map(parseRow).filter(Boolean);
}

// ─── Vacantes ─────────────────────────────────────────────────────────────────
export const vacantesRepo = {
  async upsertMany(vacantes) {
    if (!Array.isArray(vacantes) || vacantes.length === 0) return;
    await withTx(async (db) => {
      if (!db) return;
      const cachedAt = nowIso();
      for (const v of vacantes) {
        if (!v?.id) continue;
        await db.runAsync(
          `INSERT INTO vacantes (id, data, updated_at, cached_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data = excluded.data,
             updated_at = excluded.updated_at,
             cached_at = excluded.cached_at`,
          [v.id, JSON.stringify(v), safeStr(v.updated_at), cachedAt]
        );
      }
    });
  },
  async listar(params = {}) {
    const db = await getDb();
    if (!db) return [];
    const where = [];
    const args = [];
    if (params.departamento) { where.push("json_extract(data, '$.departamento') = ?"); args.push(params.departamento); }
    if (params.estado) { where.push("json_extract(data, '$.estado') = ?"); args.push(params.estado); }
    const sql = `SELECT data FROM vacantes ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY COALESCE(updated_at, cached_at) DESC`;
    const rows = await db.getAllAsync(sql, args);
    return parseRows(rows);
  },
  async getById(id) {
    const db = await getDb();
    if (!db) return null;
    const row = await db.getFirstAsync('SELECT data FROM vacantes WHERE id = ?', [id]);
    return parseRow(row);
  },
  async deleteByIds(ids) {
    if (!ids?.length) return;
    const db = await getDb();
    if (!db) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM vacantes WHERE id IN (${placeholders})`, ids);
  },
};

// ─── Chats ────────────────────────────────────────────────────────────────────
export const chatsRepo = {
  async upsertMany(chats) {
    if (!Array.isArray(chats) || chats.length === 0) return;
    await withTx(async (db) => {
      if (!db) return;
      const cachedAt = nowIso();
      for (const c of chats) {
        if (!c?.id) continue;
        await db.runAsync(
          `INSERT INTO chats (id, data, updated_at, cached_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data = excluded.data,
             updated_at = excluded.updated_at,
             cached_at = excluded.cached_at`,
          [c.id, JSON.stringify(c), safeStr(c.ultimo_mensaje_at || c.updated_at), cachedAt]
        );
      }
    });
  },
  async listar() {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT data FROM chats ORDER BY COALESCE(updated_at, cached_at) DESC`
    );
    return parseRows(rows);
  },
  async getById(id) {
    const db = await getDb();
    if (!db) return null;
    const row = await db.getFirstAsync('SELECT data FROM chats WHERE id = ?', [id]);
    return parseRow(row);
  },
  async deleteByIds(ids) {
    if (!ids?.length) return;
    const db = await getDb();
    if (!db) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM chats WHERE id IN (${placeholders})`, ids);
    await db.runAsync(`DELETE FROM mensajes WHERE chat_id IN (${placeholders})`, ids);
  },
};

// ─── Mensajes ─────────────────────────────────────────────────────────────────
export const mensajesRepo = {
  async upsertMany(chatId, mensajes) {
    if (!Array.isArray(mensajes) || mensajes.length === 0) return;
    await withTx(async (db) => {
      if (!db) return;
      const cachedAt = nowIso();
      for (const m of mensajes) {
        if (!m?.id) continue;
        await db.runAsync(
          `INSERT INTO mensajes (id, chat_id, data, created_at, cached_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data = excluded.data,
             cached_at = excluded.cached_at`,
          [m.id, chatId, JSON.stringify(m), safeStr(m.created_at), cachedAt]
        );
      }
    });
  },
  async listarPorChat(chatId, limit = 200) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT data FROM mensajes WHERE chat_id = ? ORDER BY COALESCE(created_at, cached_at) ASC LIMIT ?`,
      [chatId, limit]
    );
    return parseRows(rows);
  },
  async ultimoCreatedAtPorChat(chatId) {
    const db = await getDb();
    if (!db) return null;
    const row = await db.getFirstAsync(
      `SELECT MAX(created_at) AS max_at FROM mensajes WHERE chat_id = ?`,
      [chatId]
    );
    return row?.max_at || null;
  },
};

// ─── Notificaciones ───────────────────────────────────────────────────────────
export const notificacionesRepo = {
  async upsertMany(notifs) {
    if (!Array.isArray(notifs) || notifs.length === 0) return;
    await withTx(async (db) => {
      if (!db) return;
      const cachedAt = nowIso();
      for (const n of notifs) {
        if (!n?.id) continue;
        await db.runAsync(
          `INSERT INTO notificaciones (id, data, created_at, cached_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data = excluded.data,
             cached_at = excluded.cached_at`,
          [n.id, JSON.stringify(n), safeStr(n.created_at), cachedAt]
        );
      }
    });
  },
  async listar(limit = 100) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT data FROM notificaciones ORDER BY COALESCE(created_at, cached_at) DESC LIMIT ?`,
      [limit]
    );
    return parseRows(rows);
  },
};

// ─── Postulaciones (las del trabajador) ───────────────────────────────────────
export const postulacionesRepo = {
  async replaceAll(items) {
    const db = await getDb();
    if (!db) return;
    await withTx(async () => {
      await db.runAsync('DELETE FROM postulaciones');
      const cachedAt = nowIso();
      for (const p of (items || [])) {
        if (!p?.id) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO postulaciones (id, data, updated_at, cached_at) VALUES (?, ?, ?, ?)`,
          [p.id, JSON.stringify(p), safeStr(p.updated_at || p.fecha_postulacion), cachedAt]
        );
      }
    });
  },
  async listar() {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT data FROM postulaciones ORDER BY COALESCE(updated_at, cached_at) DESC`
    );
    return parseRows(rows);
  },
};

// ─── Tombstones (IDs eliminados remotamente) ──────────────────────────────────
export const tombstonesRepo = {
  async add(entity, ids) {
    if (!ids?.length) return;
    const db = await getDb();
    if (!db) return;
    const deletedAt = nowIso();
    await withTx(async () => {
      for (const id of ids) {
        await db.runAsync(
          `INSERT INTO tombstones (entity, entity_id, deleted_at) VALUES (?, ?, ?)
           ON CONFLICT(entity, entity_id) DO UPDATE SET deleted_at = excluded.deleted_at`,
          [entity, id, deletedAt]
        );
      }
    });
  },
  async listByEntity(entity) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      'SELECT entity_id, deleted_at FROM tombstones WHERE entity = ?', [entity]
    );
    return rows || [];
  },
};

// ─── Outbox (operaciones pendientes mientras offline) ─────────────────────────
export const outboxRepo = {
  async push(type, payload) {
    const db = await getDb();
    if (!db) return null;
    const r = await db.runAsync(
      `INSERT INTO outbox (type, payload, created_at) VALUES (?, ?, ?)`,
      [type, JSON.stringify(payload || {}), nowIso()]
    );
    return r?.lastInsertRowId || null;
  },
  async list() {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      `SELECT id, type, payload, created_at, retries, last_error
       FROM outbox ORDER BY id ASC`
    );
    return (rows || []).map(r => ({
      ...r,
      payload: (() => { try { return JSON.parse(r.payload); } catch { return {}; } })(),
    }));
  },
  async remove(id) {
    const db = await getDb();
    if (!db) return;
    await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [id]);
  },
  async markError(id, error) {
    const db = await getDb();
    if (!db) return;
    await db.runAsync(
      `UPDATE outbox SET retries = retries + 1, last_error = ? WHERE id = ?`,
      [String(error).slice(0, 500), id]
    );
  },
  async count() {
    const db = await getDb();
    if (!db) return 0;
    const row = await db.getFirstAsync('SELECT COUNT(*) AS c FROM outbox');
    return row?.c || 0;
  },
};

// ─── Image assets (urls -> local paths) ───────────────────────────────────────
export const imageAssetsRepo = {
  async upsert(url, localPath, entity = null, entityId = null) {
    const db = await getDb();
    if (!db) return;
    await db.runAsync(
      `INSERT INTO image_assets (url, local_path, entity, entity_id, cached_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         local_path = excluded.local_path,
         entity = excluded.entity,
         entity_id = excluded.entity_id,
         cached_at = excluded.cached_at`,
      [url, localPath, entity, entityId, nowIso()]
    );
  },
  async getLocalPath(url) {
    const db = await getDb();
    if (!db) return null;
    const row = await db.getFirstAsync('SELECT local_path FROM image_assets WHERE url = ?', [url]);
    return row?.local_path || null;
  },
  async listByEntity(entity, entityId) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.getAllAsync(
      'SELECT url, local_path FROM image_assets WHERE entity = ? AND entity_id = ?',
      [entity, entityId]
    );
    return rows || [];
  },
  async deleteByEntity(entity, entityId) {
    const db = await getDb();
    if (!db) return [];
    const rows = await this.listByEntity(entity, entityId);
    await db.runAsync(
      'DELETE FROM image_assets WHERE entity = ? AND entity_id = ?',
      [entity, entityId]
    );
    return rows; // devolver para que el caller borre del FileSystem
  },
};
