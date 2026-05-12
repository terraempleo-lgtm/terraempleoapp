const { query } = require('../config/database');

// POST /api/pqrs — Usuario envía una PQRS
async function crearPqrs(req, res) {
  try {
    const usuarioId = req.user.id;
    const { tipo, asunto, descripcion } = req.body;

    if (!tipo || !asunto || !descripcion) {
      return res.status(400).json({ error: 'tipo, asunto y descripcion son obligatorios' });
    }
    if (!['peticion', 'queja', 'reclamo', 'sugerencia'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
    if (asunto.trim().length < 5) {
      return res.status(400).json({ error: 'El asunto debe tener al menos 5 caracteres' });
    }
    if (descripcion.trim().length < 10) {
      return res.status(400).json({ error: 'La descripción debe tener al menos 10 caracteres' });
    }

    await query(
      'INSERT INTO pqrs (usuario_id, tipo, asunto, descripcion) VALUES (?, ?, ?, ?)',
      [usuarioId, tipo, asunto.trim(), descripcion.trim()]
    );

    res.status(201).json({ message: 'Tu PQRS fue enviada. El equipo de TerraEmpleo la revisará y te responderá a la brevedad.' });
  } catch (err) {
    console.error('Error creando PQRS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/pqrs — Usuario ve sus propias PQRS
async function misPqrs(req, res) {
  try {
    const usuarioId = req.user.id;
    const rows = await query(
      'SELECT id, tipo, asunto, estado, respuesta, respuesta_usuario, created_at, respondido_at FROM pqrs WHERE usuario_id = ? ORDER BY created_at DESC',
      [usuarioId]
    );
    res.json({ pqrs: rows });
  } catch (err) {
    console.error('Error obteniendo PQRS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/pqrs/:id/responder — Usuario responde al admin
async function responderUsuarioPqrs(req, res) {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const { respuesta_usuario } = req.body;

    if (!respuesta_usuario || respuesta_usuario.trim().length < 2) {
      return res.status(400).json({ error: 'La respuesta debe tener al menos 2 caracteres' });
    }

    const rows = await query('SELECT id FROM pqrs WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'PQRS no encontrada' });

    await query('UPDATE pqrs SET respuesta_usuario = ? WHERE id = ?', [respuesta_usuario.trim(), id]);
    res.json({ message: 'Respuesta enviada' });
  } catch (err) {
    console.error('Error respondiendo PQRS usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /api/admin/pqrs — Admin lista todas las PQRS
async function listarPqrs(req, res) {
  try {
    const { estado } = req.query;
    let sql = `
      SELECT p.id, p.tipo, p.asunto, p.descripcion, p.estado, p.respuesta, p.created_at, p.respondido_at,
             u.nombre_completo AS usuario_nombre, u.rol AS usuario_rol, u.celular AS usuario_celular, u.id AS usuario_id
      FROM pqrs p
      JOIN usuarios u ON u.id = p.usuario_id
    `;
    const params = [];
    if (estado) { sql += ' WHERE p.estado = ?'; params.push(estado); }
    sql += ' ORDER BY p.created_at DESC LIMIT 500';
    const rows = await query(sql, params);
    res.json({ pqrs: rows });
  } catch (err) {
    console.error('Error listando PQRS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /api/admin/pqrs/:id — Admin responde/actualiza una PQRS
async function responderPqrs(req, res) {
  try {
    const { id } = req.params;
    const { estado, respuesta } = req.body;
    const adminId = req.user.id;

    if (!['recibido', 'en_proceso', 'resuelto', 'cerrado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const rows = await query('SELECT id FROM pqrs WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'PQRS no encontrada' });

    await query(
      `UPDATE pqrs SET estado = ?, respuesta = ?, respondido_por = ?, respondido_at = NOW() WHERE id = ?`,
      [estado, respuesta || null, adminId, id]
    );

    res.json({ message: 'PQRS actualizada' });
  } catch (err) {
    console.error('Error respondiendo PQRS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { crearPqrs, misPqrs, responderUsuarioPqrs, listarPqrs, responderPqrs };
