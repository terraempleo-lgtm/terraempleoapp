const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { ejecutarMatchingParaTrabajador } = require('./vacantesController');
require('dotenv').config();

// Helper para convertir 0/1 de MariaDB a boolean real (soporta entero o string)
const toBool = (val) => Number(val) === 1;

// Registro de usuario
async function register(req, res) {
  try {
    const {
      rol, nombre_completo, celular, correo, password, cedula,
      departamento, municipio, vereda, acepta_habeas_data,
      // Campos trabajador
      nivel_estudios, titulo_estudio, anios_experiencia, disponibilidad,
      habilidades, cultivos_trabajador,
      // Campos empleador
      nombre_empresa_finca, tipo_pago, ofrece_alojamiento, ofrece_alimentacion,
      beneficios_extra, cultivos_empleador, labores
    } = req.body;

    if (!rol || !nombre_completo || !celular || !password || !cedula) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes: rol, nombre_completo, celular, password, cedula' });
    }

    if (!acepta_habeas_data) {
      return res.status(400).json({ error: 'Debe aceptar el tratamiento de datos (Habeas Data)' });
    }

    // Verificar si ya existe
    const existing = await query('SELECT id FROM usuarios WHERE celular = ?', [celular]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con este número de celular' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(`
      INSERT INTO usuarios (rol, nombre_completo, celular, correo, password_hash, cedula,
        departamento, municipio, vereda, acepta_habeas_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rol, nombre_completo, celular, correo || null, password_hash, cedula,
        departamento || null, municipio || null, vereda || null, acepta_habeas_data ? 1 : 0]);

    const userId = Number(result.insertId);

    // Si es trabajador, crear perfil
    if (rol === 'trabajador') {
      const perfilResult = await query(`
        INSERT INTO perfil_trabajador (usuario_id, nivel_estudios, titulo_estudio, anios_experiencia, disponibilidad)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, nivel_estudios || null, titulo_estudio || null, anios_experiencia || null, disponibilidad || null]);

      const perfilId = Number(perfilResult.insertId);

      if (habilidades && Array.isArray(habilidades)) {
        for (const h of habilidades) {
          await query('INSERT INTO trabajador_habilidades (perfil_trabajador_id, habilidad, es_personalizada) VALUES (?, ?, ?)',
            [perfilId, h.nombre, h.es_personalizada ? 1 : 0]);
        }
      }

      if (cultivos_trabajador && Array.isArray(cultivos_trabajador)) {
        for (const c of cultivos_trabajador) {
          await query('INSERT INTO trabajador_cultivos (perfil_trabajador_id, cultivo, es_personalizado) VALUES (?, ?, ?)',
            [perfilId, c.nombre, c.es_personalizado ? 1 : 0]);
        }
      }

      // Matching automático en background: no bloqueamos la respuesta de registro
      ejecutarMatchingParaTrabajador(userId).catch(err =>
        console.error('Error en matching post-registro:', err)
      );
    }

    // Si es empleador, crear perfil
    if (rol === 'empleador') {
      if (!nombre_empresa_finca) {
        return res.status(400).json({ error: 'El nombre de la empresa o finca es obligatorio para empleadores' });
      }

      const perfilResult = await query(`
        INSERT INTO perfil_empleador (usuario_id, nombre_empresa_finca, tipo_pago, ofrece_alojamiento, ofrece_alimentacion, beneficios_extra)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, nombre_empresa_finca, tipo_pago || null,
          ofrece_alojamiento ? 1 : 0, ofrece_alimentacion ? 1 : 0, beneficios_extra || null]);

      const perfilId = Number(perfilResult.insertId);

      if (cultivos_empleador && Array.isArray(cultivos_empleador)) {
        for (const c of cultivos_empleador) {
          await query('INSERT INTO empleador_cultivos (perfil_empleador_id, cultivo, es_personalizado) VALUES (?, ?, ?)',
            [perfilId, c.nombre, c.es_personalizado ? 1 : 0]);
        }
      }

      if (labores && Array.isArray(labores)) {
        for (const l of labores) {
          await query('INSERT INTO empleador_labores (perfil_empleador_id, labor, es_personalizada) VALUES (?, ?, ?)',
            [perfilId, l.nombre, l.es_personalizada ? 1 : 0]);
        }
      }
    }

    const token = jwt.sign(
      { id: userId, rol, celular, nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: userId, rol, nombre_completo, celular }
    });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Login
