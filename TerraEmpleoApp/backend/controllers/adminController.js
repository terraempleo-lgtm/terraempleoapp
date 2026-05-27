const { query } = require('../config/database');
const { signFields, signArrayField, signUrl } = require('../config/s3');

// Dashboard - conteos
async function dashboard(req, res) {
  try {
    const [totalUsuarios] = await query('SELECT COUNT(*) as total FROM usuarios WHERE eliminado = 0');
    const [totalTrabajadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'trabajador' AND eliminado = 0");
    const [totalEmpleadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'empleador' AND eliminado = 0");
    const [totalVacantes] = await query('SELECT COUNT(*) as total FROM vacantes WHERE eliminado = 0');
    const [vacantesActivas] = await query("SELECT COUNT(*) as total FROM vacantes WHERE estado = 'activa' AND eliminado = 0");
    const [totalPostulaciones] = await query('SELECT COUNT(*) as total FROM postulaciones');
    const [totalCalificaciones] = await query('SELECT COUNT(*) as total FROM calificaciones');

    res.json({
      totalUsuarios: Number(totalUsuarios.total),
      trabajadores: Number(totalTrabajadores.total),
      empleadores: Number(totalEmpleadores.total),
      vacantes_total: Number(totalVacantes.total),
      vacantes_activas: Number(vacantesActivas.total),
      postulaciones: Number(totalPostulaciones.total),
      calificaciones: Number(totalCalificaciones.total),
    });
  } catch (err) {
    console.error('Error en dashboard:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Listar todos los usuarios
async function listarUsuarios(req, res) {
  try {
    const usuarios = await query(`
      SELECT u.id, u.rol, u.nombre_completo, u.celular, u.correo, u.departamento, u.municipio,
        u.verificado_sms, u.validacion_identidad_estado, u.calificacion_promedio, u.activo, u.created_at,
        u.foto_selfie,
        pe.nombre_empresa_finca
      FROM usuarios u
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = u.id
      WHERE u.eliminado = 0
      ORDER BY u.created_at DESC
    `);
    for (const u of usuarios) {
      u.activo = Number(u.activo) === 1;
      u.verificado_sms = Number(u.verificado_sms) === 1;
      u.foto_selfie = await signUrl(u.foto_selfie);
    }
    res.json(usuarios);
  } catch (err) {
    console.error('Error listando usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Listar cédulas pendientes de validación manual
async function listarCedulasPendientes(req, res) {
  try {
    const pendientes = await query(
      `SELECT u.id, u.rol, u.nombre_completo, u.cedula, u.foto_cedula,
              u.validacion_identidad_estado, u.validacion_identidad_enviado_at,
              u.created_at
       FROM usuarios u
       WHERE u.eliminado = 0
         AND u.rol IN ('trabajador', 'empleador')
         AND (u.foto_cedula IS NOT NULL OR u.foto_selfie_cedula IS NOT NULL)
         AND u.validacion_identidad_estado = 'pendiente'
       ORDER BY COALESCE(u.validacion_identidad_enviado_at, u.updated_at, u.created_at) ASC`
    );

    await signArrayField(pendientes, 'foto_cedula');

    const data = pendientes.map((item) => ({
      id: item.id,
      rol: item.rol,
      nombre_completo: item.nombre_completo,
      cedula: item.cedula,
      foto_cedula: item.foto_cedula,
      estado: item.validacion_identidad_estado,
      enviado_at: item.validacion_identidad_enviado_at || item.created_at,
    }));

    return res.json({ pendientes: data, total: data.length });
  } catch (err) {
    console.error('Error listando cédulas pendientes:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener detalle completo de un usuario (para admin preview)
async function getUsuarioDetalle(req, res) {
  try {
    const { id } = req.params;
    const users = await query('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!users || users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = users[0];
    delete user.password_hash;
    delete user.codigo_sms;
    user.foto_selfie = await signUrl(user.foto_selfie);

    let perfil = null;
    if (user.rol === 'trabajador') {
      const perfiles = await query('SELECT * FROM perfil_trabajador WHERE usuario_id = ?', [id]);
      if (perfiles.length > 0) {
        perfil = perfiles[0];
        perfil.habilidades = await query('SELECT * FROM trabajador_habilidades WHERE perfil_trabajador_id = ?', [perfil.id]);
        perfil.cultivos = await query('SELECT * FROM trabajador_cultivos WHERE perfil_trabajador_id = ?', [perfil.id]);
      }
    } else if (user.rol === 'empleador') {
      const perfiles = await query('SELECT * FROM perfil_empleador WHERE usuario_id = ?', [id]);
      if (perfiles.length > 0) {
        perfil = perfiles[0];
        perfil.cultivos = await query('SELECT * FROM empleador_cultivos WHERE perfil_empleador_id = ?', [perfil.id]);
        perfil.labores = await query('SELECT * FROM empleador_labores WHERE perfil_empleador_id = ?', [perfil.id]);
      }
    }

    // Obtener vacantes del usuario si es empleador
    let vacantes = [];
    if (user.rol === 'empleador') {
      vacantes = await query(`
        SELECT v.*, (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
        FROM vacantes v WHERE v.empleador_id = ? ORDER BY v.created_at DESC
      `, [id]);
      for (const v of vacantes) {
        v.total_postulaciones = Number(v.total_postulaciones || 0);
        if (v.monto_pago != null) v.monto_pago = Number(v.monto_pago);
        v.urgente = Boolean(v.urgente);
      }
    }

    // Obtener postulaciones si es trabajador
    let postulaciones = [];
    if (user.rol === 'trabajador') {
      postulaciones = await query(`
        SELECT p.*, v.titulo, v.departamento as v_dept, v.municipio as v_mun
        FROM postulaciones p JOIN vacantes v ON v.id = p.vacante_id
        WHERE p.trabajador_id = ? ORDER BY p.created_at DESC
      `, [id]);
    }

    const calificacionesRecibidas = await query(`
      SELECT c.id, c.calificador_id, c.vacante_id, c.estrellas, c.comentario, c.created_at,
        u.nombre_completo as nombre_calificador, u.rol as rol_calificador,
        v.titulo as vacante_titulo
      FROM calificaciones c
      JOIN usuarios u ON u.id = c.calificador_id
      LEFT JOIN vacantes v ON v.id = c.vacante_id
      WHERE c.calificado_id = ?
      ORDER BY c.created_at DESC
    `, [id]);

    res.json({ user, perfil, vacantes, postulaciones, calificacionesRecibidas });
  } catch (err) {
    console.error('Error obteniendo usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener documentos de validación interna de identidad para revisión manual
async function getDocumentosIdentidadUsuario(req, res) {
  try {
    const { id } = req.params;
    const usuarios = await query(
      `SELECT id, rol, nombre_completo, foto_selfie, foto_cedula, foto_selfie_cedula,
              validacion_identidad_estado, validacion_identidad_revisado_at, validacion_identidad_comentario
       FROM usuarios
       WHERE id = ? AND eliminado = 0`,
      [id]
    );

    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    await signFields(usuario, ['foto_selfie', 'foto_cedula', 'foto_selfie_cedula']);

    const documentos = {
      selfie: usuario.foto_selfie || null,
      cedula_frente: usuario.foto_cedula || null,
      selfie_con_cedula: usuario.foto_selfie_cedula || null,
    };

    res.json({
      usuario: {
        id: usuario.id,
        rol: usuario.rol,
        nombre_completo: usuario.nombre_completo,
      },
      documentos,
      revision: {
        estado: usuario.validacion_identidad_estado || 'pendiente',
        revisado_at: usuario.validacion_identidad_revisado_at || null,
        comentario: usuario.validacion_identidad_comentario || null,
      },
      tiene_documentos: Boolean(documentos.selfie || documentos.cedula_frente || documentos.selfie_con_cedula),
    });
  } catch (err) {
    console.error('Error obteniendo documentos de identidad:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Aprobar/rechazar validación interna de identidad
async function revisarValidacionIdentidadUsuario(req, res) {
  try {
    const { id } = req.params;
    const { estado, comentario } = req.body;

    if (!['aprobada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Use: aprobada o rechazada.' });
    }

    const usuarios = await query(
      `SELECT id, rol, foto_selfie, foto_cedula, foto_selfie_cedula
       FROM usuarios
       WHERE id = ? AND eliminado = 0`,
      [id]
    );

    if (!usuarios || usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = usuarios[0];
    if (usuario.rol === 'admin') {
      return res.status(400).json({ error: 'No se revisa validación interna para usuarios admin' });
    }

    if (!usuario.foto_cedula && !usuario.foto_selfie_cedula) {
      return res.status(400).json({ error: 'El usuario no tiene fotos de identificación para revisión.' });
    }

    await query(
      `UPDATE usuarios
       SET validacion_identidad_estado = ?,
           validacion_identidad_revisado_por = ?,
           validacion_identidad_revisado_at = NOW(),
           validacion_identidad_comentario = ?
       WHERE id = ?`,
      [estado, req.user.id, comentario || null, id]
    );

    return res.json({
      message: estado === 'aprobada'
        ? 'Validación interna aprobada correctamente'
        : 'Validación interna rechazada correctamente',
      estado,
    });
  } catch (err) {
    console.error('Error revisando validación interna de identidad:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualizar usuario (admin)
async function actualizarUsuario(req, res) {
  try {
    const { id } = req.params;
    const { activo, rol, nombre_completo, celular, correo } = req.body;

    const users = await query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (users[0].rol === 'admin' && activo === false) {
      return res.status(400).json({ error: 'No se puede desactivar un usuario admin' });
    }

    await query(`
      UPDATE usuarios
      SET
        activo = COALESCE(?, activo),
        rol = COALESCE(?, rol),
        nombre_completo = COALESCE(?, nombre_completo),
        celular = COALESCE(?, celular),
        correo = COALESCE(?, correo)
      WHERE id = ?
    `, [
      activo === undefined ? null : (activo ? 1 : 0),
      rol || null,
      nombre_completo || null,
      celular || null,
      correo || null,
      id,
    ]);

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Activar/desactivar usuario
async function toggleUsuario(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    await query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, id]);
    res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (err) {
    console.error('Error toggle usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Eliminar usuario (soft delete)
async function eliminarUsuario(req, res) {
  try {
    const { id } = req.params;
    const users = await query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (users[0].rol === 'admin') {
      return res.status(400).json({ error: 'No se puede eliminar un usuario admin' });
    }
    await query('UPDATE usuarios SET eliminado = 1, activo = 0 WHERE id = ?', [id]);
    await query('UPDATE vacantes SET eliminado = 1 WHERE empleador_id = ?', [id]);
    await query('DELETE FROM servicio_fotos WHERE servicio_id IN (SELECT id FROM servicios_especialista WHERE especialista_id = ?)', [id]);
    await query('DELETE FROM servicios_especialista WHERE especialista_id = ?', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Listar todas las vacantes (admin)
async function listarTodasVacantes(req, res) {
  try {
    const vacantes = await query(`
      SELECT v.*, u.nombre_completo as nombre_empleador,
        pe.nombre_empresa_finca,
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = v.empleador_id
      WHERE v.eliminado = 0
      ORDER BY v.created_at DESC
    `);
    for (const v of vacantes) {
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago != null) v.monto_pago = Number(v.monto_pago);
      v.urgente = Boolean(v.urgente);
      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
      const portada = await query('SELECT url FROM vacante_fotos WHERE vacante_id = ? ORDER BY orden ASC LIMIT 1', [v.id]);
      v.foto_portada = portada.length > 0 ? await signUrl(portada[0].url) : null;
    }
    res.json(vacantes);
  } catch (err) {
    console.error('Error admin listando vacantes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Crear vacante como admin (a nombre propio o a nombre de otro empleador)
async function crearVacanteComoAdmin(req, res) {
  try {
    const {
      titulo, descripcion, tipo_pago, monto_pago,
      departamento, municipio, vereda, urgente,
      cultivos, labores, empleador_id
    } = req.body;

    if (!titulo) return res.status(400).json({ error: 'El título es obligatorio' });

    // Si se pasa empleador_id, crear a nombre de ese empleador; si no, a nombre del admin
    const targetId = empleador_id || req.user.id;

    const result = await query(`
      INSERT INTO vacantes (empleador_id, titulo, descripcion, tipo_pago, monto_pago,
        departamento, municipio, vereda, urgente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [targetId, titulo, descripcion || null, tipo_pago || null, monto_pago || null,
        departamento || null, municipio || null, vereda || null, urgente ? 1 : 0]);

    const vacanteId = Number(result.insertId);

    if (cultivos && Array.isArray(cultivos)) {
      for (const c of cultivos) {
        await query('INSERT INTO vacante_cultivos (vacante_id, cultivo) VALUES (?, ?)', [vacanteId, c]);
      }
    }
    if (labores && Array.isArray(labores)) {
      for (const l of labores) {
        await query('INSERT INTO vacante_labores (vacante_id, labor) VALUES (?, ?)', [vacanteId, l]);
      }
    }

    res.status(201).json({ message: 'Vacante creada por admin', vacanteId });
  } catch (err) {
    console.error('Error admin creando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Listar empleadores (para select al crear vacante a nombre de otro)
async function listarEmpleadores(req, res) {
  try {
    const empleadores = await query(`
      SELECT u.id, u.nombre_completo, pe.nombre_empresa_finca
      FROM usuarios u
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = u.id
      WHERE u.rol = 'empleador' AND u.activo = 1 AND u.eliminado = 0
      ORDER BY u.nombre_completo
    `);
    res.json(empleadores);
  } catch (err) {
    console.error('Error listando empleadores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Ver postulaciones de cualquier vacante (admin)
async function verPostulacionesAdmin(req, res) {
  try {
    const { vacante_id } = req.params;
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
    console.error('Error admin postulaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Listar todas las postulaciones (admin)
async function listarTodasPostulaciones(req, res) {
  try {
    const postulaciones = await query(`
      SELECT p.*, v.titulo as titulo_vacante,
        ut.nombre_completo as nombre_trabajador,
        ue.nombre_completo as nombre_empleador
      FROM postulaciones p
      JOIN vacantes v ON v.id = p.vacante_id
      JOIN usuarios ut ON ut.id = p.trabajador_id
      JOIN usuarios ue ON ue.id = v.empleador_id
      ORDER BY p.created_at DESC
    `);
    res.json({ postulaciones });
  } catch (err) {
    console.error('Error admin listando postulaciones:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Eliminar vacante (admin - soft delete)
async function eliminarVacante(req, res) {
  try {
    const { id } = req.params;
    const existe = await query('SELECT id FROM vacantes WHERE id = ?', [id]);
    if (!existe || existe.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }
    await query('UPDATE vacantes SET eliminado = 1, estado = ? WHERE id = ?', ['cerrada', id]);
    res.json({ message: 'Vacante eliminada correctamente' });
  } catch (err) {
    console.error('Error eliminando vacante:', err);
    res.status(500).json({ error: 'No se pudo eliminar la vacante' });
  }
}

// Cambiar estado de vacante (admin)
async function cambiarEstadoVacante(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['activa','cerrada','pausada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    await query('UPDATE vacantes SET estado = ? WHERE id = ?', [estado, id]);
    res.json({ message: `Vacante ${estado}` });
  } catch (err) {
    console.error('Error cambiando estado vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualizar vacante (admin)
async function actualizarVacante(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const vacantes = await query('SELECT id FROM vacantes WHERE id = ?', [id]);
    if (!vacantes || vacantes.length === 0) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    if (estado !== undefined) {
      if (!['activa', 'cerrada', 'pausada'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      await query('UPDATE vacantes SET estado = ? WHERE id = ?', [estado, id]);
      return res.json({ message: `Vacante ${estado}` });
    }

    return res.status(400).json({ error: 'No hay campos para actualizar' });
  } catch (err) {
    console.error('Error actualizando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Eliminar empleador (finca) - soft delete
async function eliminarEmpleador(req, res) {
  try {
    const { id } = req.params;
    const users = await query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (users[0].rol !== 'empleador') {
      return res.status(400).json({ error: 'El usuario no es un empleador' });
    }
    await query('UPDATE usuarios SET eliminado = 1, activo = 0 WHERE id = ?', [id]);
    await query('UPDATE vacantes SET eliminado = 1, estado = ? WHERE empleador_id = ?', ['cerrada', id]);
    res.json({ message: 'Empleador (finca) y todos sus datos eliminados correctamente' });
  } catch (err) {
    console.error('Error eliminando empleador:', err);
    res.status(500).json({ error: 'No se pudo eliminar el empleador' });
  }
}

async function listarEmpresasPendientes(req, res) {
  try {
    const pendientes = await query(
      `SELECT u.id AS usuario_id, u.nombre_completo, u.celular, u.created_at,
              pe.id AS perfil_id, pe.nombre_empresa_finca, pe.doc_verificacion_url,
              pe.foto_finca_fachada, pe.verificacion_empresa_estado,
              pe.verificacion_empresa_revisado_at, pe.verificacion_empresa_comentario
       FROM perfil_empleador pe
       JOIN usuarios u ON u.id = pe.usuario_id
       WHERE u.eliminado = 0
         AND pe.doc_verificacion_url IS NOT NULL
         AND pe.verificacion_empresa_estado = 'pendiente'
       ORDER BY pe.updated_at ASC`
    );
    await signArrayField(pendientes, 'doc_verificacion_url');
    await signArrayField(pendientes, 'foto_finca_fachada');
    return res.json({ pendientes, total: pendientes.length });
  } catch (err) {
    console.error('Error listando empresas pendientes:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function revisarVerificacionEmpresa(req, res) {
  try {
    const { id } = req.params; // usuario_id del empleador
    const { estado, comentario } = req.body;
    if (!['aprobada', 'rechazada'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Use: aprobada o rechazada.' });
    }
    await query(
      `UPDATE perfil_empleador
       SET verificacion_empresa_estado = ?,
           verificacion_empresa_revisado_por = ?,
           verificacion_empresa_revisado_at = NOW(),
           verificacion_empresa_comentario = ?
       WHERE usuario_id = ?`,
      [estado, req.user.id, comentario || null, id]
    );
    return res.json({ message: estado === 'aprobada' ? 'Empresa verificada' : 'Empresa rechazada', estado });
  } catch (err) {
    console.error('Error revisando verificación empresa:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ── Admin: Servicios de especialistas ──

async function listarServiciosAdmin(req, res) {
  try {
    const rows = await query(`
      SELECT s.id, s.titulo, s.descripcion, s.cultivos, s.precio_desde, s.precio_hasta,
             s.modalidad, s.activo, s.created_at,
             u.id as especialista_id, u.nombre_completo, u.celular
      FROM servicios_especialista s
      JOIN usuarios u ON u.id = s.especialista_id
      WHERE u.eliminado = 0
      ORDER BY s.created_at DESC
    `);
    const servicios = rows.map(s => ({
      ...s,
      cultivos: (() => { try { return JSON.parse(s.cultivos || '[]'); } catch { return []; } })(),
    }));
    res.json({ servicios });
  } catch (err) {
    console.error('Error admin listando servicios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function editarServicioAdmin(req, res) {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT * FROM servicios_especialista WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });

    const { titulo, descripcion, precio_desde, precio_hasta, modalidad, activo } = req.body;
    await query(
      `UPDATE servicios_especialista SET
        titulo = COALESCE(?, titulo),
        descripcion = COALESCE(?, descripcion),
        precio_desde = COALESCE(?, precio_desde),
        precio_hasta = COALESCE(?, precio_hasta),
        modalidad = COALESCE(?, modalidad),
        activo = COALESCE(?, activo)
       WHERE id = ?`,
      [titulo ?? null, descripcion ?? null, precio_desde ?? null, precio_hasta ?? null, modalidad ?? null, activo ?? null, id]
    );
    res.json({ message: 'Servicio actualizado' });
  } catch (err) {
    console.error('Error admin editando servicio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarServicioAdmin(req, res) {
  try {
    const { id } = req.params;
    const [existing] = await query('SELECT id FROM servicios_especialista WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });
    await query('DELETE FROM servicio_fotos WHERE servicio_id = ?', [id]);
    await query('DELETE FROM servicios_especialista WHERE id = ?', [id]);
    res.json({ message: 'Servicio eliminado' });
  } catch (err) {
    console.error('Error admin eliminando servicio:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  dashboard, listarUsuarios, listarCedulasPendientes, getUsuarioDetalle, getDocumentosIdentidadUsuario, revisarValidacionIdentidadUsuario, actualizarUsuario, toggleUsuario, eliminarUsuario,
  listarTodasVacantes, listarTodasPostulaciones, eliminarVacante,
  crearVacanteComoAdmin, listarEmpleadores, verPostulacionesAdmin, cambiarEstadoVacante, actualizarVacante,
  eliminarEmpleador, listarEmpresasPendientes, revisarVerificacionEmpresa,
  listarServiciosAdmin, editarServicioAdmin, eliminarServicioAdmin,
};
