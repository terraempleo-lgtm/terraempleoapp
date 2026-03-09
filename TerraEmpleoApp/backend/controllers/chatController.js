const { query } = require('../config/database');

// Listar mis chats con último mensaje y datos del otro usuario
async function misChats(req, res) {
  try {
    const userId = req.user.id;
    const rol = req.user.rol;

    let sql;
    let params;

    if (rol === 'empleador') {
      sql = `
        SELECT c.id, c.vacante_id, c.activo, c.created_at,
          v.titulo as vacante_titulo,
          u.id as otro_usuario_id,
          u.nombre_completo as otro_nombre,
          u.foto_selfie as otro_foto,
          u.celular as otro_celular,
          (SELECT m.mensaje FROM mensajes m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as ultimo_mensaje,
          (SELECT m.created_at FROM mensajes m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as ultimo_mensaje_at,
          (SELECT COUNT(*) FROM mensajes m WHERE m.chat_id = c.id AND m.leido = 0 AND m.emisor_id != ?) as no_leidos
        FROM chats c
        JOIN vacantes v ON v.id = c.vacante_id
        JOIN usuarios u ON u.id = c.trabajador_id
        WHERE c.empleador_id = ? AND c.activo = 1
        ORDER BY ultimo_mensaje_at DESC
      `;
      params = [userId, userId];
    } else {
      sql = `
        SELECT c.id, c.vacante_id, c.activo, c.created_at,
          v.titulo as vacante_titulo,
          u.id as otro_usuario_id,
          u.nombre_completo as otro_nombre,
          u.foto_selfie as otro_foto,
          u.celular as otro_celular,
          (SELECT m.mensaje FROM mensajes m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as ultimo_mensaje,
          (SELECT m.created_at FROM mensajes m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as ultimo_mensaje_at,
          (SELECT COUNT(*) FROM mensajes m WHERE m.chat_id = c.id AND m.leido = 0 AND m.emisor_id != ?) as no_leidos
        FROM chats c
        JOIN vacantes v ON v.id = c.vacante_id
        JOIN usuarios u ON u.id = c.empleador_id
        WHERE c.trabajador_id = ? AND c.activo = 1
        ORDER BY ultimo_mensaje_at DESC
      `;
      params = [userId, userId];
    }

    const chats = await query(sql, params);

    for (const c of chats) {
      c.no_leidos = Number(c.no_leidos || 0);
    }

    res.json({ chats });
  } catch (err) {
    console.error('Error listando chats:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener mensajes de un chat con paginación
async function getMensajes(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Verificar que el usuario pertenece al chat
    const chats = await query(
      'SELECT id FROM chats WHERE id = ? AND (empleador_id = ? OR trabajador_id = ?)',
      [id, userId, userId]
    );
    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }

    const mensajes = await query(`
      SELECT m.id, m.emisor_id, m.mensaje, m.leido, m.created_at,
        u.nombre_completo as emisor_nombre
      FROM mensajes m
      JOIN usuarios u ON u.id = m.emisor_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [id, limit, offset]);

    // Retornar en orden cronológico
    mensajes.reverse();

    res.json({ mensajes });
  } catch (err) {
    console.error('Error obteniendo mensajes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Enviar mensaje
async function enviarMensaje(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { mensaje } = req.body;

    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    // Verificar que el usuario pertenece al chat
    const chats = await query(
      'SELECT id FROM chats WHERE id = ? AND (empleador_id = ? OR trabajador_id = ?) AND activo = 1',
      [id, userId, userId]
    );
    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }

    const result = await query(
      'INSERT INTO mensajes (chat_id, emisor_id, mensaje) VALUES (?, ?, ?)',
      [id, userId, mensaje.trim()]
    );

    const nuevoMensaje = {
      id: Number(result.insertId),
      chat_id: Number(id),
      emisor_id: userId,
      mensaje: mensaje.trim(),
      leido: 0,
      created_at: new Date().toISOString(),
    };

    res.status(201).json({ mensaje: nuevoMensaje });
  } catch (err) {
    console.error('Error enviando mensaje:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Marcar mensajes como leídos
async function marcarLeidos(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar que el usuario pertenece al chat
    const chats = await query(
      'SELECT id FROM chats WHERE id = ? AND (empleador_id = ? OR trabajador_id = ?)',
      [id, userId, userId]
    );
    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }

    // Marcar como leídos los mensajes del otro usuario
    await query(
      'UPDATE mensajes SET leido = 1 WHERE chat_id = ? AND emisor_id != ? AND leido = 0',
      [id, userId]
    );

    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (err) {
    console.error('Error marcando mensajes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Crear chat (llamado internamente desde vacantesController)
async function crearChat(vacanteId, empleadorId, trabajadorId) {
  try {
    // Verificar si ya existe
    const existing = await query(
      'SELECT id FROM chats WHERE vacante_id = ? AND trabajador_id = ?',
      [vacanteId, trabajadorId]
    );
    if (existing && existing.length > 0) {
      return Number(existing[0].id);
    }

    const result = await query(
      'INSERT INTO chats (vacante_id, empleador_id, trabajador_id) VALUES (?, ?, ?)',
      [vacanteId, empleadorId, trabajadorId]
    );
    return Number(result.insertId);
  } catch (err) {
    console.error('Error creando chat:', err);
    return null;
  }
}

// Obtener chat por vacante+trabajador (para navegación directa)
async function obtenerChatPorVacanteTrabajador(req, res) {
  try {
    const userId = req.user.id;
    const { vacanteId, trabajadorId } = req.params;

    const chats = await query(
      'SELECT id FROM chats WHERE vacante_id = ? AND trabajador_id = ? AND (empleador_id = ? OR trabajador_id = ?)',
      [vacanteId, trabajadorId, userId, userId]
    );

    if (!chats || chats.length === 0) {
      return res.status(404).json({ error: 'Chat no encontrado' });
    }

    res.json({ chat_id: Number(chats[0].id) });
  } catch (err) {
    console.error('Error buscando chat:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Contar chats con mensajes no leídos (para badge en tab)
async function contarNoLeidos(req, res) {
  try {
    const userId = req.user.id;
    const result = await query(`
      SELECT COUNT(DISTINCT m.chat_id) as total
      FROM mensajes m
      JOIN chats c ON c.id = m.chat_id
      WHERE m.leido = 0
        AND m.emisor_id != ?
        AND (c.empleador_id = ? OR c.trabajador_id = ?)
    `, [userId, userId, userId]);

    res.json({ no_leidos: Number(result[0].total || 0) });
  } catch (err) {
    console.error('Error contando no leídos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { misChats, getMensajes, enviarMensaje, marcarLeidos, crearChat, contarNoLeidos, obtenerChatPorVacanteTrabajador };
