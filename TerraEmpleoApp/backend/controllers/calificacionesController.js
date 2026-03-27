const { query } = require('../config/database');

// Calificar usuario
async function calificar(req, res) {
  try {
    const calificadorId = req.user.id;
    const rolCalificador = req.user.rol;
    const { calificado_id, vacante_id, estrellas, comentario } = req.body;

    if (!calificado_id || !estrellas) {
      return res.status(400).json({ error: 'calificado_id y estrellas son obligatorios' });
    }

    if (Number(calificado_id) === Number(calificadorId)) {
      return res.status(400).json({ error: 'No puedes calificarte a ti mismo' });
    }

    if (estrellas < 1 || estrellas > 5) {
      return res.status(400).json({ error: 'Las estrellas deben ser entre 1 y 5' });
    }

    const usuarios = await query('SELECT id, rol FROM usuarios WHERE id IN (?, ?)', [calificadorId, calificado_id]);
    if (!usuarios || usuarios.length < 2) {
      return res.status(404).json({ error: 'Usuario a calificar no encontrado' });
    }

    const rolCalificado = usuarios.find((u) => Number(u.id) === Number(calificado_id))?.rol;

    if (!['trabajador', 'empleador'].includes(rolCalificador) || !['trabajador', 'empleador'].includes(rolCalificado)) {
      return res.status(403).json({ error: 'Solo trabajadores y empleadores pueden calificarse' });
    }

    if (rolCalificador === rolCalificado) {
      return res.status(400).json({ error: 'Solo se permite calificación entre trabajador y empleador' });
    }

    if (!vacante_id) {
      return res.status(400).json({ error: 'vacante_id es obligatorio para registrar la calificación' });
    }

    const vacanteId = Number(vacante_id);
    if (!Number.isFinite(vacanteId)) {
      return res.status(400).json({ error: 'vacante_id inválido' });
    }

    let relacion;
    if (rolCalificador === 'empleador') {
      relacion = await query(
        `SELECT p.id
         FROM postulaciones p
         JOIN vacantes v ON v.id = p.vacante_id
         WHERE p.vacante_id = ?
           AND v.empleador_id = ?
           AND p.trabajador_id = ?
           AND p.estado = 'aceptada'
         LIMIT 1`,
        [vacanteId, calificadorId, calificado_id]
      );
    } else {
      relacion = await query(
        `SELECT p.id
         FROM postulaciones p
         JOIN vacantes v ON v.id = p.vacante_id
         WHERE p.vacante_id = ?
           AND p.trabajador_id = ?
           AND v.empleador_id = ?
           AND p.estado = 'aceptada'
         LIMIT 1`,
        [vacanteId, calificadorId, calificado_id]
      );
    }

    if (!relacion || relacion.length === 0) {
      return res.status(403).json({ error: 'Solo puedes calificar después de una relación aceptada en esta vacante' });
    }

    const existente = await query(
      'SELECT id FROM calificaciones WHERE calificador_id = ? AND calificado_id = ? AND vacante_id = ? LIMIT 1',
      [calificadorId, calificado_id, vacanteId]
    );

    if (existente && existente.length > 0) {
      return res.status(409).json({ error: 'Ya calificaste a este usuario para esta vacante' });
    }

    await query(`
      INSERT INTO calificaciones (calificador_id, calificado_id, vacante_id, estrellas, comentario)
      VALUES (?, ?, ?, ?, ?)
    `, [calificadorId, calificado_id, vacanteId, estrellas, comentario || null]);

    // Actualizar promedio
    const promedioResult = await query(
      'SELECT AVG(estrellas) as promedio, COUNT(*) as total FROM calificaciones WHERE calificado_id = ?',
      [calificado_id]
    );

    if (promedioResult.length > 0) {
      await query(
        'UPDATE usuarios SET calificacion_promedio = ?, total_calificaciones = ? WHERE id = ?',
        [promedioResult[0].promedio, promedioResult[0].total, calificado_id]
      );
    }

    res.status(201).json({ message: 'Calificación registrada exitosamente' });
  } catch (err) {
    console.error('Error calificando:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener calificaciones de un usuario
async function obtenerCalificaciones(req, res) {
  try {
    const { usuario_id } = req.params;
    const calificaciones = await query(`
      SELECT c.*, u.nombre_completo as nombre_calificador
      FROM calificaciones c
      JOIN usuarios u ON u.id = c.calificador_id
      WHERE c.calificado_id = ?
      ORDER BY c.created_at DESC
    `, [usuario_id]);

    res.json({ calificaciones });
  } catch (err) {
    console.error('Error obteniendo calificaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { calificar, obtenerCalificaciones };
