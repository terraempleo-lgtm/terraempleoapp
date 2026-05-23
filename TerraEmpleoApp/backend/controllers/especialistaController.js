const { query } = require('../config/database');
const { signUrl } = require('../config/s3');

async function listarEspecialistas(req, res) {
  try {
    const { busqueda, especialidad, municipio, departamento, modalidad, limit = 20, offset = 0 } = req.query;

    let sql = `
      SELECT
        u.id, u.nombre_completo, u.departamento, u.municipio,
        u.foto_selfie, u.calificacion_promedio, u.total_calificaciones,
        u.validacion_identidad_estado, u.latitud, u.longitud,
        pe.descripcion_servicio, pe.nivel_formacion, pe.titulo_certificacion,
        pe.anios_experiencia, pe.modalidad_trabajo, pe.radio_cobertura,
        GROUP_CONCAT(DISTINCT ee.especialidad ORDER BY ee.id SEPARATOR '||') AS especialidades,
        GROUP_CONCAT(DISTINCT ec.cultivo ORDER BY ec.id SEPARATOR '||') AS cultivos
      FROM usuarios u
      INNER JOIN perfil_especialista pe ON pe.usuario_id = u.id
      LEFT JOIN especialista_especialidades ee ON ee.perfil_especialista_id = pe.id
      LEFT JOIN especialista_cultivos ec ON ec.perfil_especialista_id = pe.id
      WHERE u.rol = 'especialista'
        AND u.activo = 1
        AND (u.eliminado = 0 OR u.eliminado IS NULL)
        AND (u.baneado = 0 OR u.baneado IS NULL)
    `;

    const params = [];

    if (busqueda) {
      sql += ` AND (u.nombre_completo LIKE ? OR pe.descripcion_servicio LIKE ?)`;
      params.push(`%${busqueda}%`, `%${busqueda}%`);
    }
    if (municipio) {
      sql += ` AND u.municipio = ?`;
      params.push(municipio);
    }
    if (departamento) {
      sql += ` AND u.departamento = ?`;
      params.push(departamento);
    }
    if (modalidad) {
      sql += ` AND pe.modalidad_trabajo = ?`;
      params.push(modalidad);
    }
    if (especialidad) {
      sql += ` AND EXISTS (
        SELECT 1 FROM especialista_especialidades ee2
        WHERE ee2.perfil_especialista_id = pe.id AND ee2.especialidad LIKE ?
      )`;
      params.push(`%${especialidad}%`);
    }

    sql += ` GROUP BY u.id ORDER BY u.calificacion_promedio DESC, u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = await query(sql, params);

    const especialistas = await Promise.all(rows.map(async (row) => {
      const fotoSelfie = row.foto_selfie ? await signUrl(row.foto_selfie).catch(() => null) : null;
      return {
        id: row.id,
        nombre_completo: row.nombre_completo,
        departamento: row.departamento,
        municipio: row.municipio,
        latitud: row.latitud,
        longitud: row.longitud,
        foto_selfie: fotoSelfie,
        calificacion_promedio: Number(row.calificacion_promedio) || 0,
        total_calificaciones: Number(row.total_calificaciones) || 0,
        verificado: row.validacion_identidad_estado === 'aprobada',
        descripcion_servicio: row.descripcion_servicio,
        nivel_formacion: row.nivel_formacion,
        titulo_certificacion: row.titulo_certificacion,
        anios_experiencia: row.anios_experiencia,
        modalidad_trabajo: row.modalidad_trabajo,
        radio_cobertura: row.radio_cobertura,
        especialidades: row.especialidades ? row.especialidades.split('||') : [],
        cultivos: row.cultivos ? row.cultivos.split('||') : [],
      };
    }));

    res.json({ especialistas, total: especialistas.length });
  } catch (err) {
    console.error('Error listando especialistas:', err);
    res.status(500).json({ error: 'Error al obtener especialistas.' });
  }
}

async function getPerfilEspecialista(req, res) {
  try {
    const { id } = req.params;

    const rows = await query(`
      SELECT
        u.id, u.nombre_completo, u.departamento, u.municipio, u.celular,
        u.foto_selfie, u.calificacion_promedio, u.total_calificaciones,
        u.validacion_identidad_estado, u.latitud, u.longitud,
        pe.id AS perfil_id, pe.descripcion_servicio, pe.nivel_formacion,
        pe.titulo_certificacion, pe.anios_experiencia, pe.modalidad_trabajo,
        pe.radio_cobertura, pe.hoja_vida_url, pe.hoja_vida_nombre
      FROM usuarios u
      INNER JOIN perfil_especialista pe ON pe.usuario_id = u.id
      WHERE u.id = ? AND u.rol = 'especialista' AND u.activo = 1
    `, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Especialista no encontrado.' });
    }

    const row = rows[0];
    const perfilId = Number(row.perfil_id);

    const [especialidades, cultivos, fotosRows] = await Promise.all([
      query('SELECT especialidad FROM especialista_especialidades WHERE perfil_especialista_id = ?', [perfilId]),
      query('SELECT cultivo FROM especialista_cultivos WHERE perfil_especialista_id = ?', [perfilId]),
      query('SELECT url FROM especialista_fotos_trabajo WHERE perfil_especialista_id = ? ORDER BY orden, id', [perfilId]),
    ]);

    const fotoSelfie = row.foto_selfie ? await signUrl(row.foto_selfie).catch(() => null) : null;
    const fotosSignedUrls = await Promise.all(fotosRows.map(f => signUrl(f.url).catch(() => null)));
    const hojaVidaUrl = row.hoja_vida_url ? await signUrl(row.hoja_vida_url).catch(() => null) : null;

    res.json({
      id: row.id,
      nombre_completo: row.nombre_completo,
      departamento: row.departamento,
      municipio: row.municipio,
      celular: row.celular,
      latitud: row.latitud,
      longitud: row.longitud,
      foto_selfie: fotoSelfie,
      calificacion_promedio: Number(row.calificacion_promedio) || 0,
      total_calificaciones: Number(row.total_calificaciones) || 0,
      verificado: row.validacion_identidad_estado === 'aprobada',
      descripcion_servicio: row.descripcion_servicio,
      nivel_formacion: row.nivel_formacion,
      titulo_certificacion: row.titulo_certificacion,
      anios_experiencia: row.anios_experiencia,
      modalidad_trabajo: row.modalidad_trabajo,
      radio_cobertura: row.radio_cobertura,
      hoja_vida_url: hojaVidaUrl,
      hoja_vida_nombre: row.hoja_vida_nombre,
      especialidades: especialidades.map(e => e.especialidad),
      cultivos: cultivos.map(c => c.cultivo),
      fotos_trabajo: fotosSignedUrls.filter(Boolean),
    });
  } catch (err) {
    console.error('Error obteniendo perfil especialista:', err);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
}

async function contactarEspecialista(req, res) {
  try {
    const empleadorId = req.user.id;
    const especialistaId = Number(req.params.id);
    const vacanteId = Number(req.body?.vacante_id);

    if (!Number.isFinite(especialistaId)) {
      return res.status(400).json({ error: 'ID de especialista inválido' });
    }

    // Verificar que el especialista existe
    const esps = await query('SELECT id, nombre_completo FROM usuarios WHERE id = ? AND rol = ?', [especialistaId, 'especialista']);
    if (!esps || esps.length === 0) return res.status(404).json({ error: 'Especialista no encontrado' });
    const nombreEsp = esps[0].nombre_completo;

    // Si no hay vacante, obtener la primera activa del empleador
    let vid = Number.isFinite(vacanteId) ? vacanteId : null;
    if (!vid) {
      const vacantes = await query(
        `SELECT v.id FROM vacantes v
         INNER JOIN perfil_empleador pe ON pe.id = v.empleador_id
         WHERE pe.usuario_id = ? AND v.estado = 'activa' AND (v.eliminado IS NULL OR v.eliminado = 0)
         LIMIT 1`,
        [empleadorId]
      );
      if (vacantes && vacantes.length > 0) vid = Number(vacantes[0].id);
    }

    if (!vid) {
      return res.status(400).json({ error: 'Necesitas tener una vacante activa para contactar especialistas.' });
    }

    // Buscar postulación existente
    const existente = await query(
      'SELECT id, estado FROM postulaciones WHERE vacante_id = ? AND trabajador_id = ?',
      [vid, especialistaId]
    );

    if (existente && existente.length > 0) {
      const post = existente[0];
      if (post.estado === 'aceptada') {
        // Buscar chat existente
        const chats = await query('SELECT id FROM chats WHERE vacante_id = ? AND trabajador_id = ?', [vid, especialistaId]);
        const chatId = chats && chats.length > 0 ? Number(chats[0].id) : null;
        return res.json({ estado: 'aceptada', chat_id: chatId });
      }
      if (post.estado === 'contacto_solicitado') {
        return res.json({ estado: 'contacto_solicitado' });
      }
      await query('UPDATE postulaciones SET estado = ? WHERE id = ?', ['contacto_solicitado', post.id]);
      return res.json({ estado: 'contacto_solicitado' });
    }

    await query(
      `INSERT INTO postulaciones (vacante_id, trabajador_id, estado, mensaje) VALUES (?, ?, 'contacto_solicitado', ?)`,
      [vid, especialistaId, req.body?.mensaje || null]
    );

    res.status(201).json({ estado: 'contacto_solicitado' });
  } catch (err) {
    console.error('Error contactando especialista:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listarEspecialistas, getPerfilEspecialista, contactarEspecialista };
