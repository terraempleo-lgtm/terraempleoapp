const https = require('https');
const { query } = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Envía una push notification a un usuario por su ID.
 * Si el usuario no tiene push_token, no hace nada (silencioso).
 */
async function enviarPush(usuarioId, titulo, cuerpo, datos = {}) {
  try {
    const rows = await query('SELECT push_token FROM usuarios WHERE id = ?', [usuarioId]);
    const token = rows?.[0]?.push_token;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    const payload = JSON.stringify({
      to: token,
      title: titulo,
      body: cuerpo,
      data: datos,
      sound: 'default',
      channelId: 'default',
    });

    await new Promise((resolve, reject) => {
      const req = https.request(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error('Error enviando push notification:', err.message);
  }
}

module.exports = { enviarPush };
