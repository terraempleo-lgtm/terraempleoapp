const { query } = require('../config/database');

// POST /api/reportes — Reportar un mensaje o usuario
async function crearReporte(req, res) {
  try {
    const reportadoPor = req.user.id;
    const { usuario_reportado, mensaje_id, chat_id, motivo, descripcion } = req.body;

    if (!usuario_reportado || !motivo) {
      return res.status(400).json({ error: 'usuario_reportado y motivo son requeridos' });
    }
    if (usuario_reportado === reportadoPor) {
      return res.status(400).json({ error: 'No puedes reportarte a ti mismo' });
    }

    await query(
      `INSERT INTO reportes (reportado_por, usuario_reportado, mensaje_id, chat_id, motivo, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reportadoPor, usuario_reportado, mensaje_id || null, chat_id || null, motivo, descripcion || null]
    );

    // Marcar mensaje como reportado si aplica
    if (mensaje_id) {
      await query('UPDATE mensajes SET reportado = 1 WHERE id = ?', [mensaje_id]);
    }

    res.json({ message: 'Reporte enviado. Nuestro equipo lo revisará en las próximas 24 horas.' });
  } catch (err) {
    console.error('Error creando reporte:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/reportes/bloquear — Bloquear un usuario
async function bloquearUsuario(req, res) {
  try {
    const bloqueadorId = req.user.id;
    const { usuario_id } = req.body;

    if (!usuario_id) return res.status(400).json({ error: 'usuario_id es requerido' });
    if (usuario_id === bloqueadorId) return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });

    await query(
      `INSERT IGNORE INTO usuarios_bloqueados (bloqueador_id, bloqueado_id) VALUES (?, ?)`,
      [bloqueadorId, usuario_id]
    );

    res.json({ message: 'Usuario bloqueado. Ya no recibirás mensajes de esta persona.' });
  } catch (err) {
    console.error('Error bloqueando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /api/reportes/bloquear/:id — Desbloquear un usuario
async function desbloquearUsuario(req, res) {
  try {
    const bloqueadorId = req.user.id;
    const { id } = req.params;
    await query('DELETE FROM usuarios_bloqueados WHERE bloqueador_id = ? AND bloqueado_id = ?', [bloqueadorId, id]);
    res.json({ message: 'Usuario desbloqueado' });
  } catch (err) {
    console.error('Error desbloqueando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/admin/reportes — Listar reportes (admin)
async function listarReportes(req, res) {
  try {
    const { estado } = req.query;
    let sql = `
      SELECT r.id, r.motivo, r.descripcion, r.estado, r.accion_tomada, r.created_at, r.revisado_at,
             u1.nombre_completo AS reportado_por_nombre, u1.id AS reportado_por_id,
             u2.nombre_completo AS usuario_reportado_nombre, u2.id AS usuario_reportado_id,
             u2.baneado, r.mensaje_id, r.chat_id
      FROM reportes r
      JOIN usuarios u1 ON r.reportado_por = u1.id
      JOIN usuarios u2 ON r.usuario_reportado = u2.id
    `;
    const params = [];
    if (estado) { sql += ' WHERE r.estado = ?'; params.push(estado); }
    sql += ' ORDER BY r.created_at DESC LIMIT 200';
    const reportes = await query(sql, params);
    res.json({ reportes });
  } catch (err) {
    console.error('Error listando reportes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/admin/reportes/:id — Resolver reporte (admin)
async function resolverReporte(req, res) {
  try {
    const { id } = req.params;
    const { estado, accion_tomada, banear_usuario } = req.body;
    const adminId = req.user.id;

    if (!['revisado', 'resuelto'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const reporte = await query('SELECT usuario_reportado FROM reportes WHERE id = ?', [id]);
    if (!reporte || reporte.length === 0) return res.status(404).json({ error: 'Reporte no encontrado' });

    await query(
      `UPDATE reportes SET estado = ?, accion_tomada = ?, revisado_at = NOW(), revisado_por = ? WHERE id = ?`,
      [estado, accion_tomada || null, adminId, id]
    );

    if (banear_usuario) {
      await query(
        'UPDATE usuarios SET baneado = 1, baneado_motivo = ?, activo = 0 WHERE id = ?',
        [accion_tomada || 'Violación de términos de uso', reporte[0].usuario_reportado]
      );
    }

    res.json({ message: 'Reporte actualizado' });
  } catch (err) {
    console.error('Error resolviendo reporte:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crearReporte, bloquearUsuario, desbloquearUsuario, listarReportes, resolverReporte };
