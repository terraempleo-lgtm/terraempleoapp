const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');
const { signUrl } = require('../config/s3');

// GET /api/empleadores/:id/perfil — perfil público del empleador con fotos de finca
router.get('/:id/perfil', authMiddleware, async (req, res) => {
  try {
    const empleadorId = Number(req.params.id);
    const rows = await query(
      `SELECT u.id, u.nombre_completo, u.municipio, u.departamento, u.foto_selfie, u.calificacion_promedio, u.total_calificaciones,
              pe.id as perfil_id, pe.nombre_empresa_finca, pe.acerca_de, pe.ofrece_alojamiento, pe.ofrece_alimentacion, pe.beneficios_extra
       FROM usuarios u
       LEFT JOIN perfil_empleador pe ON pe.usuario_id = u.id
       WHERE u.id = ? AND u.rol = 'empleador' AND u.activo = 1`,
      [empleadorId]
    );
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Empleador no encontrado' });
    const row = rows[0];
    const perfilId = row.perfil_id;

    let fotosFinca = [];
    if (perfilId) {
      const fotosRows = await query('SELECT id, url FROM empleador_fotos_finca WHERE perfil_empleador_id = ? ORDER BY orden, id', [perfilId]);
      fotosFinca = await Promise.all(fotosRows.map(async f => ({ id: f.id, url: await signUrl(f.url).catch(() => null) })));
    }

    const fotoSelfie = row.foto_selfie ? await signUrl(row.foto_selfie).catch(() => null) : null;

    res.json({
      empleador: {
        id: row.id,
        nombre_completo: row.nombre_completo,
        nombre_empresa_finca: row.nombre_empresa_finca,
        municipio: row.municipio,
        departamento: row.departamento,
        foto_selfie: fotoSelfie,
        calificacion_promedio: Number(row.calificacion_promedio || 0),
        total_calificaciones: Number(row.total_calificaciones || 0),
        acerca_de: row.acerca_de,
        ofrece_alojamiento: !!row.ofrece_alojamiento,
        ofrece_alimentacion: !!row.ofrece_alimentacion,
        beneficios_extra: row.beneficios_extra,
        fotos_finca: fotosFinca.filter(f => f.url),
      },
    });
  } catch (err) {
    console.error('Error obteniendo perfil empleador:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
