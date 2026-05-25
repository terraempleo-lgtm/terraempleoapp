const { query } = require('../config/database');
const { s3, signUrl } = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const BUCKET = process.env.AWS_S3_BUCKET;

async function listarCertificados(req, res) {
  try {
    const usuarioId = req.params.usuario_id || req.user.id;
    const rows = await query(
      'SELECT id, nombre, entidad, anio, archivo_url, created_at FROM certificados_usuario WHERE usuario_id = ? ORDER BY anio DESC, id DESC',
      [usuarioId]
    );
    const certificados = await Promise.all(rows.map(async (c) => ({
      ...c,
      archivo_url: await signUrl(c.archivo_url),
    })));
    res.json({ certificados });
  } catch (err) {
    console.error('Error listando certificados:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function crearCertificado(req, res) {
  try {
    const usuarioId = req.user.id;
    const { nombre, entidad, anio } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre del certificado es obligatorio' });

    let archivo_url = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname || '').toLowerCase() || '.pdf';
      const key = `certificados/${usuarioId}_${Date.now()}${ext}`;
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/pdf',
      }));
      archivo_url = key;
    }

    const result = await query(
      'INSERT INTO certificados_usuario (usuario_id, nombre, entidad, anio, archivo_url) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, nombre.trim(), entidad?.trim() || null, anio ? Number(anio) : null, archivo_url]
    );
    const nuevo = await query('SELECT id, nombre, entidad, anio, archivo_url, created_at FROM certificados_usuario WHERE id = ?', [result.insertId]);
    res.status(201).json({ certificado: { ...nuevo[0], archivo_url: await signUrl(nuevo[0].archivo_url) } });
  } catch (err) {
    console.error('Error creando certificado:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function eliminarCertificado(req, res) {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;
    const rows = await query('SELECT id FROM certificados_usuario WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Certificado no encontrado' });
    await query('DELETE FROM certificados_usuario WHERE id = ?', [id]);
    res.json({ message: 'Certificado eliminado' });
  } catch (err) {
    console.error('Error eliminando certificado:', err);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = { listarCertificados, crearCertificado, eliminarCertificado };