async function login(req, res) {
  try {
    const { celular, correo, password } = req.body;

    if ((!celular && !correo) || !password) {
      return res.status(400).json({ error: 'Celular (o correo) y contraseña son obligatorios' });
    }

    let users;
    if (celular) {
      users = await query('SELECT * FROM usuarios WHERE celular = ? AND activo = 1', [celular]);
    } else {
      users = await query('SELECT * FROM usuarios WHERE correo = ? AND activo = 1', [correo]);
    }

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        rol: user.rol,
        nombre_completo: user.nombre_completo,
        celular: user.celular,
        correo: user.correo,
        departamento: user.departamento,
        municipio: user.municipio,
        verificado_sms: toBool(user.verificado_sms),
        calificacion_promedio: user.calificacion_promedio,
        foto_selfie: user.foto_selfie || null,
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Enviar código SMS via Twilio Verify
async function enviarCodigoSMS(req, res) {
  try {
    const { celular } = req.body;
    if (!celular) return res.status(400).json({ error: 'Celular requerido' });

    const celularFormateado = celular.startsWith('+') ? celular : `+57${celular}`;

    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.verify.v2.services(process.env.TWILIO_VERIFY_SID)
      .verifications.create({ to: celularFormateado, channel: 'sms' });

    res.json({ message: 'Código enviado' });
  } catch (err) {
    console.error('Error enviando SMS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Verificar código SMS via Twilio Verify
async function verificarCodigoSMS(req, res) {
  try {
    const { celular, codigo } = req.body;
    if (!celular || !codigo) return res.status(400).json({ error: 'Celular y código requeridos' });

    const celularFormateado = celular.startsWith('+') ? celular : `+57${celular}`;

    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: celularFormateado, code: codigo });

    if (verification.status !== 'approved') {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    await query('UPDATE usuarios SET verificado_sms = 1 WHERE celular = ?', [celular]);
    res.json({ message: 'Celular verificado exitosamente' });
  } catch (err) {
    console.error('Error verificando SMS:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Obtener perfil
async function getPerfil(req, res) {
  try {
    const userId = req.user.id;
    const users = await query('SELECT * FROM usuarios WHERE id = ?', [userId]);
    if (!users || users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const user = users[0];
    delete user.password_hash;
    delete user.codigo_sms;

    // Convertir booleanos del usuario
    user.verificado_sms = toBool(user.verificado_sms);
    user.activo = toBool(user.activo);
    user.acepta_habeas_data = toBool(user.acepta_habeas_data);

    let perfil = null;
    if (user.rol === 'trabajador') {
      const perfiles = await query('SELECT * FROM perfil_trabajador WHERE usuario_id = ?', [userId]);
      if (perfiles.length > 0) {
        perfil = perfiles[0];
        perfil.habilidades = await query('SELECT * FROM trabajador_habilidades WHERE perfil_trabajador_id = ?', [perfil.id]);
        perfil.cultivos = await query('SELECT * FROM trabajador_cultivos WHERE perfil_trabajador_id = ?', [perfil.id]);
      }
    } else if (user.rol === 'empleador') {
      const perfiles = await query('SELECT * FROM perfil_empleador WHERE usuario_id = ?', [userId]);
      if (perfiles.length > 0) {
        perfil = perfiles[0];
        // Convertir booleanos del empleador
        perfil.ofrece_alojamiento = toBool(perfil.ofrece_alojamiento);
        perfil.ofrece_alimentacion = toBool(perfil.ofrece_alimentacion);
        perfil.cultivos = await query('SELECT * FROM empleador_cultivos WHERE perfil_empleador_id = ?', [perfil.id]);
        perfil.labores = await query('SELECT * FROM empleador_labores WHERE perfil_empleador_id = ?', [perfil.id]);
      }
    }

    res.json({ user, perfil });
  } catch (err) {
    console.error('Error obteniendo perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualizar perfil
async function actualizarPerfil(req, res) {
  try {
    const userId = req.user.id;
    const rol = req.user.rol;
    const acercaDeRaw = typeof req.body.acerca_de !== 'undefined' ? req.body.acerca_de : req.body.acercaDe;
    const acercaDe = typeof acercaDeRaw === 'string' ? (acercaDeRaw.trim() || null) : (acercaDeRaw ?? null);

    if (rol === 'trabajador') {
      const {
        nombre_completo, departamento, municipio, vereda,
        nivel_estudios, titulo_estudio, anios_experiencia, disponibilidad,
        habilidades, cultivos_trabajador
      } = req.body;

      await query(
        'UPDATE usuarios SET nombre_completo=?, departamento=?, municipio=?, vereda=? WHERE id=?',
        [nombre_completo, departamento || null, municipio || null, vereda || null, userId]
      );

      await query(
        'UPDATE perfil_trabajador SET acerca_de=?, nivel_estudios=?, titulo_estudio=?, anios_experiencia=?, disponibilidad=? WHERE usuario_id=?',
        [acercaDe, nivel_estudios || null, titulo_estudio || null, anios_experiencia || null, disponibilidad || null, userId]
      );

      const perfiles = await query('SELECT id FROM perfil_trabajador WHERE usuario_id=?', [userId]);
      if (perfiles.length > 0) {
        const perfilId = Number(perfiles[0].id);
        await query('DELETE FROM trabajador_habilidades WHERE perfil_trabajador_id=?', [perfilId]);
        if (habilidades && Array.isArray(habilidades)) {
          for (const h of habilidades) {
            await query('INSERT INTO trabajador_habilidades (perfil_trabajador_id, habilidad, es_personalizada) VALUES (?, ?, ?)',
              [perfilId, h.nombre, h.es_personalizada ? 1 : 0]);
          }
        }
        await query('DELETE FROM trabajador_cultivos WHERE perfil_trabajador_id=?', [perfilId]);
        if (cultivos_trabajador && Array.isArray(cultivos_trabajador)) {
          for (const c of cultivos_trabajador) {
            await query('INSERT INTO trabajador_cultivos (perfil_trabajador_id, cultivo, es_personalizado) VALUES (?, ?, ?)',
              [perfilId, c.nombre, c.es_personalizado ? 1 : 0]);
          }
        }
      }

    } else if (rol === 'empleador') {
      const {
        nombre_completo, departamento, municipio, vereda,
        nombre_empresa_finca, tipo_pago, ofrece_alojamiento, ofrece_alimentacion,
        beneficios_extra, cultivos_empleador, labores
      } = req.body;

      await query(
        'UPDATE usuarios SET nombre_completo=?, departamento=?, municipio=?, vereda=? WHERE id=?',
        [nombre_completo, departamento || null, municipio || null, vereda || null, userId]
      );

      await query(
        'UPDATE perfil_empleador SET nombre_empresa_finca=?, acerca_de=?, tipo_pago=?, ofrece_alojamiento=?, ofrece_alimentacion=?, beneficios_extra=? WHERE usuario_id=?',
        [nombre_empresa_finca, acercaDe, tipo_pago || null, ofrece_alojamiento ? 1 : 0, ofrece_alimentacion ? 1 : 0, beneficios_extra || null, userId]
      );

      const perfiles = await query('SELECT id FROM perfil_empleador WHERE usuario_id=?', [userId]);
      if (perfiles.length > 0) {
        const perfilId = Number(perfiles[0].id);
        await query('DELETE FROM empleador_cultivos WHERE perfil_empleador_id=?', [perfilId]);
        if (cultivos_empleador && Array.isArray(cultivos_empleador)) {
          for (const c of cultivos_empleador) {
            await query('INSERT INTO empleador_cultivos (perfil_empleador_id, cultivo, es_personalizado) VALUES (?, ?, ?)',
              [perfilId, c.nombre, c.es_personalizado ? 1 : 0]);
          }
        }
        await query('DELETE FROM empleador_labores WHERE perfil_empleador_id=?', [perfilId]);
        if (labores && Array.isArray(labores)) {
          for (const l of labores) {
            await query('INSERT INTO empleador_labores (perfil_empleador_id, labor, es_personalizada) VALUES (?, ?, ?)',
              [perfilId, l.nombre, l.es_personalizada ? 1 : 0]);
          }
        }
      }

    } else {
      return res.status(403).json({ error: 'Solo trabajadores y empleadores pueden editar su perfil' });
    }

    res.json({ message: 'Perfil actualizado exitosamente' });
  } catch (err) {
    console.error('Error actualizando perfil:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Subir hoja de vida (trabajador)
async function subirHojaVida(req, res) {
  try {
    const userId = req.user.id;

    if (req.user.rol !== 'trabajador') {
      return res.status(403).json({ error: 'Solo trabajadores pueden subir hoja de vida' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Archivo PDF requerido' });
    }

    const perfiles = await query('SELECT id FROM perfil_trabajador WHERE usuario_id = ?', [userId]);
    if (!perfiles || perfiles.length === 0) {
      return res.status(404).json({ error: 'Perfil de trabajador no encontrado' });
    }

    const hojaVidaUrl = req.file.path;
    const hojaVidaNombre = req.file.originalname || 'hoja_vida.pdf';

    await query(
      'UPDATE perfil_trabajador SET hoja_vida_url = ?, hoja_vida_nombre = ? WHERE usuario_id = ?',
      [hojaVidaUrl, hojaVidaNombre, userId]
    );

    res.json({
      message: 'Hoja de vida subida exitosamente',
      hoja_vida_url: hojaVidaUrl,
      hoja_vida_nombre: hojaVidaNombre,
    });
  } catch (err) {
    console.error('Error subiendo hoja de vida:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Subir fotos
async function subirFotos(req, res) {
  try {
    const userId = req.user.id;
    const { tipo } = req.params;

    if (!req.file) return res.status(400).json({ error: 'Archivo de imagen requerido' });

    const columnas = {
      selfie: 'foto_selfie',
      cedula: 'foto_cedula',
      selfie_cedula: 'foto_selfie_cedula'
    };

    const columna = columnas[tipo];
    if (!columna) return res.status(400).json({ error: 'Tipo de foto inválido. Use: selfie, cedula, selfie_cedula' });

    const filePath = req.file.path; // Cloudinary secure_url
    await query(`UPDATE usuarios SET ${columna} = ? WHERE id = ?`, [filePath, userId]);

    res.json({ message: 'Foto subida exitosamente', path: filePath });
  } catch (err) {
    console.error('Error subiendo foto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── RECUPERACIÓN DE CONTRASEÑA ──────────────────────────────────────────────

// POST /api/auth/recuperar/solicitar
// Genera un código OTP de 6 dígitos, lo guarda y lo "envía" (por ahora en consola)
async function solicitarRecuperacion(req, res) {
  try {
    const { celular } = req.body;
    if (!celular) return res.status(400).json({ error: 'El número de celular es obligatorio' });

    const usuarios = await query('SELECT id FROM usuarios WHERE celular = ?', [celular.trim()]);
    if (!usuarios || usuarios.length === 0) {
      // Por seguridad, responder igual aunque no exista
      return res.json({ message: 'Si el número está registrado, recibirás un código' });
    }

    // Invalidar tokens anteriores de este celular
    await query('UPDATE password_resets SET usado = 1 WHERE celular = ?', [celular.trim()]);

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await query(
      'INSERT INTO password_resets (celular, codigo, expira_en) VALUES (?, ?, ?)',
      [celular.trim(), codigo, expira]
    );

    // SMS mock: mostrar código en consola para MVP
    console.log(`[RECUPERAR PASSWORD] Celular: ${celular} | Código OTP: ${codigo}`);

    const responseData = { message: 'Código enviado correctamente' };
    if (process.env.SMS_MOCK === 'true' || process.env.NODE_ENV !== 'production') {
      responseData.codigo_debug = codigo;
    }
    res.json(responseData);
  } catch (err) {
    console.error('Error en solicitarRecuperacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/auth/recuperar/verificar
// Verifica el código OTP y devuelve un token temporal de reset
async function verificarCodigoRecuperacion(req, res) {
  try {
    const { celular, codigo } = req.body;
    if (!celular || !codigo) return res.status(400).json({ error: 'Celular y código son obligatorios' });

    const resets = await query(
      'SELECT * FROM password_resets WHERE celular = ? AND codigo = ? AND usado = 0 AND expira_en > NOW() ORDER BY created_at DESC LIMIT 1',
      [celular.trim(), codigo.trim()]
    );

    if (!resets || resets.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    // Generar token temporal de reset (64 chars hex)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    await query('UPDATE password_resets SET token = ? WHERE id = ?', [resetToken, resets[0].id]);

    res.json({ message: 'Código verificado', reset_token: resetToken });
  } catch (err) {
    console.error('Error en verificarCodigoRecuperacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/auth/recuperar/nueva-password
// Verifica el token temporal y actualiza la contraseña
async function actualizarPasswordRecuperacion(req, res) {
  try {
    const { celular, reset_token, nueva_password } = req.body;
    if (!celular || !reset_token || !nueva_password) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    if (nueva_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const resets = await query(
      'SELECT * FROM password_resets WHERE celular = ? AND token = ? AND usado = 0 AND expira_en > NOW() ORDER BY created_at DESC LIMIT 1',
      [celular.trim(), reset_token]
    );

    if (!resets || resets.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado. Solicita un nuevo código.' });
    }

    const hash = await bcrypt.hash(nueva_password, 10);
    await query('UPDATE usuarios SET password_hash = ? WHERE celular = ?', [hash, celular.trim()]);

    // Invalidar todos los tokens OTP de este celular
    await query('UPDATE password_resets SET usado = 1 WHERE celular = ?', [celular.trim()]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en actualizarPasswordRecuperacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  register,
  login,
  enviarCodigoSMS,
  verificarCodigoSMS,
  getPerfil,
  actualizarPerfil,
  subirFotos,
  subirHojaVida,
  solicitarRecuperacion,
  verificarCodigoRecuperacion,
  actualizarPasswordRecuperacion,
};