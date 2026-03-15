const { query } = require('../config/database');

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
        u.verificado_sms, u.calificacion_promedio, u.activo, u.created_at,
        pe.nombre_empresa_finca
      FROM usuarios u
      LEFT JOIN perfil_empleador pe ON pe.usuario_id = u.id
      WHERE u.eliminado = 0
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

module.exports = {
  dashboard, listarUsuarios, getUsuarioDetalle, actualizarUsuario, toggleUsuario, eliminarUsuario,
  listarTodasVacantes, listarTodasPostulaciones, eliminarVacante,
  crearVacanteComoAdmin, listarEmpleadores, verPostulacionesAdmin, cambiarEstadoVacante, actualizarVacante,
  eliminarEmpleador
};
