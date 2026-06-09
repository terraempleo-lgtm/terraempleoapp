/**
 * whatsappService.js — WhatsApp Adapter (capa de integración).
 *
 * Una sola interfaz de envío para que mañana se pueda cambiar de proveedor sin
 * reescribir el resto del módulo. Proveedor por defecto: Evolution API (self-host
 * en AWS, modo Baileys → no requiere verificación de negocio en Meta). El mismo
 * adapter soporta el modo Cloud API oficial cambiando WHATSAPP_PROVIDER.
 *
 * Si no hay credenciales configuradas, opera en MODO MOCK: registra el mensaje en
 * la BD y lo imprime por consola, para poder desarrollar/probar sin gateway vivo.
 *
 * Variables de entorno:
 *   WHATSAPP_PROVIDER   evolution | cloud | mock   (default: mock si falta config)
 *   WHATSAPP_API_URL    p.ej. http://localhost:8080   (Evolution API)
 *   WHATSAPP_API_KEY    apikey de Evolution (SecureString en SSM)
 *   WHATSAPP_INSTANCE   nombre de la instancia de Evolution (p.ej. "terraempleo")
 */

const { query } = require('../config/database');

// La config se lee en tiempo de ejecución (no al cargar el módulo) porque los
// secretos se cargan desde SSM DESPUÉS de require() en server.js.
function getConfig() {
  return {
    provider: (process.env.WHATSAPP_PROVIDER || '').toLowerCase(),
    apiUrl: (process.env.WHATSAPP_API_URL || '').replace(/\/+$/, ''),
    apiKey: process.env.WHATSAPP_API_KEY || '',
    instance: process.env.WHATSAPP_INSTANCE || 'terraempleo',
  };
}

function resolveProvider() {
  const { provider, apiUrl, apiKey } = getConfig();
  if (provider === 'mock') return 'mock';
  if (provider === 'evolution' || provider === 'cloud') {
    return (apiUrl && apiKey) ? provider : 'mock';
  }
  // Auto: si hay URL + KEY asumimos Evolution; si no, mock.
  return (apiUrl && apiKey) ? 'evolution' : 'mock';
}

/**
 * Normaliza un número a formato E.164 sin '+' (solo dígitos), asumiendo Colombia (+57)
 * cuando llega un celular local de 10 dígitos. Alinea con scripts/normalizeUserPhones.js.
 */
function normalizarTelefono(raw) {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  // Evolution suele entregar "573001234567@s.whatsapp.net" → ya viene con 57.
  if (d.length === 10 && d.startsWith('3')) d = '57' + d;       // celular CO local
  if (d.length === 12 && d.startsWith('57')) return d;          // ya internacional CO
  return d;
}

/** Registra un mensaje (inbound/outbound) en whatsapp_mensajes. Idempotente por provider_message_id. */
async function registrarMensaje({
  providerMessageId = null,
  telefono,
  usuarioId = null,
  conversacionId = null,
  direccion,
  tipo = 'texto',
  contenido = null,
  payload = null,
  estado = null,
}) {
  try {
    await query(
      `INSERT INTO whatsapp_mensajes
         (provider_message_id, telefono, usuario_id, conversacion_id, direccion, tipo, contenido, payload, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerMessageId,
        telefono,
        usuarioId,
        conversacionId,
        direccion,
        tipo,
        contenido,
        payload ? JSON.stringify(payload) : null,
        estado,
      ]
    );
    return true;
  } catch (err) {
    // Violación de UNIQUE → mensaje duplicado (idempotencia): no es un error real.
    if (err && (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message))) {
      return false;
    }
    console.error('[WhatsApp] Error registrando mensaje:', err.message);
    return true; // no bloquear el flujo por un fallo de log
  }
}

/**
 * ¿Ya procesamos este provider_message_id? Usado por el webhook para idempotencia
 * antes de actuar sobre un evento entrante.
 */
async function mensajeYaProcesado(providerMessageId) {
  if (!providerMessageId) return false;
  const rows = await query(
    'SELECT id FROM whatsapp_mensajes WHERE provider_message_id = ? LIMIT 1',
    [providerMessageId]
  ).catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

/** Envío de bajo nivel hacia el proveedor. Devuelve { ok, providerMessageId }. */
async function _enviarProveedor(telefono, texto) {
  const provider = resolveProvider();
  const { apiUrl, apiKey, instance } = getConfig();

  if (provider === 'mock') {
    console.log(`[WhatsApp:MOCK] → ${telefono}: ${texto}`);
    return { ok: true, providerMessageId: null, estado: 'mock' };
  }

  try {
    if (provider === 'evolution') {
      // Evolution API v2: POST /message/sendText/{instance}
      const res = await fetch(`${apiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: telefono, text: texto }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[WhatsApp:Evolution] Error envío:', res.status, JSON.stringify(data).slice(0, 300));
        return { ok: false, providerMessageId: null, estado: `error_${res.status}` };
      }
      const id = data?.key?.id || data?.id || null;
      return { ok: true, providerMessageId: id, estado: 'enviado' };
    }

    if (provider === 'cloud') {
      // WhatsApp Cloud API oficial: POST /{phone_number_id}/messages
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telefono,
          type: 'text',
          text: { body: texto },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[WhatsApp:Cloud] Error envío:', res.status, JSON.stringify(data).slice(0, 300));
        return { ok: false, providerMessageId: null, estado: `error_${res.status}` };
      }
      const id = data?.messages?.[0]?.id || null;
      return { ok: true, providerMessageId: id, estado: 'enviado' };
    }
  } catch (err) {
    console.error('[WhatsApp] Excepción en envío:', err.message);
    return { ok: false, providerMessageId: null, estado: 'excepcion' };
  }

  return { ok: false, providerMessageId: null, estado: 'sin_proveedor' };
}

