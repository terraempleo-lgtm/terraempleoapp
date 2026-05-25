const { query } = require('../config/database');
const { s3, signUrl } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const BUCKET = process.env.AWS_S3_BUCKET;

async function signFotos(fotos) {
  return Promise.all(fotos.map(async (f) => ({ ...f, url: await signUrl(f.url) })));
}

// GET /api/servicios-especialista — feed para empleador (todos los servicios activos)
async function listarServicios(req, res) {
  try {
    const rows = await query(`
      SELECT s.id, s.titulo, s.descripcion, s.cultivos, s.precio_desde, s.precio_hasta,
             s.modalidad, s.activo, s.created_at,
             u.id as especialista_id, u.nombre_completo, u.foto_selfie, u.celular,
             pe.titulo_profesional, pe.municipio, pe.departamento
      FROM servicios_especialista s
      JOIN usuarios u ON u.id = s.especialista_id
      LEFT JOIN perfil_especialista pe ON pe.usuario_id = u.id
      WHERE s.activo = 1
      ORDER BY s.created_at DESC
      LIMIT 50
    `);

    const servicios = await Promise.all(rows.map(async (s) => {
      const fotos = await query('SELECT id, url, orden FROM servicio_fotos WHERE servicio_id = ? ORDER BY orden', [s.id]);
      return {
        ...s,
        cultivos: s.cultivos ? JSON.parse(s.cultivos) : [],
        foto_selfie: await signUrl(s.foto_selfie),
        fotos: await signFotos(fotos),
      };
    }));

    res.json({ servicios });
  } catch (err) {
    console.error('Error listando servicios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/servicios-especialista/mis-servicios — servicios del especialista autenticado
async function misServicios(req, res) {
  try {
    const rows = await query(
      `SELECT id, titulo, descripcion, cultivos, precio_desde, precio_hasta, modalidad, activo, created_at
       FROM servicios_especialista WHERE especialista_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    const servicios = await Promise.all(rows.map(async (s) => {
      const fotos = await query('SELECT id, url, orden FROM servicio_fotos WHERE servicio_id = ? ORDER BY orden', [s.id]);
      return { ...s, cultivos: s.cultivos ? JSON.parse(s.cultivos) : [], fotos: await signFotos(fotos) };
    }));
    res.json({ servicios });
  } catch (err) {
    console.error('Error listando mis servicios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// GET /api/servicios-especialista/:id
async function detalleServicio(req, res) {
  try {
    const [s] = await query(`
      SELECT s.id, s.titulo, s.descripcion, s.cultivos, s.precio_desde, s.precio_hasta,
             s.modalidad, s.activo, s.created_at,
             u.id as especialista_id, u.nombre_completo, u.foto_selfie, u.celular,
             pe.titulo_profesional, pe.municipio, pe.departamento, pe.calificacion_promedio
      FROM servicios_especialista s
      JOIN usuarios u ON u.id = s.especialista_id
      LEFT JOIN perfil_especialista pe ON pe.usuario_id = u.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!s) return res.status(404).json({ error: 'Servicio no encontrado' });

    const fotos = await query('SELECT id, url, orden FROM servicio_fotos WHERE servicio_id = ? ORDER BY orden', [s.id]);
    res.json({
      servicio: {
        ...s,
        cultivos: s.cultivos ? JSON.parse(s.cultivos) : [],
        foto_selfie: await signUrl(s.foto_selfie),
        fotos: await signFotos(fotos),
      },
    });
  } catch (err) {
    console.error('Error detalle servicio:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/servicios-especialista
async function crearServicio(req, res) {
  try {
    console.log('crearServicio body:', JSON.stringify(req.body));
    const { titulo, descripcion, cultivos, precio_desde, precio_hasta, modalidad } = req.body;
    if (!titulo?.trim()) return res.status(400).json({ error: 'El título del servicio es obligatorio' });

    const cultivosJson = Array.isArray(cultivos) ? JSON.stringify(cultivos) : (typeof cultivos === 'string' ? cultivos : '[]');
    const result = await query(
      `INSERT INTO servicios_especialista (especialista_id, titulo, descripcion, cultivos, precio_desde, precio_hasta, modalidad)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, titulo.trim(), descripcion || null, cultivosJson,
       precio_desde || null, precio_hasta || null, modalidad || null]
    );
    const id = result.insertId;
    const servicio = await query('SELECT * FROM servicios_especialista WHERE id = ?', [id]);
    res.status(201).json({ servicio: servicio[0], id, message: 'Servicio creado' });
  } catch (err) {
    console.error('Error creando servicio:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// PUT /api/servicios-especialista/:id
async function editarServicio(req, res) {
  try {
    const existing = await query('SELECT * FROM servicios_especialista WHERE id = ? AND especialista_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Servicio no encontrado' });

    const current = existing[0];
    const { titulo, descripcion, cultivos, precio_desde, precio_hasta, modalidad, activo } = req.body;

    const newTitulo = titulo !== undefined ? titulo : current.titulo;
    const newDescripcion = descripcion !== undefined ? descripcion : current.descripcion;
    const newCultivos = cultivos !== undefined
      ? (Array.isArray(cultivos) ? JSON.stringify(cultivos) : cultivos)
      : (current.cultivos || '[]');
    const newPrecioDesde = precio_desde !== undefined ? precio_desde || null : current.precio_desde;
    const newPrecioHasta = precio_hasta !== undefined ? precio_hasta || null : current.precio_hasta;
    const newModalidad = modalidad !== undefined ? modalidad || null : current.modalidad;
    const newActivo = activo !== undefined ? activo : current.activo;

    await query(
      `UPDATE servicios_especialista SET titulo=?, descripcion=?, cultivos=?, precio_desde=?, precio_hasta=?, modalidad=?, activo=? WHERE id=?`,
      [newTitulo, newDescripcion || null, newCultivos, newPrecioDesde, newPrecioHasta, newModalidad, newActivo, req.params.id]
    );
    res.json({ message: 'Servicio actualizado' });
  } catch (err) {
    console.error('Error editando servicio:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// DELETE /api/servicios-especialista/:id
async function eliminarServicio(req, res) {
  try {
    const existing = await query('SELECT id FROM servicios_especialista WHERE id = ? AND especialista_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    await query('DELETE FROM servicios_especialista WHERE id = ?', [req.params.id]);
    res.json({ message: 'Servicio eliminado' });
  } catch (err) {
    console.error('Error eliminando servicio:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// POST /api/servicios-especialista/:id/fotos — agregar fotos a servicio existente
async function agregarFoto(req, res) {
  try {
    const existing = await query('SELECT id FROM servicios_especialista WHERE id = ? AND especialista_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Servicio no encontrado' });

    const countRows = await query('SELECT COUNT(*) as cnt FROM servicio_fotos WHERE servicio_id = ?', [req.params.id]);
    const current = countRows[0].cnt;
    if (current >= 4) return res.status(400).json({ error: 'Máximo 4 fotos por servicio' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No se recibió archivo' });

    const key = `servicios/${req.user.id}/${req.params.id}_foto${Date.now()}${path.extname(file.originalname || '.jpg')}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    const result = await query('INSERT INTO servicio_fotos (servicio_id, url, orden) VALUES (?, ?, ?)', [req.params.id, key, current]);
    res.json({ foto: { id: result.insertId, url: await signUrl(key), orden: current } });
  } catch (err) {
    console.error('Error agregando foto:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

// DELETE /api/servicios-especialista/:id/fotos/:fotoId
async function eliminarFoto(req, res) {
  try {
    const existing = await query('SELECT id FROM servicios_especialista WHERE id = ? AND especialista_id = ?', [req.params.id, req.user.id]);
    if (!existing.length) return res.status(404).json({ error: 'Servicio no encontrado' });
    await query('DELETE FROM servicio_fotos WHERE id = ? AND servicio_id = ?', [req.params.fotoId, req.params.id]);
    res.json({ message: 'Foto eliminada' });
  } catch (err) {
    console.error('Error eliminando foto:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { listarServicios, misServicios, detalleServicio, crearServicio, editarServicio, eliminarServicio, agregarFoto, eliminarFoto };
