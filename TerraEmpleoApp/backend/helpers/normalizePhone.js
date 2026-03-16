/**
 * Normaliza un número de teléfono colombiano al formato E.164 (+57XXXXXXXXXX).
 *
 * - Elimina espacios y guiones.
 * - Si ya empieza por '+', lo deja igual.
 * - Si empieza por '57' (sin '+'), agrega '+'.
 * - Si viene solo como '3001234567' (10 dígitos), lo convierte a '+573001234567'.
 *
 * @param {string} phone
 * @returns {string} Número en formato E.164
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('El número de teléfono es obligatorio');
  }

  // Quitar espacios y guiones
  let cleaned = phone.replace(/[\s\-]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  if (cleaned.startsWith('57')) {
    return `+${cleaned}`;
  }

  // Asumir número colombiano sin prefijo (ej: 3001234567)
  return `+57${cleaned}`;
}

module.exports = { normalizePhone };
