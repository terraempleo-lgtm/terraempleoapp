/**
 * secrets.js — Carga secretos desde AWS SSM Parameter Store en producción.
 *
 * Usa GetParameters (lista explícita de nombres, máx 10) porque el usuario IAM del
 * backend tiene permiso ssm:GetParameters sobre /terraempleo/production/* — NO
 * ssm:GetParametersByPath. Incluye config no-secreta del bot para no editar el .env
 * del servidor por SSH.
 *
 * En desarrollo (NODE_ENV != production) se usan directamente las variables de .env.
 * Si SSM falla en producción, se hace fallback a las variables de .env con una advertencia.
 */

const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const PREFIX = '/terraempleo/production';
// Máx 10 nombres por GetParameters.
const SECRET_KEYS = [
  'DB_PASSWORD', 'JWT_SECRET', 'EMAIL_PASS', 'EMAIL_USER',
  'WHATSAPP_API_KEY', 'WHATSAPP_PROVIDER', 'WHATSAPP_API_URL',
  'WHATSAPP_INSTANCE', 'WHATSAPP_WEBHOOK_TOKEN', 'BEDROCK_ENABLED',
];

async function loadSecretsFromSSM() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SECRETS] Entorno no-producción — usando variables de .env');
    return;
  }

  try {
    const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const names = SECRET_KEYS.map((k) => `${PREFIX}/${k}`);

    const { Parameters = [], InvalidParameters = [] } = await client.send(
      new GetParametersCommand({ Names: names, WithDecryption: true })
    );

    for (const param of Parameters) {
      const key = param.Name.replace(`${PREFIX}/`, '');
      process.env[key] = param.Value;
    }

    if (InvalidParameters.length > 0) {
      // Normal: parámetros opcionales que aún no existen (p. ej. BEDROCK_ENABLED).
      console.warn(`[SECRETS] No encontrados en SSM (opcionales): ${InvalidParameters.join(', ')}`);
    }

    console.log(`[SECRETS] ${Parameters.length} parámetros cargados desde SSM`);
  } catch (err) {
    console.error('[SECRETS] No se pudo conectar con SSM:', err.message);
    console.error('[SECRETS] Fallback: usando variables de .env (verifica credenciales o rol IAM)');
  }
}

module.exports = { loadSecretsFromSSM };
