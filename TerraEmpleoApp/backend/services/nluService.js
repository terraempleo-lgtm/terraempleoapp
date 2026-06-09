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
// Haiku 4.5 vía inference profile (us.) — verificado con acceso en la cuenta 084375580049.
function getModelId() { return process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-haiku-4-5-20251001-v1:0'; }
// Default 'false' (opt-in): no se llama a Bedrock hasta activarlo explícitamente
// (BEDROCK_ENABLED=true) y haberle dado permiso bedrock:InvokeModel al backend.
function isEnabled() { return (process.env.BEDROCK_ENABLED || 'false').toLowerCase() === 'true'; }

let _client = null;
let _InvokeModelCommand = null;

function _cargarSDK() {
  if (!isEnabled()) return false;
  if (_client) return true;
  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    _client = new BedrockRuntimeClient({ region: getRegion() });
    _InvokeModelCommand = InvokeModelCommand;
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

/**
 * Extrae una solicitud de trabajadores desde texto libre.
 * @param {string} texto
 * @returns {Promise<null | {finca,labor,cantidad,fecha,pago,confianza}>}
 *          null si Bedrock no está disponible o no se pudo interpretar.
 */
async function extraerSolicitud(texto) {
  if (!texto || !_cargarSDK()) return null;

  const body = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 400,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Mensaje del empleador: "${texto}"` }],
  };

  try {
    const res = await _client.send(new _InvokeModelCommand({
      modelId: getModelId(),
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    }));
    const payload = JSON.parse(Buffer.from(res.body).toString('utf-8'));
    const texto_modelo = payload?.content?.[0]?.text || '';
    const datos = _extraerJSON(texto_modelo);
    if (!datos) return null;

    // Normalización defensiva.
    const limpio = {
      finca: datos.finca ? String(datos.finca).trim() : null,
      labor: datos.labor ? String(datos.labor).trim() : null,
      cantidad: Number.isFinite(+datos.cantidad) && +datos.cantidad > 0 ? Math.round(+datos.cantidad) : null,
      fecha: datos.fecha ? String(datos.fecha).trim() : null,
      pago: Number.isFinite(+datos.pago) && +datos.pago > 0 ? Math.round(+datos.pago) : null,
      confianza: Number.isFinite(+datos.confianza) ? +datos.confianza : 0.5,
    };
    return limpio;
  } catch (err) {
    console.warn('[NLU] Error invocando Bedrock, se usa flujo guiado:', err.message);
    return null;
  }
}

function disponible() {
  return _cargarSDK();
}

module.exports = { extraerSolicitud, disponible, getModelId, getRegion };
