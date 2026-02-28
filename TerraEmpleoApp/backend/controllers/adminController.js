const { query } = require('../config/database');

// Dashboard - conteos
async function dashboard(req, res) {
  try {
    const [totalUsuarios] = await query('SELECT COUNT(*) as total FROM usuarios');
    const [totalTrabajadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'trabajador'");
    const [totalEmpleadores] = await query("SELECT COUNT(*) as total FROM usuarios WHERE rol = 'empleador'");
    const [totalVacantes] = await query('SELECT COUNT(*) as total FROM vacantes');
    const [vacantesActivas] = await query("SELECT COUNT(*) as total FROM vacantes WHERE estado = 'activa'");
    const [totalPostulaciones] = await query('SELECT COUNT(*) as total FROM postulaciones');

    res.json({
      totalUsuarios: Number(totalUsuarios.total),
      totalTrabajadores: Number(totalTrabajadores.total),
      totalEmpleadores: Number(totalEmpleadores.total),
      totalVacantes: Number(totalVacantes.total),
      vacantesActivas: Number(vacantesActivas.total),
      totalPostulaciones: Number(totalPostulaciones.total),
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
      SELECT id, rol, nombre_completo, celular, correo, departamento, municipio,
        verificado_sms, calificacion_promedio, activo, created_at
      FROM usuarios ORDER BY created_at DESC
    `);
    res.json({ usuarios });
  } catch (err) {
    console.error('Error listando usuarios:', err);
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
        (SELECT COUNT(*) FROM postulaciones p WHERE p.vacante_id = v.id) as total_postulaciones
      FROM vacantes v
      JOIN usuarios u ON u.id = v.empleador_id
      ORDER BY v.created_at DESC
    `);
    res.json({ vacantes });
  } catch (err) {
    console.error('Error admin listando vacantes:', err);
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
  try {
    const { id } = req.params;
    await query('DELETE FROM vacantes WHERE id = ?', [id]);
    res.json({ message: 'Vacante eliminada' });
  } catch (err) {
    console.error('Error eliminando vacante:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  dashboard, listarUsuarios, toggleUsuario, eliminarUsuario,
  listarTodasVacantes, listarTodasPostulaciones, eliminarVacante
};
