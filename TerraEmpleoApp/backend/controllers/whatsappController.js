/**
 * whatsappController.js — Receptor de webhooks de WhatsApp.
 *
 * Recibe los eventos del proveedor (Evolution API por defecto; compatible con el
 * formato de WhatsApp Cloud API), aplica idempotencia, identifica al usuario por
 * su número, delega en el motor conversacional y responde por el mismo canal.
 *
 * Endpoint: POST /api/webhooks/whatsapp   (sin auth JWT — lo llama el proveedor;
 * se protege opcionalmente con WHATSAPP_WEBHOOK_TOKEN).
 */

const { query } = require('../config/database');
const whatsappService = require('../services/whatsappService');
const conversationEngine = require('../services/conversationEngine');

/** Extrae los campos relevantes de un evento entrante (Evolution / Cloud API). */
function extraerMensaje(body) {
  // ── Evolution API (event: messages.upsert) ──
  if (body && body.data && (body.data.key || body.data.message)) {
    const data = body.data;
    const key = data.key || {};
    const remoteJid = key.remoteJid || '';
    const m = data.message || {};
    const esImagen = !!m.imageMessage;
    const texto =
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.buttonsResponseMessage?.selectedDisplayText ||
      m.listResponseMessage?.title ||
      m.templateButtonReplyMessage?.selectedId ||
      (esImagen ? '' : null);
    // Cuando el remitente llega como @lid, Evolution incluye el número real en remoteJidAlt.
    const remoteJidAlt = key.remoteJidAlt || '';
    const phoneReal = remoteJidAlt.includes('@s.whatsapp.net')
      ? remoteJidAlt.split('@')[0].split(':')[0]
      : (remoteJid.endsWith('@s.whatsapp.net') ? remoteJid.split('@')[0].split(':')[0] : null);
    return {
      provider: 'evolution',
      phone: remoteJid.split('@')[0].split(':')[0],
      phoneReal, // número real (de remoteJidAlt) para reconocer usuarios registrados
      jid: remoteJid, // JID crudo (puede ser @lid) — se responde a este exacto
      fromMe: key.fromMe === true,
      id: key.id || null,
      texto,
      esImagen,
      key, // necesaria para descargar el media desde Evolution
      isGroup: remoteJid.endsWith('@g.us'),
      event: body.event || null,
    };
  }

  // ── WhatsApp Cloud API (entry[].changes[].value.messages[]) ──
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (msg) {
    const texto =
      msg.text?.body ||
      msg.button?.text ||
      msg.interactive?.button_reply?.title ||
      msg.interactive?.list_reply?.title ||
      null;
    return {
      provider: 'cloud',
      phone: msg.from,
      fromMe: false,
      id: msg.id || null,
      texto,
      isGroup: false,
      event: 'messages',
    };
  }

  return null;
}

/**
 * Resuelve el usuario asociado a un mensaje entrante.
 * 1) Por mapeo explícito de JID (whatsapp_identidades) — cubre los "@lid" que ocultan
 *    el número y que el usuario ya identificó antes.
 * 2) Por número (cuando WhatsApp entrega el remitente como número real @s.whatsapp.net).
 */
async function _matchCelular(telefono) {
  const ult10 = String(telefono || '').replace(/\D/g, '').slice(-10);
  if (ult10.length < 10) return null;
  const rows = await query(
    `SELECT id, nombre_completo, rol, celular, whatsapp_opt_in
     FROM usuarios
     WHERE activo = 1 AND (baneado IS NULL OR baneado = 0)
       AND RIGHT(REPLACE(REPLACE(REPLACE(celular,'+',''),' ',''),'-',''), 10) = ?
     LIMIT 1`,
    [ult10]
  ).catch(() => []);
  return rows && rows[0] ? rows[0] : null;
}

async function buscarUsuario(jid, telefono, telefonoReal) {
  // 1) Por el número REAL (remoteJidAlt) — reconoce a usuarios registrados en la app
  //    aunque escriban desde un @lid. Se auto-guarda el mapeo jid → usuario.
  if (telefonoReal) {
    const u = await _matchCelular(telefonoReal);
    if (u) {
      if (jid) await query(
        `INSERT INTO whatsapp_identidades (jid, usuario_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id)`,
        [jid, u.id]
      ).catch(() => {});
      return u;
    }
  }
  // 2) Por mapeo de JID guardado antes (whatsapp_identidades).
  if (jid) {
    const m = await query(
      `SELECT u.id, u.nombre_completo, u.rol, u.celular, u.whatsapp_opt_in
       FROM whatsapp_identidades wi JOIN usuarios u ON u.id = wi.usuario_id
       WHERE wi.jid = ? AND u.activo = 1 AND (u.baneado IS NULL OR u.baneado = 0)
       LIMIT 1`,
      [jid]
    ).catch(() => []);
    if (m && m[0]) return m[0];
  }
  // 3) Por el número del remitente (cuando llega como @s.whatsapp.net directo).
  return await _matchCelular(telefono);
}

