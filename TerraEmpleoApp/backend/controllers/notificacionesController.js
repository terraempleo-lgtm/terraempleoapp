const { query } = require('../config/database');
const { enviarPush } = require('../services/pushService');

// Función interna para crear notificaciones (usada por otros controladores)
// extra: { vacante_id, conversacion_id } — ambos opcionales
async function crearNotificacion(usuarioId, tipo, titulo, mensaje, extra = {}) {
  try {
    const vacante_id = extra.vacante_id || null;
    const conversacion_id = extra.conversacion_id || extra.chat_id || null;
    await query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, vacante_id, conversacion_id, chat_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [usuarioId, tipo, titulo, mensaje, vacante_id, conversacion_id, conversacion_id]
    );
    // Enviar push en paralelo — no bloquea si falla
    enviarPush(usuarioId, titulo, mensaje, { tipo, vacante_id, conversacion_id });
  } catch (err) {
    console.error('Error creando notificación:', err);
  }
}

// GET /api/notificaciones
async function listar(req, res) {
  try {
    const usuarioId = req.user.id;
    const since = req.query.since; // ISO opcional para sync incremental
    let notifs;
    if (since) {
      notifs = await query(
        'SELECT * FROM notificaciones WHERE usuario_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 500',
        [usuarioId, since]
      );
    } else {
      notifs = await query(
        'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 200',
        [usuarioId]
      );
    }
    for (const n of notifs) {
      n.leida = Number(n.leida) === 1;
    }
    res.json({ notificaciones: notifs });
  } catch (err) {
    console.error('Error listando notificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/notificaciones/no-leidas
async function contarNoLeidas(req, res) {
  try {
    const usuarioId = req.user.id;
    const result = await query(
      'SELECT COUNT(*) as count FROM notificaciones WHERE usuario_id = ? AND leida = 0',
      [usuarioId]
    );
    res.json({ count: Number(result[0].count) });
  } catch (err) {
    console.error('Error contando notificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/notificaciones/:id/leer
async function marcarLeida(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    await query(
      'UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('Error marcando notificación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/notificaciones/leer-todas
async function marcarTodasLeidas(req, res) {
  try {
    const usuarioId = req.user.id;
    await query(
      'UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?',
      [usuarioId]
    );
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    console.error('Error marcando todas las notificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/notificaciones/push-token
async function guardarPushToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    await query('UPDATE usuarios SET push_token = ? WHERE id = ?', [token, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error guardando push token:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crearNotificacion, listar, contarNoLeidas, marcarLeida, marcarTodasLeidas, guardarPushToken };
