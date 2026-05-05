const { query } = require('../config/database');
const { signUrl } = require('../config/s3');
const { crearNotificacion } = require('./notificacionesController');
const { crearChat } = require('./chatController');

function calcularPuntajeMatch({
  referenciaCultivos,
  referenciaLabores,
  trabajadorCultivos,
  trabajadorHabilidades,
  referenciaDepartamento,
  referenciaMunicipio,
  trabajadorDepartamento,
  trabajadorMunicipio,
}) {
  let puntaje = 0;
  let proximidad = 'lejano';

  if (referenciaCultivos.length > 0) {
    const matchCultivos = referenciaCultivos.filter((c) => trabajadorCultivos.includes(c));
    puntaje += (matchCultivos.length / referenciaCultivos.length) * 40;
  }

  if (referenciaLabores.length > 0) {
    const matchLabores = referenciaLabores.filter((l) => trabajadorHabilidades.includes(l));
    puntaje += (matchLabores.length / referenciaLabores.length) * 30;
  }

  if (referenciaDepartamento && trabajadorDepartamento && trabajadorDepartamento === referenciaDepartamento) {
    puntaje += 15;
    proximidad = 'mismo_departamento';
    if (referenciaMunicipio && trabajadorMunicipio && trabajadorMunicipio === referenciaMunicipio) {
      puntaje += 15;
      proximidad = 'mismo_municipio';
    }
  }

  return {
    puntaje: Math.round(puntaje),
    proximidad,
  };
}

