const { query } = require('../config/database');
const { crearNotificacion } = require('./notificacionesController');
const { crearChat } = require('./chatController');
const { signUrl, signArrayField } = require('../config/s3');

function normalizarFechaInicio(fecha) {
  if (fecha === undefined || fecha === null) return null;
  if (typeof fecha !== 'string') return null;

  const valor = fecha.trim();
  if (!valor) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

  const fechaParseada = new Date(valor);
  if (Number.isNaN(fechaParseada.getTime())) return null;

  return fechaParseada.toISOString().slice(0, 10);
}

// Crear vacante
async function crearVacante(req, res) {
  try {
    const empleadorId = req.user.id;
    const {
      titulo, descripcion, tipo_pago, monto_pago,
      departamento, municipio, vereda, urgente,
      cultivos, labores, fecha_inicio, fecha_fin, duracion, requisitos
    } = req.body;

    if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

    const { ofrece_alojamiento, ofrece_alimentacion, otros_beneficios } = req.body;

    const fechaInicioNormalizada = normalizarFechaInicio(fecha_inicio);
    const fechaFinNormalizada = normalizarFechaInicio(fecha_fin);

    const result = await query(`
      INSERT INTO vacantes (empleador_id, titulo, descripcion, tipo_pago, monto_pago,
        duracion, requisitos, departamento, municipio, vereda, urgente,
        ofrece_alojamiento, ofrece_alimentacion, otros_beneficios, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [empleadorId, titulo, descripcion || null, tipo_pago || null, monto_pago || null,
        duracion || null, requisitos || null,
        departamento || null, municipio || null, vereda || null, urgente ? 1 : 0,
        ofrece_alojamiento ? 1 : 0, ofrece_alimentacion ? 1 : 0, otros_beneficios || null, fechaInicioNormalizada, fechaFinNormalizada]);

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

    res.status(201).json({ message: 'Vacante creada exitosamente', vacanteId });

    // Notificar a todos los trabajadores y especialistas activos (en background)
    const vacInfo = await query('SELECT titulo, municipio, departamento FROM vacantes WHERE id = ?', [vacanteId]).catch(() => []);
    const tituloVac = vacInfo?.[0]?.titulo || 'Nueva vacante';
    const lugarVac = [vacInfo?.[0]?.municipio, vacInfo?.[0]?.departamento].filter(Boolean).join(', ') || 'Colombia';
    const usuarios = await query(
      `SELECT id FROM usuarios WHERE rol IN ('trabajador','especialista') AND activo = 1 AND (eliminado IS NULL OR eliminado = 0) AND (baneado IS NULL OR baneado = 0)`
    ).catch(() => []);
    for (const u of (usuarios || [])) {
      crearNotificacion(u.id, 'nueva_vacante', '¡Nueva vacante disponible!', `"${tituloVac}" en ${lugarVac}. ¡Revísala ahora!`, { vacante_id: vacanteId }).catch(() => {});
    }
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
      WHERE u.rol = 'trabajador' AND u.activo = 1
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
          await crearNotificacion(
            trabajador.id,
            'nuevo_match',
            '¡Nuevo match!',
            `Tu perfil coincide con la vacante "${vacante.titulo}" en ${vacante.municipio || vacante.departamento || 'Colombia'}`,
            { vacante_id: vacanteId }
          );
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
      WHERE v.empleador_id = ? AND v.eliminado = 0
      ORDER BY v.created_at DESC
    `, [empleadorId]);

    for (const v of vacantes) {
      // COUNT(*) y campos numéricos pueden venir como BigInt dependiendo del driver, así que normalizamos.
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago !== null && v.monto_pago !== undefined) {
        v.monto_pago = Number(v.monto_pago);
      }
      v.urgente = Number(v.urgente) === 1;

      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
      const portada = await query('SELECT url FROM vacante_fotos WHERE vacante_id = ? ORDER BY orden ASC LIMIT 1', [v.id]);
      v.foto_portada = portada.length > 0 ? await signUrl(portada[0].url) : null;
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
    const { departamento, municipio, cultivo, labor, urgente, since } = req.query;
    let sql = `
      SELECT v.*, u.nombre_completo as nombre_empleador,
        pe.nombre_empresa_finca,
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE v.estado = 'activa' AND v.eliminado = 0
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

    // Sync incremental: si el cliente envía ?since=, solo devolvemos vacantes
    // modificadas después de ese timestamp + IDs eliminados (soft-delete o cierre)
    // para que el cliente pueda invalidar su cache local.
    if (since) {
      sql += ' AND v.updated_at > ?';
      params.push(since);
    }

    sql += ' ORDER BY v.urgente DESC, v.created_at DESC';

    const vacantes = await query(sql, params);

    for (const v of vacantes) {
      // Normalizar BigInt y campos numéricos
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago !== null && v.monto_pago !== undefined) {
        v.monto_pago = Number(v.monto_pago);
      }
      v.urgente = Number(v.urgente) === 1;
      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
      const portada = await query('SELECT url FROM vacante_fotos WHERE vacante_id = ? ORDER BY orden ASC LIMIT 1', [v.id]);
      v.foto_portada = portada.length > 0 ? await signUrl(portada[0].url) : null;
    }

    let deleted_ids = [];
    if (since) {
      const deletedRows = await query(
        `SELECT id FROM vacantes
         WHERE (eliminado = 1 OR estado IN ('cerrada','expirada'))
           AND updated_at > ?`,
        [since]
      );
      deleted_ids = deletedRows.map(r => Number(r.id));
    }

    res.json({ vacantes, deleted_ids });
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
        u.calificacion_promedio, u.total_calificaciones,
        pe.nombre_empresa_finca, pe.ofrece_alojamiento as pe_ofrece_alojamiento,
        pe.ofrece_alimentacion as pe_ofrece_alimentacion, pe.beneficios_extra, pe.foto_finca_fachada as foto_portada, u.foto_selfie as foto_empleador
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
    vacante.calificacion_promedio = parseFloat(vacante.calificacion_promedio || 0);
    vacante.total_calificaciones = Number(vacante.total_calificaciones || 0);
    // ofrece_alojamiento/alimentacion vienen de la vacante; si no existe aún (columna nueva), caer a perfil_empleador
    vacante.ofrece_alojamiento = vacante.ofrece_alojamiento != null
      ? Number(vacante.ofrece_alojamiento) === 1
      : Number(vacante.pe_ofrece_alojamiento) === 1;
    vacante.ofrece_alimentacion = vacante.ofrece_alimentacion != null
      ? Number(vacante.ofrece_alimentacion) === 1
      : Number(vacante.pe_ofrece_alimentacion) === 1;
    vacante.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [id]);
    vacante.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [id]);
    vacante.fotos = await query('SELECT id, url, descripcion, orden FROM vacante_fotos WHERE vacante_id = ? ORDER BY orden ASC', [id]);
    await signArrayField(vacante.fotos, 'url');
    if (vacante.foto_portada) {
      vacante.foto_portada = await signUrl(vacante.foto_portada);
    }
    if (vacante.foto_empleador) {
      vacante.foto_empleador = await signUrl(vacante.foto_empleador);
    }

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
        const vacanteInfoMatch = await query('SELECT titulo, empleador_id FROM vacantes WHERE id = ?', [vacante_id]);
        if (vacanteInfoMatch.length > 0) {
          const v = vacanteInfoMatch[0];
          const trabajadorInfo = await query('SELECT nombre_completo FROM usuarios WHERE id = ?', [trabajadorId]);
          const nombre = trabajadorInfo[0]?.nombre_completo || 'Un trabajador';
          await crearNotificacion(v.empleador_id, 'postulacion', 'Nueva postulación', `${nombre} se postuló a "${v.titulo}"`, { vacante_id });
        }
        return res.json({ message: 'Postulación confirmada (ya tenías match automático)' });
      }
      return res.status(409).json({ error: 'Ya estás postulado a esta vacante' });
    }

    await query(`
      INSERT INTO postulaciones (vacante_id, trabajador_id, estado, mensaje)
      VALUES (?, ?, 'pendiente', ?)
    `, [vacante_id, trabajadorId, mensaje || null]);

    // Notificar al empleador
    const vacanteInfoPost = await query('SELECT titulo, empleador_id FROM vacantes WHERE id = ?', [vacante_id]);
    if (vacanteInfoPost.length > 0) {
      const v = vacanteInfoPost[0];
      const trabajadorInfo = await query('SELECT nombre_completo FROM usuarios WHERE id = ?', [trabajadorId]);
      const nombre = trabajadorInfo[0]?.nombre_completo || 'Un trabajador';
      await crearNotificacion(v.empleador_id, 'postulacion', 'Nueva postulación', `${nombre} se postuló a "${v.titulo}"`, { vacante_id });
    }

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
    const isAdmin = req.user.rol === 'admin';

    // Verificar que la vacante pertenece al empleador (admin puede ver cualquiera)
    const vacantes = isAdmin
      ? await query('SELECT id FROM vacantes WHERE id = ?', [vacante_id])
      : await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [vacante_id, empleadorId]);
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

    await signArrayField(postulaciones, 'foto_selfie');

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

    // Notificar al trabajador
    const postInfo = await query(`
      SELECT p.trabajador_id, p.vacante_id, v.titulo FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      WHERE p.id = ?
    `, [id]);
    if (postInfo.length > 0) {
      const { trabajador_id, titulo, vacante_id } = postInfo[0];
      if (estado === 'aceptada') {
        // Crear chat primero para tener el chat_id disponible en la notificación
        const chatId = await crearChat(Number(vacante_id), empleadorId, trabajador_id);
        await crearNotificacion(trabajador_id, 'postulacion_aceptada', '¡Postulación aceptada!', `Tu postulación a "${titulo}" fue aceptada. Ahora puedes chatear con el empleador.`, { vacante_id, conversacion_id: chatId });
      } else {
        await crearNotificacion(trabajador_id, 'rechazado', 'Postulación rechazada', `Tu postulación a "${titulo}" no fue seleccionada en esta ocasión.`, { vacante_id });
      }
    }

    res.json({ message: `Postulación ${estado}` });
  } catch (err) {
    console.error('Error actualizando postulación:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Responder solicitud de contacto (trabajador)
async function responderSolicitudContacto(req, res) {
  try {
    const { id } = req.params;
    const { accion } = req.body;
    const trabajadorId = req.user.id;

    if (!['aceptar', 'rechazar'].includes(accion)) {
      return res.status(400).json({ error: 'Acción inválida. Use: aceptar o rechazar' });
    }

    const posts = await query(`
      SELECT p.id, p.vacante_id, p.estado, v.empleador_id, v.titulo
      FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      WHERE p.id = ? AND p.trabajador_id = ?
      LIMIT 1
    `, [id, trabajadorId]);

    if (!posts || posts.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const post = posts[0];
    if (post.estado !== 'contacto_solicitado') {
      return res.status(400).json({ error: 'Esta solicitud ya fue procesada o no requiere respuesta' });
    }

    if (accion === 'aceptar') {
      await query('UPDATE postulaciones SET estado = ? WHERE id = ?', ['aceptada', id]);
      const chatId = await crearChat(Number(post.vacante_id), Number(post.empleador_id), trabajadorId);

      await crearNotificacion(
        Number(post.empleador_id),
        'chat_habilitado',
        'Solicitud aceptada',
        `Tu solicitud de contacto para "${post.titulo}" fue aceptada. Ya puedes chatear con el trabajador.`,
        { vacante_id: Number(post.vacante_id), conversacion_id: chatId }
      );

      return res.json({
        message: 'Solicitud aceptada. Chat habilitado',
        estado: 'aceptada',
        chat_id: chatId,
      });
    }

    await query('UPDATE postulaciones SET estado = ? WHERE id = ?', ['rechazada', id]);
    await crearNotificacion(
      Number(post.empleador_id),
      'rechazado',
      'Solicitud rechazada',
      `Tu solicitud de contacto para "${post.titulo}" fue rechazada por el trabajador.`,
      { vacante_id: Number(post.vacante_id) }
    );

    res.json({
      message: 'Solicitud rechazada',
      estado: 'rechazada',
    });
  } catch (err) {
    console.error('Error respondiendo solicitud de contacto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Mis postulaciones (para trabajador)
async function misPostulaciones(req, res) {
  try {
    const trabajadorId = req.user.id;
    const postulaciones = await query(`
      SELECT p.*, v.titulo, v.departamento, v.municipio, v.tipo_pago, v.urgente, v.estado as estado_vacante,
        v.empleador_id, pe.nombre_empresa_finca, u.nombre_completo as nombre_empleador,
        u.calificacion_promedio as calificacion_empleador
      FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE p.trabajador_id = ?
      ORDER BY p.created_at DESC
    `, [trabajadorId]);

    for (const p of postulaciones) {
      p.urgente = Number(p.urgente) === 1;
      p.es_match_automatico = Number(p.es_match_automatico) === 1;
      p.empleador_id = Number(p.empleador_id);
      p.calificacion_empleador = parseFloat(p.calificacion_empleador || 0);
    }

    res.json({ postulaciones });
  } catch (err) {
    console.error('Error obteniendo mis postulaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Matching inverso: dado un trabajador nuevo, busca todas las vacantes activas que le coincidan
async function ejecutarMatchingParaTrabajador(trabajadorId) {
  try {
    const trabajadores = await query(`
      SELECT u.id, u.departamento, u.municipio,
        pt.id as perfil_id
      FROM usuarios u
      JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.id = ? AND u.rol = 'trabajador' AND u.activo = 1
    `, [trabajadorId]);

    if (!trabajadores || trabajadores.length === 0) return;
    const trabajador = trabajadores[0];

    const tCultivos = await query('SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?', [trabajador.perfil_id]);
    const tHabilidades = await query('SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?', [trabajador.perfil_id]);
    const cultivosTrabajador = tCultivos.map(c => c.cultivo.toLowerCase());
    const habilidadesTrabajador = tHabilidades.map(h => h.habilidad.toLowerCase());

    const vacantes = await query("SELECT * FROM vacantes WHERE estado = 'activa' AND eliminado = 0");

    for (const vacante of vacantes) {
      let puntaje = 0;
      const vacanteId = Number(vacante.id);

      // 1. Cultivos (40 pts max)
      const vCultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [vacanteId]);
      const cultivosVacante = vCultivos.map(c => c.cultivo.toLowerCase());
      const cultivosMatch = cultivosVacante.filter(c => cultivosTrabajador.includes(c));
      if (cultivosVacante.length > 0) {
        puntaje += (cultivosMatch.length / cultivosVacante.length) * 40;
      }

      // 2. Labores/habilidades (30 pts max)
      const vLabores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [vacanteId]);
      const laboresVacante = vLabores.map(l => l.labor.toLowerCase());
      const laboresMatch = laboresVacante.filter(l => habilidadesTrabajador.includes(l));
      if (laboresVacante.length > 0) {
        puntaje += (laboresMatch.length / laboresVacante.length) * 30;
      }

      // 3. Ubicación (30 pts max)
      if (vacante.departamento && trabajador.departamento) {
        if (vacante.departamento.toLowerCase() === trabajador.departamento.toLowerCase()) {
          puntaje += 15;
          if (vacante.municipio && trabajador.municipio &&
              vacante.municipio.toLowerCase() === trabajador.municipio.toLowerCase()) {
            puntaje += 15;
          }
        }
      }

      if (puntaje >= 30) {
        const existing = await query(
          'SELECT id FROM postulaciones WHERE vacante_id = ? AND trabajador_id = ?',
          [vacanteId, trabajadorId]
        );
        if (!existing || existing.length === 0) {
          await query(`
            INSERT INTO postulaciones (vacante_id, trabajador_id, estado, es_match_automatico, puntaje_match)
            VALUES (?, ?, 'match_auto', 1, ?)
          `, [vacanteId, trabajadorId, puntaje]);
          await crearNotificacion(
            trabajadorId,
            'nuevo_match',
            '¡Nuevo match!',
            `Tu perfil coincide con la vacante "${vacante.titulo}" en ${vacante.municipio || vacante.departamento || 'Colombia'}`,
            { vacante_id: vacanteId }
          );
        }
      }
    }

    console.log(`Matching por trabajador ejecutado para usuario ${trabajadorId}`);
  } catch (err) {
    console.error('Error en matching por trabajador:', err);
  }
}

// Endpoint para ejecutar matching manualmente sobre una vacante existente
async function ejecutarMatchingEndpoint(req, res) {
  try {
    const { id } = req.params;
    const empleadorId = req.user.id;

    const vacantes = await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [id, empleadorId]);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const vacanteId = Number(id);
    const antes = await query(
      'SELECT COUNT(*) as total FROM postulaciones WHERE vacante_id = ? AND es_match_automatico = 1',
      [vacanteId]
    );
    const totalAntes = Number(antes[0].total);

    await ejecutarMatching(vacanteId);

    const despues = await query(
      'SELECT COUNT(*) as total FROM postulaciones WHERE vacante_id = ? AND es_match_automatico = 1',
      [vacanteId]
    );
    const totalDespues = Number(despues[0].total);

    res.json({
      message: 'Matching ejecutado exitosamente',
      matches_nuevos: totalDespues - totalAntes,
      total_matches: totalDespues
    });
  } catch (err) {
    console.error('Error ejecutando matching endpoint:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualizar vacante
async function actualizarVacante(req, res) {
  try {
    const { id } = req.params;
    const empleadorId = req.user.id;

    const vacantes = await query('SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?', [id, empleadorId]);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const {
      titulo, descripcion, tipo_pago, monto_pago,
      departamento, municipio, vereda, urgente,
      cultivos, labores,
      ofrece_alojamiento, ofrece_alimentacion, otros_beneficios,
      fecha_inicio, fecha_fin, duracion, requisitos,
    } = req.body;

    if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

    const fechaInicioNormalizada = normalizarFechaInicio(fecha_inicio);
    const fechaFinNormalizada = normalizarFechaInicio(fecha_fin);

    await query(
      'UPDATE vacantes SET titulo=?, descripcion=?, tipo_pago=?, monto_pago=?, duracion=?, requisitos=?, departamento=?, municipio=?, vereda=?, urgente=?, ofrece_alojamiento=?, ofrece_alimentacion=?, otros_beneficios=?, fecha_inicio=?, fecha_fin=? WHERE id=?',
      [titulo, descripcion || null, tipo_pago || null, monto_pago || null,
       duracion || null, requisitos || null,
       departamento || null, municipio || null, vereda || null, urgente ? 1 : 0,
       ofrece_alojamiento ? 1 : 0, ofrece_alimentacion ? 1 : 0, otros_beneficios || null, fechaInicioNormalizada, fechaFinNormalizada, id]
    );

    await query('DELETE FROM vacante_cultivos WHERE vacante_id=?', [id]);
    if (cultivos && Array.isArray(cultivos)) {
      for (const c of cultivos) {
        await query('INSERT INTO vacante_cultivos (vacante_id, cultivo) VALUES (?, ?)', [id, c]);
      }
    }

    await query('DELETE FROM vacante_labores WHERE vacante_id=?', [id]);
    if (labores && Array.isArray(labores)) {
      for (const l of labores) {
        await query('INSERT INTO vacante_labores (vacante_id, labor) VALUES (?, ?)', [id, l]);
      }
    }

    res.json({ message: 'Vacante actualizada exitosamente' });
  } catch (err) {
    console.error('Error actualizando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Eliminar vacante
async function eliminarVacante(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = req.user.rol === 'admin';
    const empleadorId = req.user.id;

    const whereClause = isAdmin
      ? 'SELECT id FROM vacantes WHERE id = ?'
      : 'SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?';
    const whereParams = isAdmin ? [id] : [id, empleadorId];
    const vacantes = await query(whereClause, whereParams);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    // Eliminar fotos de S3
    const fotos = await query('SELECT url FROM vacante_fotos WHERE vacante_id = ?', [id]);
    if (fotos.length > 0) {
      const { deleteFromS3 } = require('../config/s3');
      for (const foto of fotos) {
        await deleteFromS3(foto.url);
      }
    }

    // Eliminar mensajes de chats relacionados
    await query('DELETE FROM mensajes WHERE chat_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [id]);
    // Limpiar referencias en notificaciones
    await query('UPDATE notificaciones SET conversacion_id = NULL WHERE conversacion_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [id]);
    await query('UPDATE notificaciones SET vacante_id = NULL WHERE vacante_id = ?', [id]);
    // Eliminar chats
    await query('DELETE FROM chats WHERE vacante_id = ?', [id]);
    // Limpiar calificaciones
    await query('UPDATE calificaciones SET vacante_id = NULL WHERE vacante_id = ?', [id]);

    await query('DELETE FROM vacante_fotos WHERE vacante_id = ?', [id]);
    await query('DELETE FROM vacante_cultivos WHERE vacante_id = ?', [id]);
    await query('DELETE FROM vacante_labores WHERE vacante_id = ?', [id]);
    await query('DELETE FROM postulaciones WHERE vacante_id = ?', [id]);
    await query('DELETE FROM vacantes WHERE id = ?', [id]);

    res.json({ message: 'Vacante eliminada' });
  } catch (err) {
    console.error('Error eliminando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Cerrar vacante
async function cerrarVacante(req, res) {
  try {
    const { id } = req.params;
    const empleadorId = req.user.id;

    const result = await query('UPDATE vacantes SET estado = ? WHERE id = ? AND empleador_id = ? AND eliminado = 0', ['cerrada', id, empleadorId]);

    if (!result || Number(result.affectedRows || 0) === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada para archivar' });
    }

    res.json({ message: 'Vacante cerrada' });
  } catch (err) {
    console.error('Error cerrando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Subir foto(s) a vacante
async function subirFotosVacante(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = req.user.rol === 'admin';
    const empleadorId = req.user.id;

    console.log('subirFotosVacante - files recibidos:', (req.files || []).length, '| isAdmin:', isAdmin);

    // Verificar propiedad: admin puede subir fotos a cualquier vacante
    const whereClause = isAdmin
      ? 'SELECT id FROM vacantes WHERE id = ?'
      : 'SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?';
    const whereParams = isAdmin ? [id] : [id, empleadorId];
    const vacantes = await query(whereClause, whereParams);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const archivos = Array.isArray(req.files) ? req.files : [];
    if (archivos.length === 0) {
      console.error('subirFotosVacante - no files received. Body keys:', Object.keys(req.body));
      return res.status(400).json({ error: 'No se subió ninguna foto' });
    }

    const currentFotos = await query('SELECT COUNT(*) as count FROM vacante_fotos WHERE vacante_id = ?', [id]);
    const currentCount = Number(currentFotos[0].count);

    if (currentCount + archivos.length > 5) {
      return res.status(400).json({ error: `Máximo 5 fotos por vacante. Ya tienes ${currentCount}.` });
    }

    const fotasGuardadas = [];
    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      const fileUrl = file.location || file.path;
      const orden = currentCount + i;
      const result = await query(
        'INSERT INTO vacante_fotos (vacante_id, url, orden) VALUES (?, ?, ?)',
        [id, fileUrl, orden]
      );
      const signedUrl = await signUrl(fileUrl);
      fotasGuardadas.push({ id: Number(result.insertId), url: signedUrl, orden });
    }

    res.status(201).json({ message: 'Foto(s) subida(s) exitosamente', fotos: fotasGuardadas });
  } catch (err) {
    console.error('Error subiendo fotos vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Eliminar foto de vacante
async function eliminarFotoVacante(req, res) {
  try {
    const { id, fotoId } = req.params;
    const isAdmin = req.user.rol === 'admin';
    const empleadorId = req.user.id;

    const whereClause = isAdmin
      ? 'SELECT id FROM vacantes WHERE id = ?'
      : 'SELECT id FROM vacantes WHERE id = ? AND empleador_id = ?';
    const whereParams = isAdmin ? [id] : [id, empleadorId];
    const vacantes = await query(whereClause, whereParams);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const fotos = await query('SELECT * FROM vacante_fotos WHERE id = ? AND vacante_id = ?', [fotoId, id]);
    if (!fotos || fotos.length === 0) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    const { deleteFromS3 } = require('../config/s3');
    await deleteFromS3(fotos[0].url);

    await query('DELETE FROM vacante_fotos WHERE id = ?', [fotoId]);
    res.json({ message: 'Foto eliminada' });
  } catch (err) {
    console.error('Error eliminando foto vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Perfil público de un trabajador (para empleadores)
async function perfilPublicoTrabajador(req, res) {
  try {
    const { id } = req.params;
    const empleadorId = req.user.id;

    const users = await query(`
      SELECT u.id, u.nombre_completo, u.departamento, u.municipio, u.foto_selfie, u.foto_portada,
        u.calificacion_promedio, u.total_calificaciones, u.verificado_sms, u.validacion_identidad_estado,
        pt.acerca_de, pt.hoja_vida_url, pt.hoja_vida_nombre,
        pt.nivel_estudios, pt.titulo_estudio, pt.anios_experiencia, pt.disponibilidad,
        pt.id as perfil_id
      FROM usuarios u
      LEFT JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.id = ? AND u.rol = 'trabajador' AND u.activo = 1
    `, [id]);

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const trabajador = users[0];
    trabajador.calificacion_promedio = parseFloat(trabajador.calificacion_promedio || 0);
    trabajador.total_calificaciones = Number(trabajador.total_calificaciones || 0);
    trabajador.verificado_sms = Number(trabajador.verificado_sms) === 1;
    trabajador.foto_selfie = await signUrl(trabajador.foto_selfie);
    trabajador.foto_portada = await signUrl(trabajador.foto_portada);
    trabajador.hoja_vida_url = await signUrl(trabajador.hoja_vida_url);

    if (trabajador.perfil_id) {
      trabajador.habilidades = await query(
        'SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?',
        [trabajador.perfil_id]
      );
      trabajador.cultivos = await query(
        'SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?',
        [trabajador.perfil_id]
      );
      const fotosRows = await query(
        'SELECT id, url FROM trabajador_fotos_trabajo WHERE perfil_trabajador_id = ? ORDER BY orden, id',
        [trabajador.perfil_id]
      );
      trabajador.fotos_trabajo = await Promise.all(fotosRows.map(async (f) => ({ id: f.id, url: await signUrl(f.url) })));
      trabajador.experiencias = await query('SELECT id, entidad, descripcion, duracion FROM experiencias_laborales WHERE usuario_id = ? ORDER BY orden, id', [id]);
    } else {
      trabajador.habilidades = [];
      trabajador.cultivos = [];
      trabajador.fotos_trabajo = [];
      trabajador.experiencias = [];
    }

    // Mostrar celular solo si el empleador tiene una postulación aceptada con este trabajador
    const match = await query(`
      SELECT p.id FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      WHERE p.trabajador_id = ? AND v.empleador_id = ? AND p.estado = 'aceptada'
      LIMIT 1
    `, [id, empleadorId]);

    if (match && match.length > 0) {
      const celularRow = await query('SELECT celular FROM usuarios WHERE id = ?', [id]);
      trabajador.celular = celularRow[0]?.celular || null;
      trabajador.puede_contactar = true;
    } else {
      trabajador.puede_contactar = false;
    }

    delete trabajador.perfil_id;
    res.json({ trabajador });
  } catch (err) {
    console.error('Error obteniendo perfil público:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Vacantes recomendadas para un trabajador o especialista según su perfil
async function vacantesRecomendadas(req, res) {
  try {
    const trabajadorId = req.user.id;
    const rol = req.user.rol;

    // Obtener cultivos y habilidades según el rol
    let cultivosTrabajador = [];
    let habilidadesTrabajador = [];

    if (rol === 'especialista') {
      const perfiles = await query('SELECT id FROM perfil_especialista WHERE usuario_id = ?', [trabajadorId]);
      if (perfiles && perfiles.length > 0) {
        const perfilId = perfiles[0].id;
        const esp = await query('SELECT cultivo FROM especialista_cultivos WHERE perfil_especialista_id = ?', [perfilId]);
        const especialidades = await query('SELECT especialidad FROM especialista_especialidades WHERE perfil_especialista_id = ?', [perfilId]);
        cultivosTrabajador = esp.map(c => c.cultivo.toLowerCase());
        habilidadesTrabajador = especialidades.map(e => e.especialidad.toLowerCase());
      }
    } else {
      // trabajador (y cualquier otro rol)
      const perfiles = await query('SELECT id FROM perfil_trabajador WHERE usuario_id = ?', [trabajadorId]);
      if (!perfiles || perfiles.length === 0) {
        return res.json({ vacantes: [] });
      }
      const perfilId = perfiles[0].id;
      const tCultivos = await query('SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?', [perfilId]);
      const tHabilidades = await query('SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?', [perfilId]);
      cultivosTrabajador = tCultivos.map((c) => c.cultivo.toLowerCase());
      habilidadesTrabajador = tHabilidades.map((h) => h.habilidad.toLowerCase());
    }

    // Ubicación del trabajador
    const users = await query(
      'SELECT departamento, municipio FROM usuarios WHERE id = ?',
      [trabajadorId]
    );
    const tDept = users[0]?.departamento?.toLowerCase() || null;
    const tMun = users[0]?.municipio?.toLowerCase() || null;

    // IDs de vacantes a las que ya se postuló (excluir)
    const postuladas = await query(
      'SELECT vacante_id FROM postulaciones WHERE trabajador_id = ?',
      [trabajadorId]
    );
    const idsPostuladas = new Set(postuladas.map((p) => Number(p.vacante_id)));

    // Todas las vacantes activas
    const vacantes = await query(`
      SELECT v.*, u.nombre_completo as nombre_empleador,
        pe.nombre_empresa_finca,
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE v.estado = 'activa' AND v.eliminado = 0
    `);

    const resultados = [];

    for (const v of vacantes) {
      if (idsPostuladas.has(Number(v.id))) continue;

      const vCultivos = await query(
        'SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?',
        [v.id]
      );
      const vLabores = await query(
        'SELECT labor FROM vacante_labores WHERE vacante_id = ?',
        [v.id]
      );
      const cultivosVacante = vCultivos.map((c) => c.cultivo.toLowerCase());
      const laboresVacante = vLabores.map((l) => l.labor.toLowerCase());

      let puntaje = 0;

      // Cultivos: hasta 40 pts
      if (cultivosVacante.length > 0) {
        const match = cultivosVacante.filter((c) => cultivosTrabajador.includes(c));
        puntaje += (match.length / cultivosVacante.length) * 40;
      }

      // Habilidades/labores: hasta 30 pts
      if (laboresVacante.length > 0) {
        const match = laboresVacante.filter((l) => habilidadesTrabajador.includes(l));
        puntaje += (match.length / laboresVacante.length) * 30;
      }

      // Ubicación: hasta 30 pts
      let proximidad = 'lejano';
      if (tDept && v.departamento && v.departamento.toLowerCase() === tDept) {
        puntaje += 15;
        proximidad = 'mismo_departamento';
        if (tMun && v.municipio && v.municipio.toLowerCase() === tMun) {
          puntaje += 15;
          proximidad = 'mismo_municipio';
        }
      }

      // Si el trabajador no tiene etiquetas configuradas, mostrar todas las vacantes activas
      const sinEtiquetas = cultivosTrabajador.length === 0 && habilidadesTrabajador.length === 0;
      if (!sinEtiquetas && puntaje < 5) continue;

      // Normalizar campos
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago != null) v.monto_pago = Number(v.monto_pago);
      v.urgente = Number(v.urgente) === 1;
      v.cultivos = vCultivos;
      v.labores = vLabores;

      const portada = await query(
        'SELECT url FROM vacante_fotos WHERE vacante_id = ? ORDER BY orden ASC LIMIT 1',
        [v.id]
      );
      v.foto_portada = portada.length > 0 ? await signUrl(portada[0].url) : null;
      v.puntaje_match = Math.round(puntaje);
      v.proximidad = proximidad;

      resultados.push(v);
    }

    // Ordenar por puntaje de match descendente
    resultados.sort((a, b) => b.puntaje_match - a.puntaje_match);

    res.json({ vacantes: resultados });
  } catch (err) {
    console.error('Error obteniendo vacantes recomendadas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  crearVacante, actualizarVacante, eliminarVacante, misVacantes, listarVacantes, detalleVacante,
  postularse, verPostulaciones, actualizarPostulacion, responderSolicitudContacto,
  misPostulaciones, cerrarVacante, subirFotosVacante, eliminarFotoVacante,
  ejecutarMatchingEndpoint, ejecutarMatchingParaTrabajador,
  perfilPublicoTrabajador, vacantesRecomendadas
};
