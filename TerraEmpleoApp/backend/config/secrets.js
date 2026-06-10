/**
 * secrets.js — Carga TODA la configuración bajo /terraempleo/production/* desde
 * AWS SSM Parameter Store en producción (secretos + config no-secreta del bot).
 *
 * Usa GetParametersByPath (paginado) para no toparse con el límite de 10 de
 * GetParameters y para no tener que mantener una lista fija de claves: cualquier
 * parámetro nuevo que se cree bajo el prefijo se carga automáticamente como variable
 * de entorno (p. ej. DB_PASSWORD, JWT_SECRET, WHATSAPP_*, BEDROCK_ENABLED, ...).
 *
 * En desarrollo (NODE_ENV != production) se usan directamente las variables de .env.
 * Si SSM falla en producción, se hace fallback a las variables de .env con una advertencia.
 */

const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');

const PREFIX = '/terraempleo/production';

async function loadSecretsFromSSM() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[SECRETS] Entorno no-producción — usando variables de .env');
    return;
  }

  try {
    const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });
    let nextToken;
    let count = 0;
    do {
      const out = await client.send(new GetParametersByPathCommand({
        Path: PREFIX,
        WithDecryption: true,
        Recursive: false,
        MaxResults: 10,
        NextToken: nextToken,
      }));
      for (const param of out.Parameters || []) {
        const key = param.Name.split('/').pop();
        process.env[key] = param.Value;
        count++;
      }
      nextToken = out.NextToken;
    } while (nextToken);

    console.log(`[SECRETS] ${count} parámetros cargados desde SSM (${PREFIX}/*)`);
  } catch (err) {
    console.error('[SECRETS] No se pudo conectar con SSM:', err.message);
    console.error('[SECRETS] Fallback: usando variables de .env (verifica credenciales o rol IAM)');
  }
}

module.exports = { loadSecretsFromSSM };
