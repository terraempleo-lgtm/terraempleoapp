const { query } = require('../config/database');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function asegurarPropiedadJornada(jornadaId, empleadorId) {
  const rows = await query(
    'SELECT id, empleador_id FROM cuaderno_jornadas WHERE id = ?',
    [jornadaId]
  );
  const j = rows && rows[0];
  if (!j) return { ok: false, status: 404, error: 'Jornada no encontrada' };
  if (Number(j.empleador_id) !== Number(empleadorId)) {
    return { ok: false, status: 403, error: 'No tienes acceso a esta jornada' };
  }
  return { ok: true };
}

function calcPago({ tipo_pago, cantidad_kg, horas, precio_jornal, precio_kilo, estado, descuento_alimentacion, descuento_otro }) {
  if (estado === 'cancelado') return 0;
  const kg = Number(cantidad_kg) || 0;
  const pk = Number(precio_kilo) || 0;
  const pj = Number(precio_jornal) || 0;
  let base = 0;
  if (tipo_pago === 'por_kilo') base = kg * pk;
  else if (tipo_pago === 'jornal') {
    if (estado === 'parcial' && horas != null) {
      // parcial: prorratea sobre 8 horas
      const h = Number(horas) || 0;
      base = pj * (h / 8);
    } else {
      base = pj;
    }
  } else if (tipo_pago === 'mixto') base = pj + kg * pk;
  // Descuentos (alimentación tomada, adelantos u otros): nunca dejar el pago negativo.
  const desc = (Number(descuento_alimentacion) || 0) + (Number(descuento_otro) || 0);
  return Math.max(0, Math.round((base - desc) * 100) / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// JORNADAS
// ─────────────────────────────────────────────────────────────────────────────

async function listarJornadas(req, res) {
  try {
    const empleadorId = req.user.id;
    const { desde, hasta, estado, vacante_id } = req.query;
    const where = ['j.empleador_id = ?'];
    const params = [empleadorId];
    if (desde) { where.push('j.fecha >= ?'); params.push(desde); }
    if (hasta) { where.push('j.fecha <= ?'); params.push(hasta); }
    if (estado) { where.push('j.estado = ?'); params.push(estado); }
    if (vacante_id) { where.push('j.vacante_id = ?'); params.push(Number(vacante_id)); }

    const rows = await query(`
      SELECT j.*, v.titulo AS vacante_titulo,
        (SELECT COUNT(*) FROM cuaderno_asistencias a WHERE a.jornada_id = j.id) AS total_trabajadores,
        (SELECT COUNT(*) FROM cuaderno_asistencias a WHERE a.jornada_id = j.id AND a.estado IN ('llego','llego_tarde')) AS asistieron,
        (SELECT COALESCE(SUM(r.pago_total),0) FROM cuaderno_registros_trabajo r WHERE r.jornada_id = j.id) AS total_pagado,
        (SELECT COALESCE(SUM(r.cantidad_kg),0) FROM cuaderno_registros_trabajo r WHERE r.jornada_id = j.id) AS total_kg
      FROM cuaderno_jornadas j
      LEFT JOIN vacantes v ON v.id = j.vacante_id
      WHERE ${where.join(' AND ')}
      ORDER BY j.fecha DESC, j.id DESC
    `, params);

    res.json({ jornadas: rows || [] });
  } catch (err) {
    console.error('listarJornadas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearJornada(req, res) {
  try {
    const empleadorId = req.user.id;
    const {
      fecha, titulo, finca, tipo_trabajo, vacante_id,
      tipo_pago_default, precio_jornal, precio_kilo,
      costos_generales, observaciones, importar_postulantes
    } = req.body;

    if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria' });

    // Validar que la vacante (si viene) pertenezca al empleador
    if (vacante_id) {
      const v = await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [vacante_id, empleadorId]);
      if (!v || v.length === 0) {
        return res.status(403).json({ error: 'La vacante no te pertenece' });
      }
    }

    const result = await query(`
      INSERT INTO cuaderno_jornadas
        (empleador_id, vacante_id, fecha, titulo, finca, tipo_trabajo,
         tipo_pago_default, precio_jornal, precio_kilo, costos_generales, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empleadorId,
      vacante_id || null,
      fecha,
      titulo || null,
      finca || null,
      tipo_trabajo || null,
      tipo_pago_default || 'jornal',
      precio_jornal || null,
      precio_kilo || null,
      costos_generales || 0,
      observaciones || null,
    ]);

    const jornadaId = Number(result.insertId);

    // Importar postulantes aceptados/match_auto si se solicita
    if (importar_postulantes && vacante_id) {
      const postulantes = await query(`
        SELECT trabajador_id FROM postulaciones
        WHERE vacante_id = ? AND estado IN ('aceptada','match_auto','contacto_solicitado')
      `, [vacante_id]);
      for (const p of postulantes || []) {
        await query(
          'INSERT INTO cuaderno_asistencias (jornada_id, trabajador_id, estado) VALUES (?, ?, ?)',
          [jornadaId, p.trabajador_id, 'pendiente']
        );
      }
    }

    res.status(201).json({ message: 'Jornada creada', id: jornadaId });
  } catch (err) {
    console.error('crearJornada:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function detalleJornada(req, res) {
  try {
    const empleadorId = req.user.id;
    const jornadaId = Number(req.params.id);

    const guard = await asegurarPropiedadJornada(jornadaId, empleadorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const jornadas = await query(`
      SELECT j.*, v.titulo AS vacante_titulo, v.municipio, v.departamento
      FROM cuaderno_jornadas j
      LEFT JOIN vacantes v ON v.id = j.vacante_id
      WHERE j.id = ?
    `, [jornadaId]);
    const jornada = jornadas?.[0];

    const asistencias = await query(`
      SELECT a.*,
        u.nombre_completo AS trabajador_nombre,
        u.celular AS trabajador_celular,
        u.foto_selfie AS trabajador_foto,
        u.calificacion_promedio AS trabajador_calif,
        r.id AS registro_id, r.cantidad_kg, r.horas, r.tipo_pago, r.precio_jornal AS r_precio_jornal,
        r.precio_kilo AS r_precio_kilo, r.pago_total, r.pagado, r.estado AS registro_estado, r.notas AS registro_notas,
        r.descuento_alimentacion, r.descuento_otro, r.descuento_nota,
        c.id AS calificacion_id, c.nivel AS calif_nivel, c.comentario AS calif_comentario
      FROM cuaderno_asistencias a
      LEFT JOIN usuarios u ON u.id = a.trabajador_id
      LEFT JOIN cuaderno_registros_trabajo r ON r.asistencia_id = a.id
      LEFT JOIN cuaderno_calificaciones_internas c ON c.asistencia_id = a.id
      WHERE a.jornada_id = ?
      ORDER BY (a.estado = 'pendiente') DESC, COALESCE(u.nombre_completo, a.manual_nombre) ASC
    `, [jornadaId]);

    res.json({ jornada, asistencias: asistencias || [] });
  } catch (err) {
    console.error('detalleJornada:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarJornada(req, res) {
  try {
    const empleadorId = req.user.id;
    const jornadaId = Number(req.params.id);
    const guard = await asegurarPropiedadJornada(jornadaId, empleadorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const campos = ['fecha','titulo','finca','tipo_trabajo','tipo_pago_default','precio_jornal','precio_kilo','costos_generales','observaciones','estado'];
    const sets = [];
    const params = [];
    for (const c of campos) {
      if (req.body[c] !== undefined) {
        sets.push(`${c} = ?`);
        params.push(req.body[c]);
      }
    }
    if (sets.length === 0) return res.json({ message: 'Sin cambios' });
    if (req.body.estado === 'cerrada') sets.push('cerrada_at = CURRENT_TIMESTAMP');
    params.push(jornadaId);

    await query(`UPDATE cuaderno_jornadas SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Jornada actualizada' });
  } catch (err) {
    console.error('actualizarJornada:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarJornada(req, res) {
  try {
    const empleadorId = req.user.id;
    const jornadaId = Number(req.params.id);
    const guard = await asegurarPropiedadJornada(jornadaId, empleadorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });
    await query('DELETE FROM cuaderno_jornadas WHERE id = ?', [jornadaId]);
    res.json({ message: 'Jornada eliminada' });
  } catch (err) {
    console.error('eliminarJornada:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ASISTENCIAS
// ─────────────────────────────────────────────────────────────────────────────

async function agregarAsistencia(req, res) {
  try {
    const empleadorId = req.user.id;
    const jornadaId = Number(req.params.id);
    const guard = await asegurarPropiedadJornada(jornadaId, empleadorId);
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const { trabajador_id, trabajador_externo_id, manual_nombre, manual_telefono, estado } = req.body;
    if (!trabajador_id && !trabajador_externo_id && !manual_nombre) {
      return res.status(400).json({ error: 'Debes indicar trabajador_id, trabajador_externo_id o manual_nombre' });
    }

    // Evitar duplicar si ya está en la jornada
    if (trabajador_id) {
      const dup = await query(
        'SELECT id FROM cuaderno_asistencias WHERE jornada_id = ? AND trabajador_id = ?',
        [jornadaId, trabajador_id]
      );
      if (dup && dup.length) return res.status(409).json({ error: 'Este trabajador ya está en la jornada' });
    }
    if (trabajador_externo_id) {
      const dup = await query(
        'SELECT id FROM cuaderno_asistencias WHERE jornada_id = ? AND trabajador_externo_id = ?',
        [jornadaId, trabajador_externo_id]
      );
      if (dup && dup.length) return res.status(409).json({ error: 'Este trabajador ya está en la jornada' });
    }

    // Si viene un externo, usar su nombre/teléfono guardados para mantener
    // manual_nombre/manual_telefono consistentes con vistas que aún no leen el enlace.
    let nombreFinal = manual_nombre || null;
    let telefonoFinal = manual_telefono || null;
    if (trabajador_externo_id) {
      const ext = await query('SELECT nombre_completo, celular FROM trabajadores_externos WHERE id = ?', [trabajador_externo_id]);
      if (!ext || !ext.length) return res.status(404).json({ error: 'Trabajador externo no encontrado' });
      nombreFinal = ext[0].nombre_completo;
      telefonoFinal = ext[0].celular || telefonoFinal;
    }

    const result = await query(`
      INSERT INTO cuaderno_asistencias (jornada_id, trabajador_id, trabajador_externo_id, manual_nombre, manual_telefono, estado)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [jornadaId, trabajador_id || null, trabajador_externo_id || null, nombreFinal, telefonoFinal, estado || 'pendiente']);

    res.status(201).json({ message: 'Trabajador agregado', id: Number(result.insertId) });
  } catch (err) {
    console.error('agregarAsistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarAsistencia(req, res) {
  try {
    const empleadorId = req.user.id;
    const asisId = Number(req.params.asisId);

    const rows = await query(`
      SELECT a.id, j.empleador_id, a.jornada_id FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      WHERE a.id = ?
    `, [asisId]);
    const a = rows?.[0];
    if (!a) return res.status(404).json({ error: 'Asistencia no encontrada' });
    if (Number(a.empleador_id) !== Number(empleadorId)) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    const campos = ['estado','hora_llegada','hora_salida','notas'];
    const sets = [];
    const params = [];
    for (const c of campos) {
      if (req.body[c] !== undefined) {
        sets.push(`${c} = ?`);
        params.push(req.body[c]);
      }
    }
    // Check-in automático: si marca que llegó y no se envió hora, guardar la hora actual.
    if (['llego', 'llego_tarde'].includes(req.body.estado) && req.body.hora_llegada === undefined) {
      sets.push('hora_llegada = COALESCE(hora_llegada, CURRENT_TIME)');
    }
    if (!sets.length) return res.json({ message: 'Sin cambios' });
    params.push(asisId);
    await query(`UPDATE cuaderno_asistencias SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Asistencia actualizada' });
  } catch (err) {
    console.error('actualizarAsistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarAsistencia(req, res) {
  try {
    const empleadorId = req.user.id;
    const asisId = Number(req.params.asisId);
    const rows = await query(`
      SELECT a.id, j.empleador_id FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      WHERE a.id = ?
    `, [asisId]);
    const a = rows?.[0];
    if (!a) return res.status(404).json({ error: 'Asistencia no encontrada' });
    if (Number(a.empleador_id) !== Number(empleadorId)) {
      return res.status(403).json({ error: 'Sin acceso' });
    }
    await query('DELETE FROM cuaderno_asistencias WHERE id = ?', [asisId]);
    res.json({ message: 'Asistencia eliminada' });
  } catch (err) {
    console.error('eliminarAsistencia:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTROS DE TRABAJO
// ─────────────────────────────────────────────────────────────────────────────

async function upsertRegistroTrabajo(req, res) {
  try {
    const empleadorId = req.user.id;
    const asisId = Number(req.params.asisId);

    const rows = await query(`
      SELECT a.id, a.jornada_id, j.empleador_id, j.precio_jornal AS j_pj, j.precio_kilo AS j_pk, j.tipo_pago_default
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      WHERE a.id = ?
    `, [asisId]);
    const a = rows?.[0];
    if (!a) return res.status(404).json({ error: 'Asistencia no encontrada' });
    if (Number(a.empleador_id) !== Number(empleadorId)) {
      return res.status(403).json({ error: 'Sin acceso' });
    }

    const {
      cantidad_kg, horas, tipo_pago, precio_jornal, precio_kilo,
      estado, notas, pagado, descuento_alimentacion, descuento_otro, descuento_nota
    } = req.body;

    const tipo = tipo_pago || a.tipo_pago_default || 'jornal';
    const pj = precio_jornal != null ? Number(precio_jornal) : (a.j_pj || 0);
    const pk = precio_kilo != null ? Number(precio_kilo) : (a.j_pk || 0);
    const est = estado || 'completo';
    const descAlim = Number(descuento_alimentacion) || 0;
    const descOtro = Number(descuento_otro) || 0;
    const pagoTotal = calcPago({
      tipo_pago: tipo,
      cantidad_kg, horas,
      precio_jornal: pj,
      precio_kilo: pk,
      estado: est,
      descuento_alimentacion: descAlim,
      descuento_otro: descOtro,
    });

    const existentes = await query(
      'SELECT id FROM cuaderno_registros_trabajo WHERE asistencia_id = ?',
      [asisId]
    );

    if (existentes && existentes.length) {
      await query(`
        UPDATE cuaderno_registros_trabajo SET
          cantidad_kg = ?, horas = ?, tipo_pago = ?, precio_jornal = ?, precio_kilo = ?,
          pago_total = ?, estado = ?, notas = ?, pagado = ?,
          descuento_alimentacion = ?, descuento_otro = ?, descuento_nota = ?
        WHERE asistencia_id = ?
      `, [
        cantidad_kg ?? null, horas ?? null, tipo, pj, pk,
        pagoTotal, est, notas || null, pagado ? 1 : 0,
        descAlim, descOtro, descuento_nota || null,
        asisId,
      ]);
      return res.json({ message: 'Registro actualizado', pago_total: pagoTotal });
    }

    await query(`
      INSERT INTO cuaderno_registros_trabajo
        (asistencia_id, jornada_id, cantidad_kg, horas, tipo_pago,
         precio_jornal, precio_kilo, pago_total, estado, notas, pagado,
         descuento_alimentacion, descuento_otro, descuento_nota)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      asisId, a.jornada_id, cantidad_kg ?? null, horas ?? null, tipo,
      pj, pk, pagoTotal, est, notas || null, pagado ? 1 : 0,
      descAlim, descOtro, descuento_nota || null,
    ]);

    res.status(201).json({ message: 'Registro creado', pago_total: pagoTotal });
  } catch (err) {
    console.error('upsertRegistroTrabajo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function marcarPagado(req, res) {
  try {
    const empleadorId = req.user.id;
    const asisId = Number(req.params.asisId);
    const { pagado } = req.body;
    const rows = await query(`
      SELECT a.id, j.empleador_id FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id WHERE a.id = ?
    `, [asisId]);
    const a = rows?.[0];
    if (!a) return res.status(404).json({ error: 'Asistencia no encontrada' });
    if (Number(a.empleador_id) !== Number(empleadorId)) return res.status(403).json({ error: 'Sin acceso' });

    await query(`
      UPDATE cuaderno_registros_trabajo
      SET pagado = ?, pagado_at = ${pagado ? 'CURRENT_TIMESTAMP' : 'NULL'}
      WHERE asistencia_id = ?
    `, [pagado ? 1 : 0, asisId]);
    res.json({ message: 'Estado de pago actualizado' });
  } catch (err) {
    console.error('marcarPagado:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CALIFICACIONES INTERNAS
// ─────────────────────────────────────────────────────────────────────────────

async function upsertCalificacion(req, res) {
  try {
    const empleadorId = req.user.id;
    const asisId = Number(req.params.asisId);
    const { nivel, comentario } = req.body;
    if (!['bien','regular','mal'].includes(nivel)) {
      return res.status(400).json({ error: 'Nivel inválido' });
    }
    const rows = await query(`
      SELECT a.id, a.trabajador_id, a.jornada_id, j.empleador_id
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      WHERE a.id = ?
    `, [asisId]);
    const a = rows?.[0];
    if (!a) return res.status(404).json({ error: 'Asistencia no encontrada' });
    if (Number(a.empleador_id) !== Number(empleadorId)) return res.status(403).json({ error: 'Sin acceso' });

    const exist = await query('SELECT id FROM cuaderno_calificaciones_internas WHERE asistencia_id = ?', [asisId]);
    if (exist && exist.length) {
      await query(
        'UPDATE cuaderno_calificaciones_internas SET nivel = ?, comentario = ? WHERE asistencia_id = ?',
        [nivel, comentario || null, asisId]
      );
      return res.json({ message: 'Calificación actualizada' });
    }
    await query(`
      INSERT INTO cuaderno_calificaciones_internas
        (asistencia_id, jornada_id, empleador_id, trabajador_id, nivel, comentario)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [asisId, a.jornada_id, empleadorId, a.trabajador_id || null, nivel, comentario || null]);
    res.status(201).json({ message: 'Calificación guardada' });
  } catch (err) {
    console.error('upsertCalificacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTAS LIBRES DEL EMPLEADOR
// ─────────────────────────────────────────────────────────────────────────────

async function crearNota(req, res) {
  try {
    const empleadorId = req.user.id;
    const { trabajador_id, manual_nombre, nota, tipo } = req.body;
    if (!nota) return res.status(400).json({ error: 'La nota es obligatoria' });
    const result = await query(`
      INSERT INTO cuaderno_notas_trabajador (empleador_id, trabajador_id, manual_nombre, nota, tipo)
      VALUES (?, ?, ?, ?, ?)
    `, [empleadorId, trabajador_id || null, manual_nombre || null, nota, tipo || 'observacion']);
    res.status(201).json({ message: 'Nota creada', id: Number(result.insertId) });
  } catch (err) {
    console.error('crearNota:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarNota(req, res) {
  try {
    const empleadorId = req.user.id;
    const notaId = Number(req.params.id);
    const rows = await query('SELECT empleador_id FROM cuaderno_notas_trabajador WHERE id = ?', [notaId]);
    if (!rows?.length) return res.status(404).json({ error: 'Nota no encontrada' });
    if (Number(rows[0].empleador_id) !== Number(empleadorId)) return res.status(403).json({ error: 'Sin acceso' });
    await query('DELETE FROM cuaderno_notas_trabajador WHERE id = ?', [notaId]);
    res.json({ message: 'Nota eliminada' });
  } catch (err) {
    console.error('eliminarNota:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD + ANALÍTICA
// ─────────────────────────────────────────────────────────────────────────────

async function dashboard(req, res) {
  try {
    const empleadorId = req.user.id;
    const hoy = new Date();
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7);
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const [resumen] = await query(`
      SELECT
        (SELECT COUNT(*) FROM cuaderno_jornadas WHERE empleador_id = ?) AS jornadas_total,
        (SELECT COUNT(*) FROM cuaderno_jornadas WHERE empleador_id = ? AND estado = 'planeada') AS jornadas_pendientes,
        (SELECT COUNT(*) FROM cuaderno_jornadas WHERE empleador_id = ? AND estado = 'en_curso') AS jornadas_activas,
        (SELECT COUNT(*) FROM cuaderno_jornadas WHERE empleador_id = ? AND estado = 'cerrada') AS jornadas_cerradas,
        (SELECT COUNT(DISTINCT COALESCE(a.trabajador_id, CONCAT('m_', a.manual_nombre)))
           FROM cuaderno_asistencias a
           JOIN cuaderno_jornadas j ON j.id = a.jornada_id
           WHERE j.empleador_id = ? AND a.estado IN ('llego','llego_tarde')) AS trabajadores_contratados,
        (SELECT COALESCE(SUM(r.pago_total),0)
           FROM cuaderno_registros_trabajo r
           JOIN cuaderno_jornadas j ON j.id = r.jornada_id
           WHERE j.empleador_id = ?) AS total_pagado,
        (SELECT COALESCE(SUM(r.cantidad_kg),0)
           FROM cuaderno_registros_trabajo r
           JOIN cuaderno_jornadas j ON j.id = r.jornada_id
           WHERE j.empleador_id = ?) AS total_kg,
        (SELECT COUNT(*)
           FROM cuaderno_asistencias a
           JOIN cuaderno_jornadas j ON j.id = a.jornada_id
           WHERE j.empleador_id = ? AND a.estado IN ('llego','llego_tarde')) AS asistencias_total,
        (SELECT COUNT(*)
           FROM cuaderno_asistencias a
           JOIN cuaderno_jornadas j ON j.id = a.jornada_id
           WHERE j.empleador_id = ? AND a.estado IN ('llego','llego_tarde','no_llego','cancelo')) AS asistencias_evaluables
    `, [empleadorId, empleadorId, empleadorId, empleadorId, empleadorId, empleadorId, empleadorId, empleadorId, empleadorId]);

    // Promedio asistencia (porcentaje)
    const asistenciasTotal = Number(resumen?.asistencias_total || 0);
    const asistenciasEval = Number(resumen?.asistencias_evaluables || 0);
    const promedio_asistencia = asistenciasEval > 0
      ? Math.round((asistenciasTotal * 100) / asistenciasEval)
      : 0;

    // Rendimiento por tipo de trabajo
    const rendimientoTipo = await query(`
      SELECT COALESCE(j.tipo_trabajo, 'Sin especificar') AS tipo,
        COUNT(DISTINCT j.id) AS jornadas,
        COALESCE(SUM(r.cantidad_kg),0) AS kg,
        COALESCE(SUM(r.pago_total),0) AS pago
      FROM cuaderno_jornadas j
      LEFT JOIN cuaderno_registros_trabajo r ON r.jornada_id = j.id
      WHERE j.empleador_id = ?
      GROUP BY tipo
      ORDER BY pago DESC
      LIMIT 8
    `, [empleadorId]);

    // Top trabajadores (por calificación + asistencia)
    const topTrabajadores = await query(`
      SELECT
        a.trabajador_id,
        COALESCE(u.nombre_completo, a.manual_nombre) AS nombre,
        u.foto_selfie AS foto,
        COUNT(*) AS jornadas,
        SUM(CASE WHEN a.estado IN ('llego','llego_tarde') THEN 1 ELSE 0 END) AS asistio,
        SUM(CASE WHEN c.nivel = 'bien' THEN 1 ELSE 0 END) AS calif_bien,
        SUM(CASE WHEN c.nivel = 'regular' THEN 1 ELSE 0 END) AS calif_regular,
        SUM(CASE WHEN c.nivel = 'mal' THEN 1 ELSE 0 END) AS calif_mal,
        COALESCE(SUM(r.pago_total),0) AS total_pagado,
        COALESCE(SUM(r.cantidad_kg),0) AS total_kg
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      LEFT JOIN usuarios u ON u.id = a.trabajador_id
      LEFT JOIN cuaderno_calificaciones_internas c ON c.asistencia_id = a.id
      LEFT JOIN cuaderno_registros_trabajo r ON r.asistencia_id = a.id
      WHERE j.empleador_id = ?
      GROUP BY a.trabajador_id, nombre, foto
      HAVING jornadas > 0
      ORDER BY calif_bien DESC, asistio DESC, total_kg DESC
      LIMIT 10
    `, [empleadorId]);

    // Historial de pagos (últimos 20)
    const historialPagos = await query(`
      SELECT r.id, r.pago_total, r.pagado, r.pagado_at, r.created_at,
        j.fecha, j.titulo AS jornada_titulo, j.finca,
        COALESCE(u.nombre_completo, a.manual_nombre) AS trabajador
      FROM cuaderno_registros_trabajo r
      JOIN cuaderno_jornadas j ON j.id = r.jornada_id
      JOIN cuaderno_asistencias a ON a.id = r.asistencia_id
      LEFT JOIN usuarios u ON u.id = a.trabajador_id
      WHERE j.empleador_id = ?
      ORDER BY j.fecha DESC, r.id DESC
      LIMIT 20
    `, [empleadorId]);

    // Tendencia semanal últimos 8 semanas: jornadas + pago
    const semanal = await query(`
      SELECT YEARWEEK(j.fecha, 1) AS semana,
        MIN(j.fecha) AS desde,
        COUNT(DISTINCT j.id) AS jornadas,
        COALESCE(SUM(r.pago_total),0) AS pago,
        COALESCE(SUM(r.cantidad_kg),0) AS kg
      FROM cuaderno_jornadas j
      LEFT JOIN cuaderno_registros_trabajo r ON r.jornada_id = j.id
      WHERE j.empleador_id = ? AND j.fecha >= ?
      GROUP BY semana
      ORDER BY semana ASC
    `, [empleadorId, fmt(new Date(hoy.getTime() - 1000 * 60 * 60 * 24 * 56))]);

    // Tendencia mensual últimos 6 meses
    const mensual = await query(`
      SELECT DATE_FORMAT(j.fecha, '%Y-%m') AS mes,
        COUNT(DISTINCT j.id) AS jornadas,
        COALESCE(SUM(r.pago_total),0) AS pago,
        COALESCE(SUM(r.cantidad_kg),0) AS kg
      FROM cuaderno_jornadas j
      LEFT JOIN cuaderno_registros_trabajo r ON r.jornada_id = j.id
      WHERE j.empleador_id = ?
      GROUP BY mes
      ORDER BY mes DESC
      LIMIT 6
    `, [empleadorId]);

    // Por finca (comparativa)
    const porFinca = await query(`
      SELECT COALESCE(j.finca, 'Sin finca') AS finca,
        COUNT(DISTINCT j.id) AS jornadas,
        COALESCE(SUM(r.pago_total),0) AS pago,
        COALESCE(SUM(r.cantidad_kg),0) AS kg
      FROM cuaderno_jornadas j
      LEFT JOIN cuaderno_registros_trabajo r ON r.jornada_id = j.id
      WHERE j.empleador_id = ?
      GROUP BY finca
      ORDER BY pago DESC
      LIMIT 8
    `, [empleadorId]);

    // Próximas jornadas
    const proximas = await query(`
      SELECT j.id, j.fecha, j.titulo, j.finca, j.estado,
        (SELECT COUNT(*) FROM cuaderno_asistencias a WHERE a.jornada_id = j.id) AS total_trabajadores
      FROM cuaderno_jornadas j
      WHERE j.empleador_id = ? AND j.fecha >= ? AND j.estado <> 'cerrada'
      ORDER BY j.fecha ASC
      LIMIT 5
    `, [empleadorId, fmt(hoy)]);

    res.json({
      resumen: { ...(resumen || {}), promedio_asistencia },
      rendimiento_tipo: rendimientoTipo || [],
      top_trabajadores: topTrabajadores || [],
      historial_pagos: historialPagos || [],
      semanal: semanal || [],
      mensual: mensual || [],
      por_finca: porFinca || [],
      proximas_jornadas: proximas || [],
    });
  } catch (err) {
    console.error('dashboard cuaderno:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE TRABAJADOR
// ─────────────────────────────────────────────────────────────────────────────

async function historialTrabajador(req, res) {
  try {
    const empleadorId = req.user.id;
    const trabajadorId = Number(req.params.id);

    const [usuario] = await query(`
      SELECT id, nombre_completo, celular, foto_selfie, calificacion_promedio, total_calificaciones,
        departamento, municipio
      FROM usuarios WHERE id = ?
    `, [trabajadorId]);
    if (!usuario) return res.status(404).json({ error: 'Trabajador no encontrado' });

    const jornadas = await query(`
      SELECT j.id, j.fecha, j.titulo, j.finca, j.tipo_trabajo, j.estado AS jornada_estado,
        a.id AS asistencia_id, a.estado AS asistencia_estado, a.notas AS asistencia_notas,
        r.cantidad_kg, r.horas, r.pago_total, r.estado AS registro_estado, r.pagado,
        c.nivel AS calif_nivel, c.comentario AS calif_comentario
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      LEFT JOIN cuaderno_registros_trabajo r ON r.asistencia_id = a.id
      LEFT JOIN cuaderno_calificaciones_internas c ON c.asistencia_id = a.id
      WHERE j.empleador_id = ? AND a.trabajador_id = ?
      ORDER BY j.fecha DESC
    `, [empleadorId, trabajadorId]);

    const notas = await query(`
      SELECT * FROM cuaderno_notas_trabajador
      WHERE empleador_id = ? AND trabajador_id = ?
      ORDER BY created_at DESC
    `, [empleadorId, trabajadorId]);

    // Métricas
    const total = (jornadas || []).length;
    let asistio = 0, faltas = 0, tarde = 0, cancelo = 0;
    let totalPagado = 0, totalKg = 0, totalHoras = 0;
    let califBien = 0, califRegular = 0, califMal = 0;
    for (const j of jornadas || []) {
      if (j.asistencia_estado === 'llego') asistio++;
      else if (j.asistencia_estado === 'llego_tarde') { asistio++; tarde++; }
      else if (j.asistencia_estado === 'no_llego') faltas++;
      else if (j.asistencia_estado === 'cancelo') cancelo++;
      totalPagado += Number(j.pago_total || 0);
      totalKg += Number(j.cantidad_kg || 0);
      totalHoras += Number(j.horas || 0);
      if (j.calif_nivel === 'bien') califBien++;
      else if (j.calif_nivel === 'regular') califRegular++;
      else if (j.calif_nivel === 'mal') califMal++;
    }
    const evaluables = asistio + faltas + cancelo;
    const promedio_asistencia = evaluables > 0 ? Math.round((asistio * 100) / evaluables) : 0;

    res.json({
      usuario,
      metricas: {
        total_jornadas: total,
        asistio, faltas, tarde, cancelo,
        promedio_asistencia,
        total_pagado: Math.round(totalPagado * 100) / 100,
        total_kg: Math.round(totalKg * 100) / 100,
        total_horas: Math.round(totalHoras * 100) / 100,
        calif_bien: califBien,
        calif_regular: califRegular,
        calif_mal: califMal,
      },
      jornadas: jornadas || [],
      notas: notas || [],
    });
  } catch (err) {
    console.error('historialTrabajador:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Postulantes aceptados de una vacante (para preseleccionar al crear jornada)
// Registro de trabajadores del empleador: todos los que han pasado por sus
// jornadas (registrados en la plataforma y externos/manuales), con conteo de
// jornadas y última fecha. Sirve para seleccionarlos sin escribir al crear
// una jornada nueva.
// Crea (o reutiliza, si ya existe por cédula) un trabajador externo — persona
// sin cuenta en TerraEmpleo identificada por cédula, para que su experiencia
// se acumule entre fincas distintas hasta que se registre.
async function crearTrabajadorExterno(req, res) {
  try {
    const empleadorId = req.user.id;
    const { nombre_completo, cedula, celular } = req.body;
    if (!nombre_completo || !String(nombre_completo).trim()) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio' });
    }
    if (!cedula || !String(cedula).trim()) {
      return res.status(400).json({ error: 'La cédula es obligatoria' });
    }
    const cedulaNorm = String(cedula).trim();

    const existente = await query('SELECT id, nombre_completo, cedula FROM trabajadores_externos WHERE cedula = ?', [cedulaNorm]);
    if (existente && existente.length > 0) {
      return res.status(201).json(existente[0]);
    }

    const result = await query(
      `INSERT INTO trabajadores_externos (cedula, nombre_completo, celular, creado_por_empleador_id)
       VALUES (?, ?, ?, ?)`,
      [cedulaNorm, String(nombre_completo).trim(), celular || null, empleadorId]
    );
    res.status(201).json({
      id: Number(result.insertId),
      cedula: cedulaNorm,
      nombre_completo: String(nombre_completo).trim(),
    });
  } catch (err) {
    console.error('crearTrabajadorExterno:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      const rows = await query('SELECT id, cedula, nombre_completo FROM trabajadores_externos WHERE cedula = ?', [String(req.body.cedula).trim()]);
      if (rows && rows.length) return res.status(201).json(rows[0]);
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function misTrabajadores(req, res) {
  try {
    const empleadorId = req.user.id;

    const registrados = await query(`
      SELECT u.id AS trabajador_id,
        u.nombre_completo AS nombre,
        u.foto_selfie AS foto,
        u.celular AS telefono,
        COUNT(a.id) AS jornadas,
        MAX(j.fecha) AS ultima_fecha
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      JOIN usuarios u ON u.id = a.trabajador_id
      WHERE j.empleador_id = ? AND a.trabajador_id IS NOT NULL
      GROUP BY u.id, u.nombre_completo, u.foto_selfie, u.celular
    `, [empleadorId]);

    const externosConJornada = await query(`
      SELECT te.id AS trabajador_externo_id, te.cedula,
        COALESCE(te.nombre_completo, a.manual_nombre) AS nombre,
        COALESCE(te.celular, MAX(a.manual_telefono)) AS telefono,
        COUNT(a.id) AS jornadas,
        MAX(j.fecha) AS ultima_fecha
      FROM cuaderno_asistencias a
      JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      LEFT JOIN trabajadores_externos te ON te.id = a.trabajador_externo_id
      WHERE j.empleador_id = ? AND a.trabajador_id IS NULL
        AND (a.manual_nombre IS NOT NULL AND a.manual_nombre <> '' OR a.trabajador_externo_id IS NOT NULL)
      GROUP BY COALESCE(a.trabajador_externo_id, CONCAT('m_', a.manual_nombre))
    `, [empleadorId]);

    // Externos creados por este empleador que aún no tienen ninguna jornada
    // registrada — deben aparecer con jornadas=0.
    const externosSinJornada = await query(`
      SELECT te.id AS trabajador_externo_id, te.cedula, te.nombre_completo AS nombre, te.celular AS telefono
      FROM trabajadores_externos te
      WHERE te.creado_por_empleador_id = ?
        AND NOT EXISTS (SELECT 1 FROM cuaderno_asistencias a WHERE a.trabajador_externo_id = te.id)
    `, [empleadorId]);

    const trabajadores = [
      ...(registrados || []).map((r) => ({ ...r, externo: 0 })),
      ...(externosConJornada || []).map((e) => ({
        trabajador_id: null,
        trabajador_externo_id: e.trabajador_externo_id || null,
        cedula: e.cedula || null,
        nombre: e.nombre,
        foto: null,
        telefono: e.telefono || null,
        jornadas: e.jornadas,
        ultima_fecha: e.ultima_fecha,
        externo: 1,
      })),
      ...(externosSinJornada || []).map((e) => ({
        trabajador_id: null,
        trabajador_externo_id: e.trabajador_externo_id,
        cedula: e.cedula || null,
        nombre: e.nombre,
        foto: null,
        telefono: e.telefono || null,
        jornadas: 0,
        ultima_fecha: null,
        externo: 1,
      })),
    ].sort((x, y) => String(y.ultima_fecha || '').localeCompare(String(x.ultima_fecha || '')));

    res.json({ trabajadores });
  } catch (err) {
    console.error('misTrabajadores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function postulantesVacante(req, res) {
  try {
    const empleadorId = req.user.id;
    const vacanteId = Number(req.params.id);
    const v = await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [vacanteId, empleadorId]);
    if (!v || !v.length) return res.status(403).json({ error: 'Sin acceso' });

    const rows = await query(`
      SELECT p.id AS postulacion_id, p.estado AS postulacion_estado,
        u.id AS trabajador_id, u.nombre_completo, u.celular, u.foto_selfie, u.calificacion_promedio
      FROM postulaciones p
      JOIN usuarios u ON u.id = p.trabajador_id
      WHERE p.vacante_id = ?
      ORDER BY p.created_at DESC
    `, [vacanteId]);
    res.json({ postulantes: rows || [] });
  } catch (err) {
    console.error('postulantesVacante cuaderno:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  // jornadas
  listarJornadas, crearJornada, detalleJornada, actualizarJornada, eliminarJornada,
  // asistencias
  agregarAsistencia, actualizarAsistencia, eliminarAsistencia,
  // registros
  upsertRegistroTrabajo, marcarPagado,
  // calificaciones internas
  upsertCalificacion,
  // notas
  crearNota, eliminarNota,
  // dashboard + historial
  dashboard, historialTrabajador, postulantesVacante, misTrabajadores,
  crearTrabajadorExterno,
};
