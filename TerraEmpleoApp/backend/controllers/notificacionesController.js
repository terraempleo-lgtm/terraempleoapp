const { query } = require('../config/database');

// Función interna para crear notificaciones (usada por otros controladores)
async function crearNotificacion(usuarioId, tipo, titulo, mensaje) {
  try {
    await query(
      'INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES (?, ?, ?, ?)',
      [usuarioId, tipo, titulo, mensaje]
    );
  } catch (err) {
    console.error('Error creando notificación:', err);
  }
}

// GET /api/notificaciones
async function listar(req, res) {
  try {
    const usuarioId = req.user.id;
    const notifs = await query(
      'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY created_at DESC',
      [usuarioId]
    );
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

module.exports = { crearNotificacion, listar, contarNoLeidas, marcarLeida, marcarTodasLeidas };