async function obtenerReferenciaMatch(empleadorId, vacanteId = null) {
  if (vacanteId) {
    const vacantes = await query(
      `SELECT id, titulo, departamento, municipio
       FROM vacantes
       WHERE id = ? AND empleador_id = ? AND eliminado = 0`,
      [vacanteId, empleadorId]
    );

    if (!vacantes || vacantes.length === 0) {
      return null;
    }

    const vacante = vacantes[0];
    const cultRows = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [vacante.id]);
    const labRows = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [vacante.id]);

    let cultivos = cultRows.map((r) => r.cultivo.toLowerCase());
    let labores = labRows.map((r) => r.labor.toLowerCase());

    // Si la vacante no tiene filtros cargados aún, usar perfil del empleador como respaldo.
    if (cultivos.length === 0 && labores.length === 0) {
      const perfiles = await query('SELECT id FROM perfil_empleador WHERE usuario_id = ?', [empleadorId]);
      const perfilId = perfiles?.[0]?.id;
      if (perfilId) {
        const cultPerfil = await query('SELECT cultivo FROM empleador_cultivos WHERE perfil_empleador_id = ?', [perfilId]);
        const labPerfil = await query('SELECT labor FROM empleador_labores WHERE perfil_empleador_id = ?', [perfilId]);
        cultivos = cultPerfil.map((r) => r.cultivo.toLowerCase());
        labores = labPerfil.map((r) => r.labor.toLowerCase());
      }
    }

    return {
      origen: 'vacante',
      vacanteId: Number(vacante.id),
      vacanteTitulo: vacante.titulo,
      departamento: vacante.departamento?.toLowerCase() || null,
      municipio: vacante.municipio?.toLowerCase() || null,
      cultivos,
      labores,
    };
  }

  const activas = await query(
    `SELECT id, titulo, departamento, municipio
     FROM vacantes
     WHERE empleador_id = ? AND estado = 'activa' AND eliminado = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [empleadorId]
  );

  if (activas && activas.length > 0) {
    const vacante = activas[0];
    const cultRows = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [vacante.id]);
    const labRows = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [vacante.id]);

    return {
      origen: 'vacante',
      vacanteId: Number(vacante.id),
      vacanteTitulo: vacante.titulo,
      departamento: vacante.departamento?.toLowerCase() || null,
      municipio: vacante.municipio?.toLowerCase() || null,
      cultivos: cultRows.map((r) => r.cultivo.toLowerCase()),
      labores: labRows.map((r) => r.labor.toLowerCase()),
    };
  }

  const perfiles = await query('SELECT id FROM perfil_empleador WHERE usuario_id = ?', [empleadorId]);
  const perfilId = perfiles?.[0]?.id;

  const cultRows = perfilId
    ? await query('SELECT cultivo FROM empleador_cultivos WHERE perfil_empleador_id = ?', [perfilId])
    : [];
  const labRows = perfilId
    ? await query('SELECT labor FROM empleador_labores WHERE perfil_empleador_id = ?', [perfilId])
    : [];
  const ubicacion = await query('SELECT departamento, municipio FROM usuarios WHERE id = ?', [empleadorId]);

  return {
    origen: 'perfil',
    vacanteId: null,
    vacanteTitulo: null,
    departamento: ubicacion[0]?.departamento?.toLowerCase() || null,
    municipio: ubicacion[0]?.municipio?.toLowerCase() || null,
    cultivos: cultRows.map((r) => r.cultivo.toLowerCase()),
    labores: labRows.map((r) => r.labor.toLowerCase()),
  };
}

/**
 * GET /api/trabajadores
 * Lista trabajadores disponibles para empleadores con puntaje de match y proximidad.
 * Query params: departamento, municipio, habilidad, cultivo, disponibilidad, orden (match|cercanos)
 */
async function listarTrabajadores(req, res) {
  try {
    const empleadorId = req.user.id;
    const { departamento, municipio, habilidad, cultivo, disponibilidad, orden } = req.query;

    // Perfil del empleador para calcular match
    const empPerfiles = await query(
      'SELECT id FROM perfil_empleador WHERE usuario_id = ?',
      [empleadorId]
    );

    let empCultivos = [];
    let empLabores = [];

    if (empPerfiles && empPerfiles.length > 0) {
      const perfilId = empPerfiles[0].id;
      const cultRows = await query(
        'SELECT cultivo FROM empleador_cultivos WHERE perfil_empleador_id = ?',
        [perfilId]
      );
      const labRows = await query(
        'SELECT labor FROM empleador_labores WHERE perfil_empleador_id = ?',
        [perfilId]
      );
      empCultivos = cultRows.map((r) => r.cultivo.toLowerCase());
      empLabores = labRows.map((r) => r.labor.toLowerCase());
    }

    // Ubicación del empleador para proximidad
    const empUsers = await query(
      'SELECT departamento, municipio FROM usuarios WHERE id = ?',
      [empleadorId]
    );
    const empDept = empUsers[0]?.departamento?.toLowerCase() || null;
    const empMun = empUsers[0]?.municipio?.toLowerCase() || null;

    // Filtros opcionales en SQL
    let whereExtra = '';
    const params = [];

    if (departamento) {
      whereExtra += ' AND LOWER(u.departamento) = LOWER(?)';
      params.push(departamento);
    }
    if (municipio) {
      whereExtra += ' AND LOWER(u.municipio) = LOWER(?)';
      params.push(municipio);
    }
    if (disponibilidad) {
      whereExtra += ' AND pt.disponibilidad = ?';
      params.push(disponibilidad);
    }

    const trabajadores = await query(`
      SELECT u.id, u.nombre_completo, u.departamento, u.municipio, u.foto_selfie, u.latitud, u.longitud,
        u.calificacion_promedio, u.total_calificaciones,
        pt.id as perfil_id, pt.anios_experiencia, pt.disponibilidad, pt.nivel_estudios, pt.acerca_de
      FROM usuarios u
      JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.rol = 'trabajador' AND u.activo = 1
        AND (u.eliminado IS NULL OR u.eliminado = 0)
        AND u.id NOT IN (SELECT bloqueado_id FROM usuarios_bloqueados WHERE bloqueador_id = ?)
        AND u.id NOT IN (SELECT bloqueador_id FROM usuarios_bloqueados WHERE bloqueado_id = ?)
        ${whereExtra}
    `, [userId, userId, ...params]);

    if (!trabajadores || trabajadores.length === 0) {
      return res.json({ trabajadores: [] });
    }

    // Por cada trabajador: cargar habilidades/cultivos, aplicar filtros y calcular score
    const resultados = await Promise.all(
      trabajadores.map(async (t) => {
        const habilidadesRows = await query(
          'SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?',
          [t.perfil_id]
        );
        const cultivosRows = await query(
          'SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?',
          [t.perfil_id]
        );

        const habs = habilidadesRows.map((h) => h.habilidad.toLowerCase());
        const cults = cultivosRows.map((c) => c.cultivo.toLowerCase());

        // Filtro por habilidad o cultivo específico
        if (habilidad && !habs.includes(habilidad.toLowerCase())) return null;
        if (cultivo && !cults.includes(cultivo.toLowerCase())) return null;

        // Cálculo de puntaje de match (0-100)
        let puntaje = 0;

        // Cultivos: hasta 40 puntos
        if (empCultivos.length > 0) {
          const matchCultivos = empCultivos.filter((c) => cults.includes(c));
          puntaje += (matchCultivos.length / empCultivos.length) * 40;
        }

        // Habilidades/labores: hasta 30 puntos
        if (empLabores.length > 0) {
          const matchLabores = empLabores.filter((l) => habs.includes(l));
          puntaje += (matchLabores.length / empLabores.length) * 30;
        }

        // Proximidad geográfica: hasta 30 puntos
        let proximidad = 'lejano';
        if (empDept && t.departamento && t.departamento.toLowerCase() === empDept) {
          puntaje += 15;
          proximidad = 'mismo_departamento';
          if (empMun && t.municipio && t.municipio.toLowerCase() === empMun) {
            puntaje += 15;
            proximidad = 'mismo_municipio';
          }
        }

        const foto = await signUrl(t.foto_selfie);

        return {
          id: t.id,
          nombre_completo: t.nombre_completo,
          departamento: t.departamento,
          municipio: t.municipio,
          latitud: t.latitud !== null && t.latitud !== undefined ? parseFloat(t.latitud) : null,
          longitud: t.longitud !== null && t.longitud !== undefined ? parseFloat(t.longitud) : null,
          foto_selfie: foto,
          calificacion_promedio: parseFloat(t.calificacion_promedio || 0),
          total_calificaciones: Number(t.total_calificaciones || 0),
          anios_experiencia: t.anios_experiencia,
          disponibilidad: t.disponibilidad,
          nivel_estudios: t.nivel_estudios,
          acerca_de: t.acerca_de,
          habilidades: habilidadesRows.map((h) => h.habilidad),
          cultivos: cultivosRows.map((c) => c.cultivo),
          puntaje_match: Math.round(puntaje),
          proximidad,
        };
      })
    );

    let filtrados = resultados.filter(Boolean);

    // Ordenar
    if (orden === 'cercanos') {
      const prioridadProx = { mismo_municipio: 0, mismo_departamento: 1, lejano: 2 };
      filtrados.sort(
        (a, b) =>
          prioridadProx[a.proximidad] - prioridadProx[b.proximidad] ||
          b.puntaje_match - a.puntaje_match
      );
    } else {
      // Por defecto: mejor match primero
      filtrados.sort(
        (a, b) =>
          b.puntaje_match - a.puntaje_match ||
          b.calificacion_promedio - a.calificacion_promedio
      );
    }

    res.json({ trabajadores: filtrados });
  } catch (err) {
    console.error('Error listando trabajadores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function trabajadoresRecomendados(req, res) {
  try {
    const empleadorId = req.user.id;
    const vacanteId = req.query?.vacante_id ? Number(req.query.vacante_id) : null;

    const referencia = await obtenerReferenciaMatch(empleadorId, Number.isFinite(vacanteId) ? vacanteId : null);
    if (!referencia) {
      return res.status(404).json({ error: 'Vacante no encontrada para generar recomendaciones' });
    }

    const trabajadores = await query(`
      SELECT u.id, u.nombre_completo, u.departamento, u.municipio, u.foto_selfie, u.latitud, u.longitud,
        u.calificacion_promedio, u.total_calificaciones,
        pt.id as perfil_id, pt.anios_experiencia, pt.disponibilidad, pt.nivel_estudios, pt.acerca_de
      FROM usuarios u
      JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.rol = 'trabajador' AND u.activo = 1
        AND (u.eliminado IS NULL OR u.eliminado = 0)
        AND u.id NOT IN (SELECT bloqueado_id FROM usuarios_bloqueados WHERE bloqueador_id = ?)
        AND u.id NOT IN (SELECT bloqueador_id FROM usuarios_bloqueados WHERE bloqueado_id = ?)
    `, [empleadorId, empleadorId]);

    const resultados = await Promise.all(
      (trabajadores || []).map(async (t) => {
        const habilidadesRows = await query(
          'SELECT habilidad FROM trabajador_habilidades WHERE perfil_trabajador_id = ?',
          [t.perfil_id]
        );
        const cultivosRows = await query(
          'SELECT cultivo FROM trabajador_cultivos WHERE perfil_trabajador_id = ?',
          [t.perfil_id]
        );

        const habs = habilidadesRows.map((h) => h.habilidad.toLowerCase());
        const cults = cultivosRows.map((c) => c.cultivo.toLowerCase());

        const { puntaje, proximidad } = calcularPuntajeMatch({
          referenciaCultivos: referencia.cultivos,
          referenciaLabores: referencia.labores,
          trabajadorCultivos: cults,
          trabajadorHabilidades: habs,
          referenciaDepartamento: referencia.departamento,
          referenciaMunicipio: referencia.municipio,
          trabajadorDepartamento: t.departamento?.toLowerCase() || null,
          trabajadorMunicipio: t.municipio?.toLowerCase() || null,
        });

        // Umbral bajo para no ocultar coincidencias útiles (ej: misma zona con datos parciales).
        if (puntaje < 10) return null;

        const foto = await signUrl(t.foto_selfie);

        return {
          id: t.id,
          nombre_completo: t.nombre_completo,
          departamento: t.departamento,
          municipio: t.municipio,
          latitud: t.latitud !== null && t.latitud !== undefined ? parseFloat(t.latitud) : null,
          longitud: t.longitud !== null && t.longitud !== undefined ? parseFloat(t.longitud) : null,
          foto_selfie: foto,
          calificacion_promedio: parseFloat(t.calificacion_promedio || 0),
          total_calificaciones: Number(t.total_calificaciones || 0),
          anios_experiencia: t.anios_experiencia,
          disponibilidad: t.disponibilidad,
          nivel_estudios: t.nivel_estudios,
          acerca_de: t.acerca_de,
          habilidades: habilidadesRows.map((h) => h.habilidad),
          cultivos: cultivosRows.map((c) => c.cultivo),
          puntaje_match: puntaje,
          proximidad,
        };
      })
    );

    const filtrados = resultados.filter(Boolean).sort(
      (a, b) => b.puntaje_match - a.puntaje_match || b.calificacion_promedio - a.calificacion_promedio
    );

    res.json({
      recomendados: filtrados,
      referencia: {
        origen: referencia.origen,
        vacante_id: referencia.vacanteId,
        vacante_titulo: referencia.vacanteTitulo,
      },
    });
  } catch (err) {
    console.error('Error listando trabajadores recomendados:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function solicitarContacto(req, res) {
  try {
    const empleadorId = req.user.id;
    const trabajadorId = Number(req.params.id);
    const vacanteId = Number(req.body?.vacante_id);

    if (!Number.isFinite(trabajadorId) || !Number.isFinite(vacanteId)) {
      return res.status(400).json({ error: 'trabajador_id y vacante_id son obligatorios' });
    }

    const trabajador = await query(
      `SELECT id, nombre_completo FROM usuarios
       WHERE id = ? AND rol = 'trabajador' AND activo = 1 AND (eliminado IS NULL OR eliminado = 0)`,
      [trabajadorId]
    );
    if (!trabajador || trabajador.length === 0) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    const vacantes = await query(
      `SELECT id, titulo FROM vacantes
       WHERE id = ? AND empleador_id = ? AND eliminado = 0`,
      [vacanteId, empleadorId]
    );
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const vacanteTitulo = vacantes[0].titulo;
    const existente = await query(
      'SELECT id, estado FROM postulaciones WHERE vacante_id = ? AND trabajador_id = ?',
      [vacanteId, trabajadorId]
    );

    if (existente && existente.length > 0) {
      const post = existente[0];

      if (post.estado === 'aceptada') {
        const chatId = await crearChat(vacanteId, empleadorId, trabajadorId);
        return res.json({
          message: 'El chat ya está habilitado con este trabajador',
          postulacion_id: Number(post.id),
          estado: 'aceptada',
          chat_id: chatId,
        });
      }

      if (post.estado === 'contacto_solicitado') {
        return res.json({
          message: 'Ya enviaste una solicitud de contacto a este trabajador',
          postulacion_id: Number(post.id),
          estado: 'contacto_solicitado',
        });
      }

      await query(
        'UPDATE postulaciones SET estado = ?, mensaje = COALESCE(?, mensaje) WHERE id = ?',
        ['contacto_solicitado', req.body?.mensaje || null, post.id]
      );

      await crearNotificacion(
        trabajadorId,
        'contacto_solicitado',
        'Solicitud de contacto',
        `Un empleador quiere contactarte para la vacante "${vacanteTitulo}".`,
        { vacante_id: vacanteId }
      );

      return res.json({
        message: 'Solicitud de contacto enviada',
        postulacion_id: Number(post.id),
        estado: 'contacto_solicitado',
      });
    }

    const insert = await query(
      `INSERT INTO postulaciones (vacante_id, trabajador_id, estado, mensaje)
       VALUES (?, ?, 'contacto_solicitado', ?)`,
      [vacanteId, trabajadorId, req.body?.mensaje || null]
    );

    await crearNotificacion(
      trabajadorId,
      'contacto_solicitado',
      'Solicitud de contacto',
      `Un empleador quiere contactarte para la vacante "${vacanteTitulo}".`,
      { vacante_id: vacanteId }
    );

    res.status(201).json({
      message: 'Solicitud de contacto enviada',
      postulacion_id: Number(insert.insertId),
      estado: 'contacto_solicitado',
    });
  } catch (err) {
    console.error('Error solicitando contacto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listarTrabajadores,
  trabajadoresRecomendados,
  solicitarContacto,
};