/** Procesa un mensaje entrante de punta a punta (idempotente). */
async function procesarEntrante(info) {
  const telefono = whatsappService.normalizarTelefono(info.phone);
  // Aceptar texto o imagen (la imagen puede venir sin caption).
  if (!telefono || (!info.texto && !info.esImagen)) return;

  const usuario = await buscarUsuario(info.jid, telefono, info.phoneReal);

  // Idempotencia + log inbound: el INSERT con UNIQUE(provider_message_id) actúa de candado.
  const esNuevo = await whatsappService.registrarMensaje({
    providerMessageId: info.id,
    telefono,
    usuarioId: usuario ? usuario.id : null,
    direccion: 'inbound',
    tipo: info.esImagen ? 'imagen' : 'texto',
    contenido: info.texto || (info.esImagen ? '[imagen]' : ''),
    estado: 'recibido',
  });
  if (!esNuevo) {
    console.log(`[WhatsApp] Evento duplicado ignorado (${info.id})`);
    return;
  }

  // Si es imagen, descargar el media para pasarlo al motor (paso de fotos de vacante).
  let media = null;
  if (info.esImagen) {
    media = await whatsappService.descargarMedia(info.key).catch(() => null);
  }

  const { reply, conversacionId } = await conversationEngine.procesarMensaje({
    telefono,
    jid: info.jid || null,
    texto: info.texto || '',
    usuario,
    media,
  });

  if (reply) {
    // Responder al JID exacto del remitente (soporta @lid); fallback al teléfono.
    await whatsappService.enviarTexto(info.jid || telefono, reply, {
      usuarioId: usuario ? usuario.id : null,
      conversacionId: conversacionId || null,
    });
  }
}

/** POST /api/webhooks/whatsapp */
async function recibirWebhook(req, res) {
  // Seguridad opcional: token compartido por query (?token=) o header.
  const expected = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (expected) {
    const got = req.query.token || req.headers['x-webhook-token'];
    if (got !== expected) return res.sendStatus(401);
  }

  // Ack inmediato: el proveedor solo necesita 200. El procesamiento sigue en background.
  res.sendStatus(200);

  try {
    const info = extraerMensaje(req.body);
    if (!info || info.fromMe || info.isGroup) return;
    if (!info.texto && !info.esImagen) return;
    await procesarEntrante(info);
  } catch (err) {
    console.error('[WhatsApp] Error procesando webhook:', err.message);
  }
}

/** GET /api/webhooks/whatsapp — verificación estilo Cloud API (hub.challenge). */
function verificarWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  // Para Evolution no hace falta verificación; respondemos OK para healthchecks.
  return res.status(200).json({ status: 'whatsapp webhook ok', provider: whatsappService.resolveProvider() });
}

/** GET /api/webhooks/whatsapp/estado — diagnóstico rápido (sin secretos). */
async function estado(req, res) {
  const stats = await query(
    `SELECT direccion, COUNT(*) AS total FROM whatsapp_mensajes GROUP BY direccion`
  ).catch(() => []);
  const convs = await query(
    `SELECT estado, COUNT(*) AS total FROM whatsapp_conversaciones GROUP BY estado`
  ).catch(() => []);
  res.json({
    provider: whatsappService.resolveProvider(),
    mensajes: stats,
    conversaciones: convs,
    timestamp: new Date().toISOString(),
  });
}

/** GET /api/webhooks/whatsapp/bedrock-test?token=... — diagnóstico de Bedrock (gated por token). */
async function bedrockTest(req, res) {
  const expected = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (expected && req.query.token !== expected) return res.sendStatus(401);
  const nlu = require('../services/nluService');
  const r = await nlu.probar().catch((e) => ({ ok: false, error: e.message }));
  res.json(r);
}

module.exports = { recibirWebhook, verificarWebhook, estado, bedrockTest, buscarUsuario };
