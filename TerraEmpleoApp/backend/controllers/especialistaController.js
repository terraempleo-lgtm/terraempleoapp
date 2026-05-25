const { query } = require('../config/database');
const { signUrl } = require('../config/s3');
const { crearNotificacion } = require('./notificacionesController');

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

    const [especialidades, cultivos, fotosRows, experiencias] = await Promise.all([
      query('SELECT especialidad FROM especialista_especialidades WHERE perfil_especialista_id = ?', [perfilId]),
      query('SELECT cultivo FROM especialista_cultivos WHERE perfil_especialista_id = ?', [perfilId]),
      query('SELECT id, url FROM especialista_fotos_trabajo WHERE perfil_especialista_id = ? ORDER BY orden, id', [perfilId]),
      query('SELECT id, entidad, descripcion, duracion FROM experiencias_laborales WHERE usuario_id = ? ORDER BY orden, id', [row.id]),
    ]);

    const fotoSelfie = row.foto_selfie ? await signUrl(row.foto_selfie).catch(() => null) : null;
    const fotosConUrl = await Promise.all(fotosRows.map(async f => ({ id: f.id, url: await signUrl(f.url).catch(() => null) })));
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
      fotos_trabajo: fotosConUrl.filter(f => f.url),
      experiencias,
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

    if (!Number.isFinite(especialistaId)) {
      return res.status(400).json({ error: 'ID de especialista inválido' });
    }

    // Verificar que el especialista existe
    const esps = await query('SELECT id FROM usuarios WHERE id = ? AND rol = ? AND activo = 1', [especialistaId, 'especialista']);
    if (!esps || esps.length === 0) return res.status(404).json({ error: 'Especialista no encontrado' });

    // Buscar contacto existente
    const existente = await query(
      'SELECT id, estado, chat_id FROM contactos_especialista WHERE empleador_id = ? AND especialista_id = ?',
      [empleadorId, especialistaId]
    );

    if (existente && existente.length > 0) {
      const c = existente[0];
      if (c.estado === 'aceptado') {
        return res.json({ estado: 'aceptada', chat_id: c.chat_id ? Number(c.chat_id) : null });
      }
      return res.json({ estado: 'contacto_solicitado' });
    }

    await query(
      'INSERT INTO contactos_especialista (empleador_id, especialista_id, estado) VALUES (?, ?, ?)',
      [empleadorId, especialistaId, 'solicitado']
    );

    // Notificar al especialista
    const emp = await query('SELECT nombre_completo FROM usuarios WHERE id = ?', [empleadorId]);
    const nombreEmp = emp?.[0]?.nombre_completo || 'Un empleador';
    await crearNotificacion(
      especialistaId, 'contacto',
      '¡Nuevo contacto!',
      `${nombreEmp} quiere contactarte para un proyecto. Revisa la solicitud.`,
      {}
    ).catch(() => {});

    res.status(201).json({ estado: 'contacto_solicitado' });
  } catch (err) {
    console.error('Error contactando especialista:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function getContactoEstado(req, res) {
  try {
    const empleadorId = req.user.id;
    const especialistaId = Number(req.params.id);
    const rows = await query(
      'SELECT estado, chat_id FROM contactos_especialista WHERE empleador_id = ? AND especialista_id = ?',
      [empleadorId, especialistaId]
    );
    if (!rows || rows.length === 0) return res.json({ estado: null });
    const c = rows[0];
    res.json({ estado: c.estado === 'solicitado' ? 'contacto_solicitado' : c.estado === 'aceptado' ? 'aceptada' : c.estado, chat_id: c.chat_id ? Number(c.chat_id) : null });
  } catch (err) {
    console.error('Error obteniendo estado contacto:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function misSolicitudesContacto(req, res) {
  try {
    const especialistaId = req.user.id;
    const rows = await query(
      `SELECT ce.id, ce.empleador_id, ce.estado, ce.chat_id, ce.created_at,
              u.nombre_completo, u.foto_selfie, u.municipio, u.departamento
       FROM contactos_especialista ce
       JOIN usuarios u ON u.id = ce.empleador_id
       WHERE ce.especialista_id = ?
       ORDER BY ce.created_at DESC`,
      [especialistaId]
    );

    const solicitudes = await Promise.all((rows || []).map(async (r) => ({
      id: Number(r.id),
      empleador_id: Number(r.empleador_id),
      nombre_completo: r.nombre_completo,
      foto_selfie: r.foto_selfie ? await signUrl(r.foto_selfie).catch(() => null) : null,
      municipio: r.municipio,
      departamento: r.departamento,
      estado: r.estado,
      chat_id: r.chat_id ? Number(r.chat_id) : null,
      created_at: r.created_at,
    })));

    res.json({ solicitudes });
  } catch (err) {
    console.error('Error listando solicitudes de contacto:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function responderSolicitudContacto(req, res) {
  try {
    const especialistaId = req.user.id;
    const solicitudId = Number(req.params.id);
    const { accion } = req.body; // 'aceptar' | 'rechazar'

    if (!['aceptar', 'rechazar'].includes(accion)) {
      return res.status(400).json({ error: 'accion debe ser aceptar o rechazar' });
    }

    const rows = await query(
      'SELECT id, empleador_id, estado, chat_id FROM contactos_especialista WHERE id = ? AND especialista_id = ?',
      [solicitudId, especialistaId]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const solicitud = rows[0];
    if (solicitud.estado !== 'solicitado') {
      return res.status(409).json({ error: 'Esta solicitud ya fue respondida' });
    }

    if (accion === 'rechazar') {
      await query('UPDATE contactos_especialista SET estado = ? WHERE id = ?', ['rechazado', solicitudId]);
      return res.json({ estado: 'rechazado' });
    }

    // Aceptar: crear chat
    const chatResult = await query(
      'INSERT INTO chats (usuario1_id, usuario2_id) VALUES (?, ?)',
      [solicitud.empleador_id, especialistaId]
    );
    const chatId = chatResult.insertId;

    await query(
      'UPDATE contactos_especialista SET estado = ?, chat_id = ? WHERE id = ?',
      ['aceptado', chatId, solicitudId]
    );

    // Notificar al empleador
    const esp = await query('SELECT nombre_completo FROM usuarios WHERE id = ?', [especialistaId]);
    const nombreEsp = esp?.[0]?.nombre_completo || 'El especialista';
    await crearNotificacion(
      solicitud.empleador_id, 'contacto',
      '¡Solicitud aceptada!',
      `${nombreEsp} aceptó tu solicitud de contacto. Ya puedes chatear con él/ella.`,
      { chat_id: chatId }
    ).catch(() => {});

    res.json({ estado: 'aceptado', chat_id: chatId });
  } catch (err) {
    console.error('Error respondiendo solicitud:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { listarEspecialistas, getPerfilEspecialista, contactarEspecialista, getContactoEstado, misSolicitudesContacto, responderSolicitudContacto };
