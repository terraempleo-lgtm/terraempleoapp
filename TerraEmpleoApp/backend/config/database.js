const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
  database: process.env.DB_NAME || 'terraempleo',
  connectionLimit: 10,
  acquireTimeout: 30000,
  bigNumberStrings: true,
  supportBigNumbers: true,
  decimalNumbers: true,
});

async function getConnection() {
  try {
    const conn = await pool.getConnection();
    return conn;
  } catch (err) {
    console.error('Error al conectar a MariaDB:', err);
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

module.exports = { pool, getConnection, query };