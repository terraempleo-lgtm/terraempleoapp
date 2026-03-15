const { query, getConnection } = require('../config/database');

// Dashboard - conteos
async function dashboard(req, res) {
  try {
    const [totalUsuarios] = await query('SELECT COUNT(*) as total FROM usuarios');
    const [totalTrabajadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'trabajador'");
    const [totalEmpleadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'empleador'");
    const [totalVacantes] = await query('SELECT COUNT(*) as total FROM vacantes');
    const [vacantesActivas] = await query("SELECT COUNT(*) as total FROM vacantes WHERE estado = 'activa'");
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
        u.verificado_sms, u.calificacion_promedio, u.activo, u.created_at,
        pe.nombre_empresa_finca
      FROM usuarios u
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = u.id
      ORDER BY u.created_at DESC
    `);
    for (const u of usuarios) {
      u.activo = Number(u.activo) === 1;
      u.verificado_sms = Number(u.verificado_sms) === 1;
    }
    res.json(usuarios);
  } catch (err) {
    console.error('Error listando usuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
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

    res.json({ user, perfil, vacantes, postulaciones });
  } catch (err) {
    console.error('Error obteniendo usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
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

// Eliminar usuario
async function eliminarUsuario(req, res) {
  try {
    const { id } = req.params;
    await query('DELETE FROM usuarios WHERE id = ? AND rol != ?', [id, 'admin']);
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
      ORDER BY v.created_at DESC
    `);
    for (const v of vacantes) {
      v.total_postulaciones = Number(v.total_postulaciones || 0);
      if (v.monto_pago != null) v.monto_pago = Number(v.monto_pago);
      v.urgente = Boolean(v.urgente);
      v.cultivos = await query('SELECT cultivo FROM vacante_cultivos WHERE vacante_id = ?', [v.id]);
      v.labores = await query('SELECT labor FROM vacante_labores WHERE vacante_id = ?', [v.id]);
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
      WHERE u.rol = 'empleador' AND u.activo = 1
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

// Eliminar vacante (admin)
async function eliminarVacante(req, res) {
  let conn;
  try {
    const { id } = req.params;

    conn = await getConnection();
    await conn.beginTransaction();

    const existe = await conn.query('SELECT id FROM vacantes WHERE id = ?', [id]);
    if (!existe || existe.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    // Eliminar fotos de S3
    const fotos = await conn.query('SELECT url FROM vacante_fotos WHERE vacante_id = ?', [id]);
    if (fotos && fotos.length > 0) {
      const { deleteFromS3 } = require('../config/s3');
      for (const foto of fotos) {
        await deleteFromS3(foto.url);
      }
    }

    // Eliminar mensajes de chats relacionados
    await conn.query('DELETE FROM mensajes WHERE chat_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [id]);
    // Limpiar referencias en notificaciones
    await conn.query('UPDATE notificaciones SET conversacion_id = NULL WHERE conversacion_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [id]);
    await conn.query('UPDATE notificaciones SET vacante_id = NULL WHERE vacante_id = ?', [id]);
    // Eliminar chats
    await conn.query('DELETE FROM chats WHERE vacante_id = ?', [id]);
    // Limpiar calificaciones
    await conn.query('UPDATE calificaciones SET vacante_id = NULL WHERE vacante_id = ?', [id]);

    await conn.query('DELETE FROM vacante_fotos WHERE vacante_id = ?', [id]);
    await conn.query('DELETE FROM vacante_cultivos WHERE vacante_id = ?', [id]);
    await conn.query('DELETE FROM vacante_labores WHERE vacante_id = ?', [id]);
    await conn.query('DELETE FROM postulaciones WHERE vacante_id = ?', [id]);
    await conn.query('DELETE FROM vacantes WHERE id = ?', [id]);

    await conn.commit();
    res.json({ message: 'Vacante eliminada correctamente' });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (rollbackErr) { console.error('Error en rollback:', rollbackErr); }
    }
    console.error('Error eliminando vacante:', err);
    res.status(500).json({ error: 'No se pudo eliminar la vacante' });
  } finally {
    if (conn) conn.release();
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

// Eliminar empleador (finca) con cascada completa
async function eliminarEmpleador(req, res) {
  let conn;
  try {
    const { id } = req.params;

    conn = await getConnection();
    await conn.beginTransaction();

    const users = await conn.query('SELECT id, rol FROM usuarios WHERE id = ?', [id]);
    if (!users || users.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (users[0].rol !== 'empleador') {
      await conn.rollback();
      return res.status(400).json({ error: 'El usuario no es un empleador' });
    }

    // Eliminar fotos de S3 (vacantes y usuario)
    const { deleteFromS3 } = require('../config/s3');

    const fotosVacantes = await conn.query(
      'SELECT vf.url FROM vacante_fotos vf JOIN vacantes v ON v.id = vf.vacante_id WHERE v.empleador_id = ?',
      [id]
    );
    for (const foto of fotosVacantes) {
      try { await deleteFromS3(foto.url); } catch (_) {}
    }

    const userData = await conn.query('SELECT foto_selfie, foto_cedula, foto_selfie_cedula FROM usuarios WHERE id = ?', [id]);
    if (userData.length > 0) {
      for (const field of ['foto_selfie', 'foto_cedula', 'foto_selfie_cedula']) {
        if (userData[0][field]) {
          try { await deleteFromS3(userData[0][field]); } catch (_) {}
        }
      }
    }

    // Limpiar referencias SET NULL antes de borrar (para evitar problemas con FKs)
    const vacantesIds = await conn.query('SELECT id FROM vacantes WHERE empleador_id = ?', [id]);
    for (const v of vacantesIds) {
      await conn.query('DELETE FROM mensajes WHERE chat_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [v.id]);
      await conn.query('UPDATE notificaciones SET conversacion_id = NULL WHERE conversacion_id IN (SELECT id FROM chats WHERE vacante_id = ?)', [v.id]);
      await conn.query('UPDATE notificaciones SET vacante_id = NULL WHERE vacante_id = ?', [v.id]);
      await conn.query('DELETE FROM chats WHERE vacante_id = ?', [v.id]);
      await conn.query('UPDATE calificaciones SET vacante_id = NULL WHERE vacante_id = ?', [v.id]);
    }

    // Eliminar notificaciones del usuario
    await conn.query('DELETE FROM notificaciones WHERE usuario_id = ?', [id]);

    // Eliminar usuario — CASCADE se encarga de vacantes, perfiles, postulaciones, etc.
    await conn.query('DELETE FROM usuarios WHERE id = ?', [id]);

    await conn.commit();
    res.json({ message: 'Empleador (finca) y todos sus datos eliminados correctamente' });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error('Error eliminando empleador:', err);
    res.status(500).json({ error: 'No se pudo eliminar el empleador' });
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  dashboard, listarUsuarios, getUsuarioDetalle, actualizarUsuario, toggleUsuario, eliminarUsuario,
  listarTodasVacantes, listarTodasPostulaciones, eliminarVacante,
  crearVacanteComoAdmin, listarEmpleadores, verPostulacionesAdmin, cambiarEstadoVacante, actualizarVacante,
  eliminarEmpleador
};
