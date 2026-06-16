/**
 * nluService.js — Capa de NLU sobre AWS Bedrock (Claude).
 *
 * Extrae los campos de una solicitud de trabajadores a partir de texto libre del
 * empleador. Se usa como mejora ENCIMA del flujo guiado: si Bedrock está disponible
 * y devuelve campos con confianza suficiente, el flujo solo pregunta lo que falte;
 * si falla (sin credenciales, sin acceso al modelo, error de red), devuelve null y
 * el motor cae al flujo guiado paso a paso. Así nunca se rompe la experiencia.
 *
 * Usa Bedrock (no la API directa de Anthropic) para aprovechar los créditos AWS.
 * La autenticación es por credenciales/rol AWS del entorno (no hay API key propia).
 *
 * Variables de entorno:
 *   BEDROCK_ENABLED   "true" para activar (default: auto — activo si el SDK carga)
 *   BEDROCK_REGION    región del modelo (default: us-east-1)
 *   BEDROCK_MODEL_ID  id del modelo (default: Claude Haiku). Puede requerir el
 *                     inference profile con prefijo "us." según la región/cuenta.
 */

// Config leída en runtime (los secretos/env llegan desde SSM tras require()).
function getRegion() { return process.env.BEDROCK_REGION || process.env.AWS_REGION || 'us-east-1'; }
// Amazon Nova Micro: el modelo más barato de Bedrock, sin formulario de Anthropic.
// Se usa la API Converse (unificada), así cambiar de modelo es solo cambiar este id.
function getModelId() { return process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0'; }
// Default 'false' (opt-in): no se llama a Bedrock hasta activarlo explícitamente
// (BEDROCK_ENABLED=true) y haberle dado permiso bedrock:InvokeModel al backend.
function isEnabled() { return (process.env.BEDROCK_ENABLED || 'false').toLowerCase() === 'true'; }

let _client = null;
let _ConverseCommand = null;

function _cargarSDK() {
  if (!isEnabled()) return false;
  if (_client) return true;
  try {
    const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
    _client = new BedrockRuntimeClient({ region: getRegion() });
    _ConverseCommand = ConverseCommand;
    return true;
  } catch (err) {
    console.warn('[NLU] Bedrock no disponible (SDK no instalado o sin credenciales). Se usará flujo guiado.');
    return false;
  }
}

const SYSTEM_PROMPT =
  'Eres un asistente que extrae datos de solicitudes de trabajo agrícola en Colombia. ' +
  'Devuelve SOLO un objeto JSON válido, sin texto adicional, con estas claves: ' +
  'finca (string|null), labor (string|null), cantidad (entero|null), fecha (string|null), ' +
  'pago (entero en pesos COP|null), confianza (number 0..1). ' +
  'Si un dato no está en el mensaje, usa null. "70 mil" = 70000. No inventes datos.';

function _extraerJSON(texto) {
  if (!texto) return null;
  // El modelo a veces envuelve el JSON; tomamos el primer bloque {...}.
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

/** Invoca el modelo (API Converse, unificada) y devuelve el texto crudo (o null). */
async function _invocar(system, userText, maxTokens = 400) {
  if (!_cargarSDK()) return null;
  try {
    const res = await _client.send(new _ConverseCommand({
      modelId: getModelId(),
      system: system ? [{ text: system }] : undefined,
      messages: [{ role: 'user', content: [{ text: userText }] }],
      inferenceConfig: { maxTokens, temperature: 0 },
    }));
    return res?.output?.message?.content?.[0]?.text || null;
  } catch (err) {
    console.warn('[NLU] Error invocando Bedrock:', err.message);
    return null;
  }
}

/**
 * Extrae una solicitud de trabajadores desde texto libre.
 * @param {string} texto
 * @returns {Promise<null | {finca,labor,cantidad,fecha,pago,confianza}>}
 *          null si Bedrock no está disponible o no se pudo interpretar.
 */
async function extraerSolicitud(texto) {
  if (!texto) return null;
  const datos = _extraerJSON(await _invocar(SYSTEM_PROMPT, `Mensaje del empleador: "${texto}"`, 400));
  if (!datos) return null;
  return {
    finca: datos.finca ? String(datos.finca).trim() : null,
    labor: datos.labor ? String(datos.labor).trim() : null,
    cantidad: Number.isFinite(+datos.cantidad) && +datos.cantidad > 0 ? Math.round(+datos.cantidad) : null,
    fecha: datos.fecha ? String(datos.fecha).trim() : null,
    pago: Number.isFinite(+datos.pago) && +datos.pago > 0 ? Math.round(+datos.pago) : null,
    confianza: Number.isFinite(+datos.confianza) ? +datos.confianza : 0.5,
  };
}

const REVIEW_SYSTEM =
  'Eres asistente de TerraEmpleo (empleo rural agrícola en Colombia). Recibes en JSON los datos de una ' +
  'solicitud de trabajadores que un bot recolectó por WhatsApp; pueden venir con saludos sobrantes ' +
  '("hola", "buenas"), frases de relleno ("la finca se llama") o errores de ortografía leves. ' +
  'Tu tarea: LIMPIAR y CORREGIR (no inventar). Devuelve SOLO un objeto JSON con: ' +
  'finca (string), labor (string), cantidad (entero), fecha (string), pago (entero en pesos COP), ' +
  'resumen (string corto y claro, con emojis, listo para que el empleador confirme la publicación). ' +
  'Quita saludos/relleno de los textos, capitaliza nombres propios, corrige ortografía obvia. ' +
  'NO cambies los números si ya son correctos. Si un campo viene vacío, déjalo vacío. No agregues texto fuera del JSON.';

/**
 * Revisa/pule la solicitud completa con UNA sola llamada al modelo (en el paso de
 * confirmación). Devuelve datos corregidos + un `resumen` redactado. null si no hay Bedrock.
 * @param {{finca,labor,cantidad,fecha,pago}} datos
 * @returns {Promise<null | {finca,labor,cantidad,fecha,pago,resumen}>}
 */
async function revisarSolicitud(datos) {
  const texto = await _invocar(REVIEW_SYSTEM, `Datos recolectados: ${JSON.stringify(datos)}`, 500);
  const out = _extraerJSON(texto);
  if (!out) return null;
  return {
    finca: out.finca ? String(out.finca).trim() : (datos.finca || null),
    labor: out.labor ? String(out.labor).trim() : (datos.labor || null),
    cantidad: Number.isFinite(+out.cantidad) && +out.cantidad > 0 ? Math.round(+out.cantidad) : (datos.cantidad || null),
    fecha: out.fecha ? String(out.fecha).trim() : (datos.fecha || null),
    pago: Number.isFinite(+out.pago) && +out.pago > 0 ? Math.round(+out.pago) : (datos.pago || null),
    resumen: out.resumen ? String(out.resumen).trim() : null,
  };
}

const FALLBACK_SYSTEM =
  'Eres el asistente de WhatsApp de TerraEmpleo, app de empleo rural agrícola en Colombia que conecta a ' +
  'trabajadores del campo con fincas/empleadores. REGLAS:\n' +
  '1) PRIORIZA RESPONDER de forma breve, cálida y útil. Usa la BASE DE CONOCIMIENTO y los DATOS DEL USUARIO ' +
  'que te paso abajo.\n' +
  '2) Si preguntan su nombre, su rol, o algo sobre TerraEmpleo (qué es, cómo registrarse/postularse/publicar, ' +
  'costos, etc.), RESPONDE con esos datos. NUNCA digas "no tengo información" si el dato está en el contexto.\n' +
  '3) El bot entiende estos comandos: *OFERTAS* (ver vacantes), *REGISTRARME* (crear cuenta), ' +
  '"Necesito trabajadores" (publicar, empleadores). Guía a usarlos cuando aplique.\n' +
  '4) ESCALA a un asesor SOLO si es un problema real que necesita una persona (no puede entrar a su cuenta, un ' +
  'pago, una queja seria, un error técnico). Un saludo o una pregunta normal NUNCA se escala.\n' +
  'Devuelve SOLO un JSON: {"accion":"responder"|"escalar","mensaje":"texto corto con emojis"}. No inventes vacantes.';

/**
 * Fallback cuando el bot no entendió: la IA responde con lo que sabe (base de
 * conocimiento + datos del usuario) o decide escalar a un asesor.
 * @param {string} texto
 * @param {{usuario?:object, kb?:Array<{clave,pregunta,respuesta}>}} contexto
 * @returns {Promise<null | {accion:'responder'|'escalar', mensaje:string}>}
 */
async function responderLibre(texto, contexto = {}) {
  if (!texto) return null;
  const { usuario, kb } = contexto;
  let ctx = `Mensaje del usuario: "${texto}"`;
  ctx += usuario
    ? `\n\nDATOS DEL USUARIO: nombre="${usuario.nombre_completo || '(sin nombre)'}", rol="${usuario.rol || 'usuario'}".`
    : `\n\nDATOS DEL USUARIO: aún no está registrado.`;
  if (kb && kb.length) {
    ctx += `\n\nBASE DE CONOCIMIENTO:\n` + kb.map((k) => `- ${k.pregunta || k.clave}: ${k.respuesta}`).join('\n');
  }
  const out = _extraerJSON(await _invocar(FALLBACK_SYSTEM, ctx, 350));
  if (!out || !out.mensaje) return null;
  return { accion: out.accion === 'escalar' ? 'escalar' : 'responder', mensaje: String(out.mensaje).trim() };
}

function disponible() {
  return _cargarSDK();
}

/** Diagnóstico: intenta una invocación mínima y devuelve estado/error explícito. */
async function probar() {
  const info = {
    enabled: isEnabled(), modelId: getModelId(), region: getRegion(),
    sdk: false, ok: false, respuesta: null, error: null,
  };
  if (!info.enabled) { info.error = 'BEDROCK_ENABLED no es true'; return info; }
  if (!_cargarSDK()) { info.error = 'SDK no cargó'; return info; }
  info.sdk = true;
  try {
    const res = await _client.send(new _ConverseCommand({
      modelId: getModelId(),
      messages: [{ role: 'user', content: [{ text: 'responde solo: ok' }] }],
      inferenceConfig: { maxTokens: 20, temperature: 0 },
    }));
    info.respuesta = res?.output?.message?.content?.[0]?.text || null;
    info.ok = true;
  } catch (err) {
    info.error = `${err.name}: ${err.message}`;
  }
  return info;
}

module.exports = { extraerSolicitud, revisarSolicitud, responderLibre, disponible, probar, getModelId, getRegion };