/**
 * Envía un mensaje de texto y lo registra. Es la función pública principal.
 * @returns {Promise<{ok:boolean}>}
 */
async function enviarTexto(telefonoRaw, texto, { usuarioId = null, conversacionId = null } = {}) {
  const telefono = normalizarTelefono(telefonoRaw);
  if (!telefono) return { ok: false };

  const { ok, providerMessageId, estado } = await _enviarProveedor(telefono, texto);

  await registrarMensaje({
    providerMessageId,
    telefono,
    usuarioId,
    conversacionId,
    direccion: 'outbound',
    tipo: 'texto',
    contenido: texto,
    estado,
  });

  return { ok };
}

/**
 * Flujo 2 — Invitación de vacante a un trabajador con match, por WhatsApp.
 * Solo envía si el trabajador dio opt-in y tiene celular. Pensado para llamarse
 * en background desde ejecutarMatching().
 */
async function enviarVacanteAMatch(trabajadorId, vacante, puntaje) {
  try {
    const rows = await query(
      `SELECT id, nombre_completo, celular, whatsapp_opt_in
       FROM usuarios
       WHERE id = ? AND activo = 1 AND (baneado IS NULL OR baneado = 0)`,
      [trabajadorId]
    );
    const u = rows && rows[0];
    if (!u || !u.whatsapp_opt_in || !u.celular) return { ok: false, motivo: 'sin_opt_in_o_celular' };

    const lugar = [vacante.municipio, vacante.departamento].filter(Boolean).join(', ') || 'tu zona';
    const pago = vacante.monto_pago ? `\n💵 Pago: $${Number(vacante.monto_pago).toLocaleString('es-CO')}` : '';
    const nombre = (u.nombre_completo || '').split(' ')[0] || '';

    const texto =
      `Hola ${nombre} 👋, encontramos un trabajo que encaja con tu perfil:\n\n` +
      `🌱 *${vacante.titulo}*\n📍 ${lugar}${pago}\n\n` +
      `Responde *1* para ver más / postularte, o *2* si no te interesa.\n` +
      `(Responde *SALIR* para no recibir más mensajes.)`;

    return await enviarTexto(u.celular, texto, { usuarioId: trabajadorId });
  } catch (err) {
    console.error('[WhatsApp] enviarVacanteAMatch:', err.message);
    return { ok: false };
  }
}

/** Marca/actualiza el consentimiento del usuario para mensajes por WhatsApp. */
async function setOptIn(usuarioId, optIn) {
  await query(
    'UPDATE usuarios SET whatsapp_opt_in = ?, whatsapp_opt_in_at = ? WHERE id = ?',
    [optIn ? 1 : 0, optIn ? new Date() : null, usuarioId]
  ).catch(() => {});
}

module.exports = {
  resolveProvider,
  normalizarTelefono,
  registrarMensaje,
  mensajeYaProcesado,
  enviarTexto,
  enviarVacanteAMatch,
  setOptIn,
};
