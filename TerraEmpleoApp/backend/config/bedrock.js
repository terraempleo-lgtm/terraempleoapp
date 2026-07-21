const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
require('dotenv').config();

const awsRegion = process.env.AWS_REGION;
const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!awsRegion || !awsAccessKey || !awsSecretKey) {
  console.error('[Bedrock] ERROR: Variables de entorno AWS faltantes — la lectura de planillas no funcionará.');
}

const bedrock = new BedrockRuntimeClient({
  region: awsRegion,
  credentials: { accessKeyId: awsAccessKey, secretAccessKey: awsSecretKey },
});

// Modelo económico con visión nativa (ver AGENTS/prompt del módulo de
// planillas). Si la precisión no alcanza, escalar via esta env var a algo
// como "anthropic.claude-haiku-4-5-20251001-v1:0" sin tocar código.
// Nova no admite invocación "on-demand" por model ID directo — Bedrock exige
// el inference profile (prefijo de región). Confirmado en producción:
// "amazon.nova-2-lite-v1:0" solo → ValidationException pidiendo el profile.
const MODELO_PLANILLA = process.env.BEDROCK_MODEL_PLANILLA || 'us.amazon.nova-2-lite-v1:0';

/**
 * Llama a Bedrock (Converse API — funciona igual para Nova y Claude, así
 * que escalar de modelo más adelante no implica reescribir el payload)
 * con una imagen + un prompt de texto, y devuelve el texto de respuesta.
 * @param {Buffer} imageBuffer
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function invocarConImagen(imageBuffer, prompt) {
  const command = new ConverseCommand({
    modelId: MODELO_PLANILLA,
    messages: [
      {
        role: 'user',
        content: [
          { image: { format: 'jpeg', source: { bytes: imageBuffer } } },
          { text: prompt },
        ],
      },
    ],
    inferenceConfig: { maxTokens: 1024, temperature: 0 },
  });
  const result = await bedrock.send(command);
  const parts = result.output?.message?.content || [];
  return parts.map((p) => p.text || '').join('').trim();
}

module.exports = { bedrock, invocarConImagen, MODELO_PLANILLA };
