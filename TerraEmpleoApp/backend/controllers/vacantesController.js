const { query } = require('../config/database');

// Crear vacante
async function crearVacante(req, res) {
  try {
    const empleadorId = req.user.id;
    const {
      titulo, descripcion, tipo_pago, monto_pago,
      departamento, municipio, vereda, urgente,
      cultivos, labores
    } = req.body;

    if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

    const result = await query(`
      INSERT INTO vacantes (empleador_id, titulo, descripcion, tipo_pago, monto_pago,
        departamento, municipio, vereda, urgente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [empleadorId, titulo, descripcion || null, tipo_pago || null, monto_pago || null,
        departamento || null, municipio || null, vereda || null, urgente ? 1 : 0]);

    const vacanteId = Number(result.insertId);

    // Insertar cultivos
    if (cultivos && Array.isArray(cultivos)) {
      for (const c of cultivos) {
        await query('INSERT INTO vacante_cultivos (vacante_id, cultivo) VALUES (?, ?)', [vacanteId, c]);
      }
    }

    // Insertar labores
    if (labores && Array.isArray(labores)) {
      for (const l of labores) {
        await query('INSERT INTO vacante_labores (vacante_id, labor) VALUES (?, ?)', [vacanteId, l]);
      }
    }

    // Ejecutar matching automático
    await ejecutarMatching(vacanteId);

    res.status(201).json({ message: 'Vacante creada exitosamente', vacanteId });
  } catch (err) {
    console.error('Error creando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Matching automático
async function ejecutarMatching(vacanteId) {
  try {
    // Obtener info de la vacante
    const vacantes = await query('SELECT * FROM vacantes WHERE id = ?', [vacanteId]);
    if (!vacantes || vacantes.length === 0) return;
    const vacante = vacantes[0];

    // Obtener cultivos y labores de la vacante
    const vCultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [vacanteId]);
    const vLabores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [vacanteId]);
    const cultivosVacante = vCultivos.map(c => c.cultivo.toLowerCase());
    const laboresVacante = vLabores.map(l => l.labor.toLowerCase());

    // Obtener todos los trabajadores activos con sus perfiles
    const trabajadores = await query(`
      SELECT u.id, u.nombre_completo, u.departamento, u.municipio, u.latitud, u.longitud,
        pt.id as perfil_id, pt.disponibilidad
      FROM usuarios u
      JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.rol = 'trabajador' AND u.activo = 1 AND u.verificado_sms = 1
    `);

    for (const trabajador of trabajadores) {
      let puntaje = 0;

      // 1. Coincidencia de cultivos (40 puntos max)
      const tCultivos = await query('SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?', [trabajador.perfil_id]);
      const cultivosTrabajador = tCultivos.map(c => c.cultivo.toLowerCase());
      const cultivosMatch = cultivosVacante.filter(c => cultivosTrabajador.includes(c));
      if (cultivosVacante.length > 0) {
        puntaje += (cultivosMatch.length / cultivosVacante.length) * 40;
      }

      // 2. Coincidencia de habilidades/labores (30 puntos max)
      const tHabilidades = await query('SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?', [trabajador.perfil_id]);
      const habilidadesTrabajador = tHabilidades.map(h => h.habilidad.toLowerCase());
      const laboresMatch = laboresVacante.filter(l => habilidadesTrabajador.includes(l));
      if (laboresVacante.length > 0) {
        puntaje += (laboresMatch.length / laboresVacante.length) * 30;
      }

      // 3. Coincidencia de ubicación (30 puntos max)
      if (vacante.departamento && trabajador.departamento) {
        if (vacante.departamento.toLowerCase() === trabajador.departamento.toLowerCase()) {
          puntaje += 15; // Mismo departamento
          if (vacante.municipio && trabajador.municipio &&
              vacante.municipio.toLowerCase() === trabajador.municipio.toLowerCase()) {
            puntaje += 15; // Mismo municipio
          }
        }
      }

      // Solo crear match si puntaje es >= 30
      if (puntaje >= 30) {
        // Verificar si ya existe postulación
        const existing = await query(
          'SELECT id FROM postulaciones WHERE vacante_id = ? AND trabajador_id = ?',
          [vacanteId, trabajador.id]
        );

        if (!existing || existing.length === 0) {
          await query(`
            INSERT INTO postulaciones (vacante_id, trabajador_id, estado, es_match_automatico, puntaje_match)
            VALUES (?, ?, 'match_auto', 1, ?)
          `, [vacanteId, trabajador.id, puntaje]);
        }
      }
    }

    console.log(`Matching ejecutado para vacante ${vacanteId}`);
  } catch (err) {
    console.error('Error en matching:', err);
  }
}

// Obtener vacantes del empleador
async function misVacantes(req, res) {
  try {
    const empleadorId = req.user.id;
    const vacantes = await query(`
      SELECT v.*, 
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      WHERE v.empleador_id = ?
      ORDER BY v.created_at DESC
    `, [empleadorId]);

    for (const v of vacantes) {
      // COUNT(*) y campos numéricos pueden venir como BigInt dependiendo del driver, así que normalizamos.
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago !== null && v.monto_pago !== undefined) {
        v.monto_pago = Number(v.monto_pago);
      }
      v.urgente = Boolean(v.urgente);

      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
    }

    res.json({ vacantes });
  } catch (err) {
    console.error('Error obteniendo vacantes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener todas las vacantes activas (para trabajadores)
async function listarVacantes(req, res) {
  try {
    const { departamento, municipio, cultivo, labor, urgente } = req.query;
    let sql = `
      SELECT v.*, u.nombre_completo as nombre_empleador,
        pe.nombre_empresa_finca,
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE v.estado = 'activa'
    `;
    const params = [];

    if (departamento) {
      sql += ' AND v.departamento = ?';
      params.push(departamento);
    }
    if (municipio) {
      sql += ' AND v.municipio = ?';
      params.push(municipio);
    }
    if (urgente === 'true' || urgente === '1') {
      sql += ' AND v.urgente = 1';
    }
    if (cultivo) {
      sql += ' AND v.id IN (SELECT vacante_id FROM vacante_cultivos WHERE LOWER(cultivo) = LOWER(?))';
      params.push(cultivo);
    }
    if (labor) {
      sql += ' AND v.id IN (SELECT vacante_id FROM vacante_labores WHERE LOWER(labor) = LOWER(?))';
      params.push(labor);
    }

    sql += ' ORDER BY v.urgente DESC, v.created_at DESC';

    const vacantes = await query(sql, params);

    for (const v of vacantes) {
      // Normalizar BigInt y campos numéricos
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago !== null && v.monto_pago !== undefined) {
        v.monto_pago = Number(v.monto_pago);
      }
      v.urgente = Boolean(v.urgente);
      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
    }

    res.json({ vacantes });
  } catch (err) {
    console.error('Error listando vacantes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener detalle de una vacante
async function detalleVacante(req, res) {
  try {
    const { id } = req.params;
    const vacantes = await query(`
      SELECT v.*, u.nombre_completo as nombre_empleador,
        pe.nombre_empresa_finca, pe.ofrece_alojamiento, pe.ofrece_alimentacion, pe.beneficios_extra
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE v.id = ?
    `, [id]);

    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const vacante = vacantes[0];
    // Normalizar BigInt
    if (vacante.monto_pago !== null && vacante.monto_pago !== undefined) {
      vacante.monto_pago = Number(vacante.monto_pago);
    }
    vacante.urgente = Boolean(vacante.urgente);
    vacante.ofrece_alojamiento = Boolean(vacante.ofrece_alojamiento);
    vacante.ofrece_alimentacion = Boolean(vacante.ofrece_alimentacion);
    vacante.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [id]);
    vacante.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [id]);

    res.json({ vacante });
  } catch (err) {
    console.error('Error obteniendo detalle:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Postularse a una vacante
async function postularse(req, res) {
  try {
    const trabajadorId = req.user.id;
    const { vacante_id, mensaje } = req.body;

    if (!vacante_id) return res.status(400).json({ error: 'vacante_id es obligatorio' });

    // Verificar que la vacante existe y está activa
    const vacantes = await query('SELECT id FROM vacantes WHERE id = ? AND estado = ?', [vacante_id, 'activa']);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada o no está activa' });
    }

    // Verificar si ya se postuló
    const existing = await query('SELECT id, estado FROM postulaciones WHERE vacante_id = ? AND trabajador_id = ?', [vacante_id, trabajadorId]);
    if (existing && existing.length > 0) {
      if (existing[0].estado === 'match_auto') {
        // Actualizar match automático a postulación manual
        await query('UPDATE postulaciones SET estado = ?, mensaje = ? WHERE id = ?', ['pendiente', mensaje || null, existing[0].id]);
        return res.json({ message: 'Postulación confirmada (ya tenías match automático)' });
      }
      return res.status(409).json({ error: 'Ya te postulaste a esta vacante' });
    }

    await query(`
      INSERT INTO postulaciones (vacante_id, trabajador_id, estado, mensaje)
      VALUES (?, ?, 'pendiente', ?)
    `, [vacante_id, trabajadorId, mensaje || null]);

    res.status(201).json({ message: 'Postulación enviada exitosamente' });
  } catch (err) {
    console.error('Error en postulación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Ver postulaciones de una vacante (para empleador)
async function verPostulaciones(req, res) {
  try {
    const { vacante_id } = req.params;
    const empleadorId = req.user.id;

    // Verificar que la vacante pertenece al empleador
    const vacantes = await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [vacante_id, empleadorId]);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const postulaciones = await query(`
      SELECT p.*, u.nombre_completo, u.celular, u.departamento, u.municipio,
        u.calificacion_promedio, u.foto_selfie,
        pt.nivel_estudios, pt.anios_experiencia, pt.disponibilidad
      FROM postulaciones p
      JOIN usuarios u ON u.id = p.trabajador_id
      LEFT JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE p.vacante_id = ?
      ORDER BY p.puntaje_match DESC, p.created_at ASC
    `, [vacante_id]);

    res.json({ postulaciones });
  } catch (err) {
    console.error('Error obteniendo postulaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualizar estado de postulación
async function actualizarPostulacion(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const empleadorId = req.user.id;

    if (!['aceptada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Use: aceptada o rechazada' });
    }

    // Verificar que la postulación pertenece a una vacante del empleador
    const posts = await query(`
      SELECT p.id FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      WHERE p.id = ? AND v.empleador_id = ?
    `, [id, empleadorId]);

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Postulación no encontrada' });
    }

    await query('UPDATE postulaciones SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ message: `Postulación ${estado}` });
  } catch (err) {
    console.error('Error actualizando postulación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Mis postulaciones (para trabajador)
async function misPostulaciones(req, res) {
  try {
    const trabajadorId = req.user.id;
    const postulaciones = await query(`
      SELECT p.*, v.titulo, v.departamento, v.municipio, v.tipo_pago, v.urgente, v.estado as estado_vacante,
        pe.nombre_empresa_finca
      FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE p.trabajador_id = ?
      ORDER BY p.created_at DESC
    `, [trabajadorId]);

    res.json({ postulaciones });
  } catch (err) {
    console.error('Error obteniendo mis postulaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Cerrar vacante
async function cerrarVacante(req, res) {
  try {
    const { id } = req.params;
    const empleadorId = req.user.id;

    await query('UPDATE vacantes SET estado = ? WHERE id = ? AND empleador_id = ?', ['cerrada', id, empleadorId]);
    res.json({ message: 'Vacante cerrada' });
  } catch (err) {
    console.error('Error cerrando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearVacante, misVacantes, listarVacantes, detalleVacante,
  postularse, verPostulaciones, actualizarPostulacion,
  misPostulaciones, cerrarVacante
};
