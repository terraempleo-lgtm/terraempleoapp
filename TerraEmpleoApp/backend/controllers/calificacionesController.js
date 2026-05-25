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

    const rolesValidos = ['trabajador', 'empleador', 'especialista'];
    if (!rolesValidos.includes(rolCalificador) || !rolesValidos.includes(rolCalificado)) {
      return res.status(403).json({ error: 'Rol no permitido para calificar' });
    }

    if (rolCalificador === rolCalificado) {
      return res.status(400).json({ error: 'No puedes calificar a alguien del mismo rol' });
    }

    // Caso: empleador califica especialista (vía contactos_especialista aceptado)
    const esEspecialistaCaso = (rolCalificador === 'empleador' && rolCalificado === 'especialista')
      || (rolCalificador === 'especialista' && rolCalificado === 'empleador');

    let relacion;

    if (esEspecialistaCaso) {
      const empId = rolCalificador === 'empleador' ? calificadorId : calificado_id;
      const espId = rolCalificador === 'especialista' ? calificadorId : calificado_id;
      relacion = await query(
        `SELECT id FROM contactos_especialista WHERE empleador_id = ? AND especialista_id = ? AND estado = 'aceptado' LIMIT 1`,
        [empId, espId]
      );
    } else {
      // trabajador ↔ empleador: requiere postulación aceptada (vacante_id opcional, busca cualquiera)
      if (rolCalificador === 'empleador') {
        relacion = await query(
          `SELECT p.id FROM postulaciones p
           JOIN vacantes v ON v.id = p.vacante_id
           WHERE v.empleador_id = ? AND p.trabajador_id = ? AND p.estado = 'aceptada'
           ${vacante_id ? 'AND p.vacante_id = ?' : ''}
           LIMIT 1`,
          vacante_id ? [calificadorId, calificado_id, Number(vacante_id)] : [calificadorId, calificado_id]
        );
      } else {
        relacion = await query(
          `SELECT p.id FROM postulaciones p
           JOIN vacantes v ON v.id = p.vacante_id
           WHERE p.trabajador_id = ? AND v.empleador_id = ?  AND p.estado = 'aceptada'
           ${vacante_id ? 'AND p.vacante_id = ?' : ''}
           LIMIT 1`,
          vacante_id ? [calificadorId, calificado_id, Number(vacante_id)] : [calificadorId, calificado_id]
        );
      }
    }

    if (!relacion || relacion.length === 0) {
      return res.status(403).json({ error: 'Solo puedes calificar después de una relación aceptada' });
    }

    const vacanteGuardar = (esEspecialistaCaso || !vacante_id) ? null : Number(vacante_id);

    const existente = await query(
      'SELECT id FROM calificaciones WHERE calificador_id = ? AND calificado_id = ? AND (vacante_id = ? OR (vacante_id IS NULL AND ? IS NULL)) LIMIT 1',
      [calificadorId, calificado_id, vacanteGuardar, vacanteGuardar]
    );

    if (existente && existente.length > 0) {
      return res.status(409).json({ error: 'Ya calificaste a este usuario' });
    }

    await query(
      `INSERT INTO calificaciones (calificador_id, calificado_id, vacante_id, estrellas, comentario) VALUES (?, ?, ?, ?, ?)`,
      [calificadorId, calificado_id, vacanteGuardar, estrellas, comentario || null]
    );

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
    const isAdmin = req.user?.rol === 'admin';
    const calificaciones = isAdmin
      ? await query(`
          SELECT c.id, c.calificador_id, c.calificado_id, c.vacante_id, c.estrellas, c.comentario, c.created_at,
            u.nombre_completo as nombre_calificador
          FROM calificaciones c
          JOIN usuarios u ON u.id = c.calificador_id
          WHERE c.calificado_id = ?
          ORDER BY c.created_at DESC
        `, [usuario_id])
      : await query(`
          SELECT c.id, c.calificador_id, c.calificado_id, c.vacante_id, c.estrellas, c.created_at,
            u.nombre_completo as nombre_calificador
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
