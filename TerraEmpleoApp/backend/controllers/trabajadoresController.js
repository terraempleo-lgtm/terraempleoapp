const { query } = require('../config/database');
const { signUrl } = require('../config/s3');

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
      SELECT u.id, u.nombre_completo, u.departamento, u.municipio, u.foto_selfie,
        u.calificacion_promedio, u.total_calificaciones,
        pt.id as perfil_id, pt.anios_experiencia, pt.disponibilidad, pt.nivel_estudios, pt.acerca_de
      FROM usuarios u
      JOIN perfil_trabajador pt ON pt.usuario_id = u.id
      WHERE u.rol = 'trabajador' AND u.activo = 1
        AND (u.eliminado IS NULL OR u.eliminado = 0)
        ${whereExtra}
    `, params);

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

module.exports = { listarTrabajadores };
