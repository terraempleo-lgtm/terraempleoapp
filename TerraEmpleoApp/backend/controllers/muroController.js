const { query } = require('../config/database');
const { signArrayField, signUrl } = require('../config/s3');
const { crearChat } = require('./chatController');
const { crearNotificacion } = require('./notificacionesController');

// ─────────────────────────────────────────────────────────────────────────────
// Muro de compra/venta: los agricultores publican productos (café u otros)
// para vender u ofrecen comprar. El botón "Comprar/Contactar" abre un chat
// directo con el autor de la publicación.
// ─────────────────────────────────────────────────────────────────────────────

async function listar(req, res) {
  try {
    const { tipo, busqueda, mias } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const porPagina = 20;

    const where = ["p.estado = 'activa'"];
    const params = [];
    if (mias === '1') {
      where.length = 0;
      where.push('p.usuario_id = ?');
      params.push(req.user.id);
    }
    if (tipo && ['venta', 'compra'].includes(tipo)) {
      where.push('p.tipo = ?');
      params.push(tipo);
    }
    if (busqueda && String(busqueda).trim().length >= 2) {
      where.push('(p.producto LIKE ? OR p.descripcion LIKE ? OR p.ubicacion LIKE ?)');
      const q = `%${String(busqueda).trim()}%`;
      params.push(q, q, q);
    }

    const rows = await query(`
      SELECT p.*,
        u.nombre_completo AS autor_nombre,
        u.foto_selfie AS autor_foto,
        u.rol AS autor_rol
      FROM muro_publicaciones p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT ${porPagina + 1} OFFSET ${(page - 1) * porPagina}
    `, params);

    const hayMas = rows.length > porPagina;
    const publicaciones = rows.slice(0, porPagina);
    await signArrayField(publicaciones, 'autor_foto');
    for (const p of publicaciones) {
      if (p.foto_url) p.foto_url = await signUrl(p.foto_url);
      p.es_mia = Number(p.usuario_id) === Number(req.user.id);
    }

    res.json({ publicaciones, hay_mas: hayMas, page });
  } catch (err) {
    console.error('muro listar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crear(req, res) {
  try {
    const usuarioId = req.user.id;
    const { tipo, producto, descripcion, cantidad, precio, unidad, ubicacion } = req.body;

    if (!producto || !String(producto).trim()) {
      return res.status(400).json({ error: 'Indica el producto (ej: Café pergamino)' });
    }
    if (tipo && !['venta', 'compra'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    const fotoUrl = req.file ? (req.file.location || null) : null;

    const result = await query(`
      INSERT INTO muro_publicaciones
        (usuario_id, tipo, producto, descripcion, cantidad, precio, unidad, foto_url, ubicacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      usuarioId,
      tipo || 'venta',
      String(producto).trim(),
      descripcion || null,
      cantidad || null,
      precio ? Number(precio) : null,
      unidad || null,
      fotoUrl,
      ubicacion || null,
    ]);

    res.status(201).json({ message: 'Publicación creada', id: Number(result.insertId) });
  } catch (err) {
    console.error('muro crear:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT usuario_id FROM muro_publicaciones WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (Number(rows[0].usuario_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Solo el autor puede editar su publicación' });
    }

    const campos = ['tipo', 'producto', 'descripcion', 'cantidad', 'precio', 'unidad', 'ubicacion', 'estado'];
    const sets = [];
    const params = [];
    for (const c of campos) {
      if (req.body[c] !== undefined) {
        sets.push(`${c} = ?`);
        params.push(req.body[c] === '' ? null : req.body[c]);
      }
    }
    if (!sets.length) return res.json({ message: 'Sin cambios' });
    params.push(id);
    await query(`UPDATE muro_publicaciones SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Publicación actualizada' });
  } catch (err) {
    console.error('muro actualizar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminar(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT usuario_id FROM muro_publicaciones WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (Number(rows[0].usuario_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Solo el autor puede eliminar su publicación' });
    }
    await query('DELETE FROM muro_publicaciones WHERE id = ?', [id]);
    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    console.error('muro eliminar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Botón "Comprar / Contactar": crea (o reutiliza) un chat directo entre el
// interesado y el autor de la publicación y devuelve el chat_id.
async function contactar(req, res) {
  try {
    const interesadoId = req.user.id;
    const id = Number(req.params.id);
    const rows = await query(`
      SELECT p.id, p.usuario_id, p.producto, p.tipo, u.nombre_completo AS autor_nombre
      FROM muro_publicaciones p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE p.id = ?
    `, [id]);
    const pub = rows && rows[0];
    if (!pub) return res.status(404).json({ error: 'Publicación no encontrada' });
    if (Number(pub.usuario_id) === Number(interesadoId)) {
      return res.status(400).json({ error: 'Es tu propia publicación' });
    }

    // Chat sin vacante: autor en empleador_id, interesado en trabajador_id
    // (los checks de acceso a mensajes validan por cualquiera de las dos columnas).
    const chatId = await crearChat(null, pub.usuario_id, interesadoId);
    if (!chatId) return res.status(500).json({ error: 'No se pudo crear el chat' });

    // Primer mensaje automático con contexto de la publicación
    const texto = pub.tipo === 'venta'
      ? `Hola, me interesa tu publicación del muro: ${pub.producto}. ¿Sigue disponible?`
      : `Hola, vi que buscas comprar: ${pub.producto}. Yo tengo disponible.`;
    const yaMensajes = await query('SELECT id FROM mensajes WHERE chat_id = ? LIMIT 1', [chatId]);
    if (!yaMensajes || !yaMensajes.length) {
      await query(
        'INSERT INTO mensajes (chat_id, emisor_id, mensaje, tipo) VALUES (?, ?, ?, ?)',
        [chatId, interesadoId, texto, 'texto']
      );
      try {
        await crearNotificacion(
          pub.usuario_id,
          'mensaje',
          'Interesado en tu publicación del muro',
          `Alguien está interesado en "${pub.producto}". Revisa tus chats.`,
          { chat_id: chatId }
        );
      } catch (_) {}
    }

    res.json({ chat_id: chatId });
  } catch (err) {
    console.error('muro contactar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, actualizar, eliminar, contactar };
