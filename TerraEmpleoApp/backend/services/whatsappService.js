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
async function enviarTexto(destinoRaw, texto, { usuarioId = null, conversacionId = null } = {}) {
  // Si llega un JID completo (p. ej. "...@lid" o "...@s.whatsapp.net"), se responde
  // a ESE JID exacto. WhatsApp entrega el remitente como @lid en muchos casos y hay
  // que contestar al mismo identificador, no a un número normalizado.
  const esJid = typeof destinoRaw === 'string' && destinoRaw.includes('@');
  const destino = esJid ? destinoRaw : normalizarTelefono(destinoRaw);
  if (!destino) return { ok: false };
  const telefonoLog = esJid ? destinoRaw.split('@')[0].split(':')[0] : destino;

  const { ok, providerMessageId, estado } = await _enviarProveedor(destino, texto);

  await registrarMensaje({
    providerMessageId,
    telefono: telefonoLog,
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
/** Link a la vacante (abre la app si está instalada — ver app.json; si no, la web). */
function linkVacante(id) {
  return `https://app.terrampleo.com/app/vacantes/${id}`;
}

/**
 * Línea "📅 …" con la fecha (dd/mm) y hora de la jornada, si existen. Defensivo ante
 * DATE de MySQL (Date o 'YYYY-MM-DD'). Devuelve '' si no hay fecha ni hora.
 */
function formatCuando(fechaJornada, horaJornada) {
  let fechaTxt = '';
  if (fechaJornada) {
    const iso = fechaJornada instanceof Date ? fechaJornada.toISOString().slice(0, 10) : String(fechaJornada).slice(0, 10);
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) fechaTxt = `${m[3]}/${m[2]}`;
  }
  const horaTxt = horaJornada ? String(horaJornada).trim() : '';
  if (!fechaTxt && !horaTxt) return '';
  return `\n📅 ${[fechaTxt, horaTxt].filter(Boolean).join(' · ')}`;
}

/**
 * Mejor destino de WhatsApp para un usuario: el JID exacto con el que escribió
 * (whatsapp_identidades, entrega segura incluso con @lid); si no, su celular.
 */
async function mejorDestino(usuarioId) {
  const idr = await query(
    'SELECT jid FROM whatsapp_identidades WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 1',
    [usuarioId]
  ).catch(() => []);
  if (idr && idr[0] && idr[0].jid) return idr[0].jid;
  const u = await query('SELECT celular FROM usuarios WHERE id = ?', [usuarioId]).catch(() => []);
  return u && u[0] && u[0].celular ? u[0].celular : null;
}

/** Avisa al empleador (opt-in) que su vacante tiene N trabajadores que encajan → a la app. */
async function notificarEmpleadorMatches(empleadorId, vacante, n) {
  try {
    if (!n || n < 1) return { ok: false };
    const rows = await query(
      'SELECT whatsapp_opt_in FROM usuarios WHERE id = ? AND activo = 1',
      [empleadorId]
    ).catch(() => []);
    if (!rows[0] || !rows[0].whatsapp_opt_in) return { ok: false, motivo: 'sin_opt_in' };
    const destino = await mejorDestino(empleadorId);
    if (!destino) return { ok: false };
    const texto =
      `🌱 Tu vacante *${vacante.titulo}* ya tiene *${n}* trabajador(es) que encajan con lo que pediste.\n\n` +
      `👀 Míralos y contáctalos en la app 👉 ${linkVacante(vacante.id || vacante.vacanteId || '')}`;
    return await enviarTexto(destino, texto, { usuarioId: empleadorId });
  } catch (err) {
    console.error('[WhatsApp] notificarEmpleadorMatches:', err.message);
    return { ok: false };
  }
}

async function enviarVacanteAMatch(trabajadorId, vacante, puntaje) {
  try {
    const rows = await query(
      `SELECT id, nombre_completo, celular, whatsapp_opt_in
       FROM usuarios
       WHERE id = ? AND activo = 1 AND (baneado IS NULL OR baneado = 0)`,
      [trabajadorId]
    );
    const u = rows && rows[0];
    if (!u || !u.whatsapp_opt_in) return { ok: false, motivo: 'sin_opt_in' };
    const destino = await mejorDestino(trabajadorId);
    if (!destino) return { ok: false, motivo: 'sin_destino' };

    const lugar = [vacante.municipio, vacante.departamento].filter(Boolean).join(', ') || 'tu zona';
    const pago = vacante.monto_pago ? `\n💵 Pago: $${Number(vacante.monto_pago).toLocaleString('es-CO')}` : '';
    const cuando = formatCuando(vacante.fecha_jornada, vacante.hora_jornada);
    // Cupos disponibles (si la vacante tiene cupos definidos).
    let cuposLinea = '';
    if (vacante.cupos != null) {
      const oc = await query(
        `SELECT COUNT(*) AS n FROM postulaciones WHERE vacante_id = ? AND estado = 'aceptada'
           AND (no_asistira IS NULL OR no_asistira = 0) AND (en_lista_espera IS NULL OR en_lista_espera = 0)`,
        [vacante.id]
      ).catch(() => []);
      const disp = Math.max(0, Number(vacante.cupos) - Number((oc && oc[0] && oc[0].n) || 0));
      cuposLinea = `\n👥 Cupos disponibles: ${disp}`;
    }
    const nombre = (u.nombre_completo || '').split(' ')[0] || '';

    const texto =
      `Hola ${nombre} 👋, ¡hay un trabajo que encaja con tu perfil!\n\n` +
      `🌱 *${vacante.titulo}*\n📍 ${lugar}${cuando}${pago}${cuposLinea}\n\n` +
      `¿Te interesa?\n` +
      `• Responde *SÍ* para aplicar ✅\n` +
      `• Responde *NO* si no puedes\n\n` +
      `Más detalles en la app 👉 ${linkVacante(vacante.id)}\n` +
      `(Responde *SALIR* para no recibir más mensajes.)`;

    return await enviarTexto(destino, texto, { usuarioId: trabajadorId });
  } catch (err) {
    console.error('[WhatsApp] enviarVacanteAMatch:', err.message);
    return { ok: false };
  }
}

/**
 * Envía una imagen con caption (texto). `mediaUrl` puede ser una URL accesible
 * (p. ej. URL firmada de S3) que el proveedor descarga, o base64.
 * @returns {Promise<{ok:boolean}>}
 */
async function enviarImagen(destinoRaw, mediaUrl, caption, { usuarioId = null } = {}) {
  const { apiUrl, apiKey, instance } = getConfig();
  const esJid = typeof destinoRaw === 'string' && destinoRaw.includes('@');
  const destino = esJid ? destinoRaw : normalizarTelefono(destinoRaw);
  if (!destino || !mediaUrl) return { ok: false };

  if (resolveProvider() === 'mock' || !apiUrl || !apiKey) {
    console.log(`[WhatsApp:MOCK] 🖼️ → ${destino}: ${(caption || '').slice(0, 60)}…`);
    return { ok: true };
  }
  try {
    const res = await fetch(`${apiUrl}/message/sendMedia/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: destino, mediatype: 'image', media: mediaUrl, caption, fileName: 'vacante.jpg' }),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok;
    await registrarMensaje({
      providerMessageId: data?.key?.id || null,
      telefono: esJid ? destinoRaw.split('@')[0].split(':')[0] : destino,
      usuarioId, direccion: 'outbound', tipo: 'imagen', contenido: caption,
      estado: ok ? 'enviado' : `error_${res.status}`,
    });
    if (!ok) console.error('[WhatsApp] sendMedia error:', res.status, JSON.stringify(data).slice(0, 200));
    return { ok };
  } catch (err) {
    console.error('[WhatsApp] enviarImagen error:', err.message);
    return { ok: false };
  }
}

/**
 * Descarga el contenido (imagen) de un mensaje de WhatsApp desde Evolution.
 * @param {object} messageKey  la `key` del mensaje entrante (remoteJid, id, ...)
 * @returns {Promise<{buffer: Buffer, mimetype: string}|null>}
 */
async function descargarMedia(messageKey) {
  const { apiUrl, apiKey, instance } = getConfig();
  if (!apiUrl || !apiKey || !messageKey) return null;
  try {
    const res = await fetch(`${apiUrl}/chat/getBase64FromMediaMessage/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.base64) {
      console.error('[WhatsApp] descargarMedia falló:', res.status);
      return null;
    }
    return { buffer: Buffer.from(data.base64, 'base64'), mimetype: data.mimetype || 'image/jpeg' };
  } catch (err) {
    console.error('[WhatsApp] descargarMedia error:', err.message);
    return null;
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
  enviarImagen,
  enviarVacanteAMatch,
  notificarEmpleadorMatches,
  mejorDestino,
  linkVacante,
  formatCuando,
  descargarMedia,
  setOptIn,
};
