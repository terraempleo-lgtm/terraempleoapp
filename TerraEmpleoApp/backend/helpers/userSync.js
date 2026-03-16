/**
 * helpers/userSync.js
 *
 * Funciones de sincronización entre Cognito y la BD local (RDS MariaDB).
 * Reutiliza la conexión existente via config/database.js (pool mariadb).
 */

const { query } = require('../config/database');
const { normalizePhone } = require('./normalizePhone');

/**
 * Extrae el número nacional de 10 dígitos desde cualquier formato.
 * "+573136158742" → "3136158742", "573136158742" → "3136158742"
 */
function extractNational(phone) {
  const digits = (phone || '').replace(/[^\d]/g, '');
  if (digits.length === 12 && digits.startsWith('57')) return digits.slice(2);
  if (digits.length === 10 && digits.startsWith('3')) return digits;
  return null;
}

/**
 * Busca un usuario activo en la BD local por número de celular.
 * Intenta: E.164, valor limpio original, y número nacional de 10 dígitos.
 *
 * @param {string} phone — Número en cualquier formato.
 * @returns {object|null} — Fila completa del usuario o null.
 */
async function findUserByNormalizedPhone(phone) {
  const normalized = normalizePhone(phone);

  // 1. Buscar con formato E.164 (+57XXXXXXXXXX)
  if (normalized) {
    const rows = await query(
      'SELECT * FROM usuarios WHERE celular = ? AND activo = 1 AND eliminado = 0',
      [normalized]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  // 2. Fallback: valor original limpio (sin espacios/guiones)
  const cleaned = (phone || '').replace(/[\s\-\(\)\.]/g, '');
  if (cleaned && cleaned !== normalized) {
    const rows = await query(
      'SELECT * FROM usuarios WHERE celular = ? AND activo = 1 AND eliminado = 0',
      [cleaned]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  // 3. Fallback: número nacional 10 dígitos (BD legacy sin +57)
  const national = extractNational(phone);
  if (national && national !== normalized && national !== cleaned) {
    const rows = await query(
      'SELECT * FROM usuarios WHERE celular = ? AND activo = 1 AND eliminado = 0',
      [national]
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

  const national = extractNational(phone);
  if (national && national !== normalized && national !== cleaned) {
    const rows = await query('SELECT * FROM usuarios WHERE celular = ?', [national]);
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

  const national = extractNational(phone);
  if (national && national !== normalized && national !== cleaned) {
    const result = await query(
      'UPDATE usuarios SET verificado_sms = 1, codigo_sms = NULL WHERE celular = ?',
      [national]
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
