/**
 * Normaliza un número de teléfono colombiano al formato E.164 (+57XXXXXXXXXX).
 *
 * Maneja entradas como:
 *   "3001234567"         → "+573001234567"
 *   "57 3001234567"      → "+573001234567"
 *   "+57 300 123 4567"   → "+573001234567"
 *   "300-123-4567"       → "+573001234567"
 *   "(300) 123 4567"     → "+573001234567"
 *
 * Validaciones:
 *   - Elimina espacios, guiones, paréntesis, puntos y caracteres no numéricos (excepto + inicial).
 *   - Si empieza por +57 y tiene 10 dígitos nacionales → OK.
 *   - Si empieza por 57 sin + y tiene 12 dígitos totales → agrega +.
 *   - Si tiene 10 dígitos y empieza por 3 (móvil colombiano) → +57XXXXXXXXXX.
 *   - Si no se puede normalizar de forma segura, devuelve null.
 *
 * @param {string} phone
 * @returns {string|null} Número E.164 o null si no es normalizable.
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  // Preservar + inicial, luego limpiar todo lo que no sea dígito
  const hadPlus = phone.trimStart().startsWith('+');
  const digits = phone.replace(/[^\d]/g, '');

  if (!digits || digits.length === 0) {
    return null;
  }

  // Caso 1: Tenía +, esperamos +57 + 10 dígitos nacionales = 12 dígitos
  if (hadPlus) {
    if (digits.startsWith('57') && digits.length === 12) {
      const national = digits.slice(2);
      if (isColombianMobile(national)) {
        return `+${digits}`;
      }
    }
    // Tenía + pero no matchea patrón colombiano → no normalizable con seguridad
    return null;
  }

  // Caso 2: Empieza por 57 y tiene 12 dígitos (ej: "573001234567")
  if (digits.startsWith('57') && digits.length === 12) {
    const national = digits.slice(2);
    if (isColombianMobile(national)) {
      return `+${digits}`;
    }
    return null;
  }

  // Caso 3: 10 dígitos, empieza por 3 → móvil colombiano
  if (digits.length === 10 && isColombianMobile(digits)) {
    return `+57${digits}`;
  }

  // No se puede normalizar de forma segura
  return null;
}

/**
 * Verifica si un string de 10 dígitos parece un número móvil colombiano.
 * Los móviles en Colombia empiezan por 3 (300-399).
 */
function isColombianMobile(tenDigits) {
  return tenDigits.length === 10 && tenDigits.startsWith('3');
}

/**
 * Igual que normalizePhone pero lanza error en vez de devolver null.
 * Para uso en endpoints donde el teléfono es obligatorio.
 */
function normalizePhoneOrFail(phone) {
  const result = normalizePhone(phone);
  if (!result) {
    throw new Error(
      `No se pudo normalizar el número "${phone}" al formato E.164 colombiano (+57XXXXXXXXXX).`
    );
  }
  return result;
}

module.exports = { normalizePhone, normalizePhoneOrFail, isColombianMobile };
