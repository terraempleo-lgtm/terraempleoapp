const { query } = require('../config/database');

// Calificar usuario
async function calificar(req, res) {
  try {
    const calificadorId = req.user.id;
    const { calificado_id, vacante_id, estrellas, comentario } = req.body;

    if (!calificado_id || !estrellas) {
      return res.status(400).json({ error: 'calificado_id y estrellas son obligatorios' });
    }

    if (estrellas < 1 || estrellas > 5) {
      return res.status(400).json({ error: 'Las estrellas deben ser entre 1 y 5' });
    }

    await query(`
      INSERT INTO calificaciones (calificador_id, calificado_id, vacante_id, estrellas, comentario)
      VALUES (?, ?, ?, ?, ?)
    `, [calificadorId, calificado_id, vacante_id || null, estrellas, comentario || null]);

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
