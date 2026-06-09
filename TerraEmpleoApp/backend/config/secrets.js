/**
 * secrets.js — Carga secretos desde AWS SSM Parameter Store en producción.
 *
 * Parámetros esperados en SSM (tipo SecureString):
 *   /terraempleo/production/DB_PASSWORD
 *   /terraempleo/production/JWT_SECRET
 *   /terraempleo/production/EMAIL_PASS
 *   /terraempleo/production/EMAIL_USER
 *
 * En desarrollo (NODE_ENV != production) se usan directamente las variables de .env.
 * Si SSM falla en producción, se hace fallback a las variables de .env con una advertencia.
 */

const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const PREFIX = '/terraempleo/production';
// Máximo 10 nombres por GetParameters. Incluye config del módulo WhatsApp (no-secreta
// pero cargada igual desde SSM para no tener que editar el .env del servidor por SSH).
const SECRET_KEYS = [
  'DB_PASSWORD', 'JWT_SECRET', 'EMAIL_PASS', 'EMAIL_USER',
  'WHATSAPP_API_KEY', 'WHATSAPP_PROVIDER', 'WHATSAPP_API_URL',
  'WHATSAPP_INSTANCE', 'WHATSAPP_WEBHOOK_TOKEN',
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
      console.warn(`[SECRETS] Parámetros no encontrados en SSM: ${InvalidParameters.join(', ')}`);
    }

    console.log(`[SECRETS] ${Parameters.length}/${SECRET_KEYS.length} secretos cargados desde SSM`);
  } catch (err) {
    console.error('[SECRETS] No se pudo conectar con SSM:', err.message);
    console.error('[SECRETS] Fallback: usando variables de .env (verifica credenciales o rol IAM)');
  }
}

module.exports = { loadSecretsFromSSM };
