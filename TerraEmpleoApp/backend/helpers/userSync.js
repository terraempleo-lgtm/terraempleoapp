/**
 * helpers/userSync.js
 *
 * Funciones de sincronización entre Cognito y la BD local (RDS MariaDB).
 * Reutiliza la conexión existente via config/database.js (pool mariadb).
 */

const { query } = require('../config/database');
const { normalizePhone } = require('./normalizePhone');

/**
 * Busca un usuario activo en la BD local por número de celular normalizado E.164.
 * Intenta con el número normalizado; si no lo encuentra, prueba con el valor original
 * por si la BD aún tiene números sin normalizar (compatibilidad durante migración).
 *
 * @param {string} phone — Número en cualquier formato.
 * @returns {object|null} — Fila completa del usuario o null.
 */
async function findUserByNormalizedPhone(phone) {
  const normalized = normalizePhone(phone);

  // Buscar primero con el formato normalizado E.164
  if (normalized) {
    const rows = await query(
      'SELECT * FROM usuarios WHERE celular = ? AND activo = 1 AND eliminado = 0',
      [normalized]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  // Fallback: buscar con el valor original limpio (sin espacios/guiones)
  // Esto cubre el caso de números aún no migrados a E.164 en la BD
  const cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
  if (cleaned && cleaned !== normalized) {
    const rows = await query(
      'SELECT * FROM usuarios WHERE celular = ? AND activo = 1 AND eliminado = 0',
      [cleaned]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  return null;
}

/**
 * Busca un usuario por celular normalizado SIN filtrar por activo/eliminado.
 * Útil para detectar duplicados al registrar.
 *
 * @param {string} phone
 * @returns {object|null}
 */
async function findAnyUserByPhone(phone) {
  const normalized = normalizePhone(phone);

  if (normalized) {
    const rows = await query('SELECT * FROM usuarios WHERE celular = ?', [normalized]);
    if (rows && rows.length > 0) return rows[0];
  }

  const cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
  if (cleaned && cleaned !== normalized) {
    const rows = await query('SELECT * FROM usuarios WHERE celular = ?', [cleaned]);
    if (rows && rows.length > 0) return rows[0];
  }

  return null;
}

/**
 * Marca verificado_sms = 1 para un usuario identificado por celular normalizado.
 * Busca tanto con formato E.164 como con el valor legacy.
 *
 * @param {string} phone
 * @returns {boolean} true si se actualizó algún registro.
 */
async function markPhoneVerified(phone) {
  const normalized = normalizePhone(phone);

  if (normalized) {
    const result = await query(
      'UPDATE usuarios SET verificado_sms = 1, codigo_sms = NULL WHERE celular = ?',
      [normalized]
    );
    if (result && result.affectedRows > 0) return true;
  }

  // Fallback legacy
  const cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
  if (cleaned && cleaned !== normalized) {
    const result = await query(
      'UPDATE usuarios SET verificado_sms = 1, codigo_sms = NULL WHERE celular = ?',
      [cleaned]
    );
    if (result && result.affectedRows > 0) return true;
  }

  return false;
}

module.exports = {
  findUserByNormalizedPhone,
  findAnyUserByPhone,
  markPhoneVerified,
};
