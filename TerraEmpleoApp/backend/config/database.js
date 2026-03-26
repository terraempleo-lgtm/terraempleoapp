const mariadb = require('mariadb');
const fs = require('fs');
require('dotenv').config();

// Pool se crea de forma lazy — la primera vez que se solicita una conexión.
// Esto permite que loadSecretsFromSSM() inyecte DB_PASSWORD en process.env
// antes de que se intente crear el pool.
let _pool = null;

function getPool() {
  if (_pool) return _pool;

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD;
  const dbName = process.env.DB_NAME || 'terraempleo';
  const dbPort = parseInt(process.env.DB_PORT) || 3306;
  const dbSSL = process.env.DB_SSL === 'true';
  const dbSSLCAPath = process.env.DB_SSL_CA_PATH || '';
  const isRDS = dbHost.includes('rds.amazonaws.com');

  if (!dbPass) {
    console.error('[DB] ERROR: DB_PASSWORD no está configurado. Define esta variable en el entorno.');
    process.exit(1);
  }

  console.log(`[DB] Configurado → ${dbHost}:${dbPort} | user: ${dbUser} | db: ${dbName} | RDS: ${isRDS} | SSL: ${dbSSL}`);

  const poolConfig = {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: dbName,
    connectionLimit: 10,
    connectTimeout: isRDS ? 20000 : 10000,
    acquireTimeout: 30000,
    bigNumberStrings: true,
    supportBigNumbers: true,
    decimalNumbers: true,
  };

  // SSL configuration
  if (dbSSL) {
    const sslConfig = {};
    if (dbSSLCAPath) {
      try {
        sslConfig.ca = fs.readFileSync(dbSSLCAPath);
        console.log(`[DB] Certificado CA cargado desde: ${dbSSLCAPath}`);
      } catch (err) {
        console.error(`[DB] ERROR: No se pudo leer el certificado CA en ${dbSSLCAPath}: ${err.message}`);
        process.exit(1);
      }
    }
    sslConfig.rejectUnauthorized = !!dbSSLCAPath;
    poolConfig.ssl = sslConfig;
  } else if (isRDS) {
    console.warn('[DB] ADVERTENCIA: Conectando a RDS sin SSL explícito. Establece DB_SSL=true y DB_SSL_CA_PATH para producción.');
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  _pool = mariadb.createPool(poolConfig);
  return _pool;
}

async function getConnection() {
  try {
    const conn = await getPool().getConnection();
    return conn;
  } catch (err) {
    console.error(`[DB] Error al conectar: ${err.code || 'UNKNOWN'} - ${err.message}`);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('[DB] Verifica DB_USER y DB_PASSWORD en las variables de entorno.');
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error(`[DB] No se puede alcanzar el host ${dbHost}:${dbPort}. Verifica DB_HOST, DB_PORT y reglas de seguridad.`);
    } else if (err.message.includes('ssl') || err.message.includes('SSL') || err.message.includes('TLS')) {
      console.error('[DB] Error SSL/TLS. Verifica DB_SSL, DB_SSL_CA_PATH y que el certificado sea válido.');
    }
    throw err;
  }
}

async function query(sql, params) {
  let conn;
  try {
    conn = await getConnection();
    const rows = await conn.query(sql, params);
    return rows;
  } finally {
    if (conn) conn.release();
  }
}

// Test de conectividad para health checks
async function testConnection() {
  let conn;
  try {
    conn = await getPool().getConnection();
    await conn.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    if (conn) conn.release();
  }
}

module.exports = { get pool() { return getPool(); }, getConnection, query, testConnection };
