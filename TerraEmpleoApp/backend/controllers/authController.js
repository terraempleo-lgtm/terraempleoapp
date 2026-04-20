const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { signUrl, signFields, signArrayField } = require('../config/s3');
const {
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { cognitoClient, COGNITO_CLIENT_ID } = require('../config/cognito');
const { normalizePhone } = require('../helpers/normalizePhone');
const { findUserByNormalizedPhone, findAnyUserByPhone, markPhoneVerified } = require('../helpers/userSync');
require('dotenv').config();

const RECUPERACION_CODIGO_MOCK = '123456';

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

    // Normalizar celular a E.164 antes de guardar
    const celularNorm = normalizePhone(celular) || celular.replace(/[\s\-\(\)\.]/g, '');

    // Verificar si ya existe (busca tanto normalizado como legacy)
    const existingUser = await findAnyUserByPhone(celular);
    if (existingUser) {
      const isDeleted = Number(existingUser.eliminado) === 1 || Number(existingUser.activo) === 0;
      const isSameIdentity = existingUser.cedula === cedula;
      if (isDeleted || isSameIdentity) {
        // Re-registro: misma persona o usuario eliminado — borrar registro anterior
        await query('DELETE FROM usuarios WHERE id = ?', [existingUser.id]);
      } else {
        return res.status(409).json({ error: 'Ya existe un usuario con este número de celular' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await query(`
      INSERT INTO usuarios (rol, nombre_completo, celular, correo, password_hash, cedula,
        departamento, municipio, vereda, acepta_habeas_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [rol, nombre_completo, celularNorm, correo || null, password_hash, cedula,
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
      { id: userId, rol, celular: celularNorm, nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: userId,
        rol,
        nombre_completo,
        celular: celularNorm,
        validacion_identidad_estado: 'pendiente',
      }
    });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Mapeo de errores de Cognito a mensajes en español + HTTP status
const COGNITO_LOGIN_ERRORS = {
  NotAuthorizedException:    { status: 401, message: 'Credenciales incorrectas.' },
  UserNotConfirmedException: { status: 403, message: 'Tu cuenta no ha sido confirmada. Verifica tu código SMS.' },
  UserNotFoundException:     { status: 404, message: 'No se encontró un usuario con este número de teléfono.' },
  InvalidPasswordException:  { status: 400, message: 'La contraseña no cumple los requisitos de seguridad.' },
  LimitExceededException:    { status: 429, message: 'Demasiados intentos. Espera unos minutos.' },
  TooManyRequestsException:  { status: 429, message: 'Demasiadas solicitudes. Intenta más tarde.' },
  InvalidParameterException: { status: 400, message: 'Parámetros inválidos.' },
};

// Login
async function login(req, res) {
  try {
    const { celular, correo, phoneNumber, password } = req.body;

    // ── Cognito auth cuando llega phoneNumber ──
    if (phoneNumber) {
      const phone = normalizePhone(phoneNumber);
      if (!phone) {
        return res.status(400).json({ error: 'Número de teléfono inválido. Usa formato colombiano (ej: 3001234567).' });
      }

      // 1. Autenticar con Cognito
      const command = new InitiateAuthCommand({
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: phone, PASSWORD: password },
      });

      let cognitoResult;
      try {
        cognitoResult = await cognitoClient.send(command);
      } catch (cognitoErr) {
        const mapped = COGNITO_LOGIN_ERRORS[cognitoErr.name];
        if (mapped) {
          return res.status(mapped.status).json({ error: mapped.message });
        }
        console.error('Error Cognito login:', cognitoErr);
        return res.status(500).json({ error: 'Error al autenticar con el servicio de identidad.' });
      }

      // 2. Buscar usuario en BD local por celular (normalizado + fallback legacy)
      const user = await findUserByNormalizedPhone(phoneNumber);

      if (!user) {
        return res.status(404).json({
          error: 'Cuenta verificada en Cognito, pero falta completar el registro en la plataforma.',
          code: 'LOCAL_USER_NOT_FOUND',
        });
      }

      // 3. Generar JWT local (mantiene compatibilidad con el resto de la app)
      const token = jwt.sign(
        { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
      );

      const fotoSelfie = user.foto_selfie ? await signUrl(user.foto_selfie) : null;

      return res.json({
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
          foto_selfie: fotoSelfie,
          foto_cedula: user.foto_cedula || null,
          validacion_identidad_estado: user.validacion_identidad_estado || 'pendiente',
        },
      });
    }

    // ── Flujo legacy: celular/correo + bcrypt ──
    if ((!celular && !correo) || !password) {
      return res.status(400).json({ error: 'Celular (o correo) y contraseña son obligatorios' });
    }

    let user;
    if (celular) {
      // Buscar por celular normalizado + fallback legacy
      user = await findUserByNormalizedPhone(celular);
    } else {
      const users = await query('SELECT * FROM usuarios WHERE correo = ? AND activo = 1 AND eliminado = 0', [correo]);
      user = (users && users.length > 0) ? users[0] : null;
    }

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, celular: user.celular, nombre_completo: user.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );

    const fotoSelfie = user.foto_selfie ? await signUrl(user.foto_selfie) : null;

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
        foto_selfie: fotoSelfie,
        foto_cedula: user.foto_cedula || null,
        validacion_identidad_estado: user.validacion_identidad_estado || 'pendiente',
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Enviar código SMS de verificación con Cognito
async function enviarCodigoSMS(req, res) {
  try {
    const { celular } = req.body;
    if (!celular) return res.status(400).json({ error: 'Celular requerido' });

    const celularE164 = normalizePhone(celular);
    if (!celularE164) return res.status(400).json({ error: 'Número de celular inválido.' });

    const command = new ResendConfirmationCodeCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: celularE164,
    });

    await cognitoClient.send(command);

    res.json({ message: 'Código enviado' });
  } catch (err) {
    console.error('[Cognito SMS] Error enviando código:', err);
    const mapped = COGNITO_LOGIN_ERRORS[err.name] || { status: 500, message: 'Error enviando SMS' };
    res.status(mapped.status).json({ error: mapped.message });
  }
}

// Verificar código SMS con Cognito
async function verificarCodigoSMS(req, res) {
  try {
    const { celular, codigo } = req.body;
    if (!celular || !codigo) return res.status(400).json({ error: 'Celular y código requeridos' });

    const celularE164 = normalizePhone(celular);
    if (!celularE164) return res.status(400).json({ error: 'Número de celular inválido.' });

    const command = new ConfirmSignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: celularE164,
      ConfirmationCode: String(codigo).trim(),
    });

    await cognitoClient.send(command);

    await markPhoneVerified(celular);
    res.json({ message: 'Celular verificado exitosamente' });
  } catch (err) {
    console.error('[Cognito SMS] Error verificando código:', err);
    const mapped = COGNITO_LOGIN_ERRORS[err.name] || { status: 500, message: 'Error verificando código' };
    res.status(mapped.status).json({ error: mapped.message });
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

    // Firmar URLs de S3
    await signFields(user, ['foto_selfie', 'foto_cedula', 'foto_selfie_cedula']);
    if (perfil) {
      await signFields(perfil, ['hoja_vida_url', 'foto_finca_fachada']);
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

    const hojaVidaUrl = req.file.location;
    const hojaVidaNombre = req.file.originalname || 'hoja_vida.pdf';

    await query(
      'UPDATE perfil_trabajador SET hoja_vida_url = ?, hoja_vida_nombre = ? WHERE usuario_id = ?',
      [hojaVidaUrl, hojaVidaNombre, userId]
    );

    const signedUrl = await signUrl(hojaVidaUrl);
    res.json({
      message: 'Hoja de vida subida exitosamente',
      hoja_vida_url: signedUrl,
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

    const columnasUsuario = {
      selfie: 'foto_selfie',
      cedula: 'foto_cedula',
      selfie_cedula: 'foto_selfie_cedula'
    };
    const columnasEmpleador = {
      finca_fachada: 'foto_finca_fachada',
    };

    const filePath = req.file.location; // S3 URL

    if (columnasUsuario[tipo]) {
      if (tipo === 'cedula') {
        await query(
          `UPDATE usuarios
           SET ${columnasUsuario[tipo]} = ?,
               validacion_identidad_estado = 'pendiente',
               validacion_identidad_enviado_at = NOW(),
               validacion_identidad_revisado_por = NULL,
               validacion_identidad_revisado_at = NULL,
               validacion_identidad_comentario = NULL
           WHERE id = ?`,
          [filePath, userId]
        );
      } else {
        await query(`UPDATE usuarios SET ${columnasUsuario[tipo]} = ? WHERE id = ?`, [filePath, userId]);
      }
    } else if (columnasEmpleador[tipo]) {
      await query(`UPDATE perfil_empleador SET ${columnasEmpleador[tipo]} = ? WHERE usuario_id = ?`, [filePath, userId]);
    } else {
      return res.status(400).json({ error: 'Tipo de foto inválido. Use: selfie, cedula, selfie_cedula, finca_fachada' });
    }

    const signedPath = await signUrl(filePath);
    res.json({ message: 'Foto subida exitosamente', path: signedPath });
  } catch (err) {
    console.error('Error subiendo foto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─── RECUPERACIÓN DE CONTRASEÑA ──────────────────────────────────────────────

// POST /api/auth/recuperar/solicitar
// Envía un código de verificación con Cognito para recuperar contraseña
async function solicitarRecuperacion(req, res) {
  try {
    const { celular } = req.body;
    if (!celular) return res.status(400).json({ error: 'El número de celular es obligatorio' });

    // Buscar usuario con normalización
    const usuario = await findUserByNormalizedPhone(celular);
    if (!usuario) {
      return res.json({ message: 'Si el número está registrado, recibirás un código' });
    }

    const celularFormateado = normalizePhone(celular);
    if (!celularFormateado) {
      return res.status(400).json({ error: 'Número de celular inválido.' });
    }

    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: celularFormateado,
    });

    await cognitoClient.send(command);
    console.log(`[RECUPERAR PASSWORD] Código enviado por Cognito a: ${celularFormateado}`);
    res.json({ message: 'Código enviado correctamente' });
  } catch (err) {
    console.error('[Cognito ForgotPassword] Error exacto:', err);
    if (err && err.name && err.message) {
      console.error(`[Cognito ForgotPassword] ${err.name}: ${err.message}`);
    }
    res.status(500).json({ error: 'No se pudo enviar el código SMS. Intenta más tarde.' });
  }
}

// POST /api/auth/recuperar/verificar
// Verifica el código por email contra password_resets y devuelve un token temporal de reset.
// Para SMS, la validación final se realiza en /api/auth/cognito/confirm-forgot-password.
async function verificarCodigoRecuperacion(req, res) {
  try {
    const { celular, codigo, metodo } = req.body;
    if (!celular || !codigo) return res.status(400).json({ error: 'Celular y código son obligatorios' });

    // Resolver el celular real en BD para buscar password_resets
    const usuario = await findUserByNormalizedPhone(celular);
    const celularDB = usuario ? usuario.celular : (normalizePhone(celular) || celular.trim());

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Código de desarrollo: solo activo fuera de producción
    if (process.env.NODE_ENV !== 'production' && codigo.trim() === RECUPERACION_CODIGO_MOCK) {
      const resetTokenMock = `mock-reset-${Date.now()}`;
      return res.json({
        message: 'Código mock verificado',
        reset_token: resetTokenMock,
        es_mock: true,
      });
    }

    // Si fue por email, verificar contra la tabla password_resets
    if (metodo === 'email') {
      console.log('[VERIFICAR CODIGO] Buscando: celularDB=', celularDB, 'codigo=', codigo.trim());
      const resets = await query(
        'SELECT * FROM password_resets WHERE celular = ? AND codigo = ? AND usado = 0 AND expira_en > NOW() ORDER BY created_at DESC LIMIT 1',
        [celularDB, codigo.trim()]
      );
      console.log('[VERIFICAR CODIGO] Filas encontradas:', resets ? resets.length : 0);
      if (!resets || resets.length === 0) {
        return res.status(400).json({ error: 'Código inválido o expirado' });
      }
      // Usar celular/codigo exactos del registro para evitar mismatch de formato
      const updateResult = await query(
        'UPDATE password_resets SET token = ? WHERE celular = ? AND codigo = ? AND usado = 0',
        [resetToken, resets[0].celular, resets[0].codigo]
      );
      console.log('[VERIFICAR CODIGO] UPDATE affectedRows:', updateResult?.affectedRows, 'token:', resetToken.substring(0, 8) + '...');
      return res.json({ message: 'Código verificado', reset_token: resetToken });
    }

    return res.status(400).json({
      error: 'Para recuperación por SMS usa el endpoint /api/auth/cognito/confirm-forgot-password con code y newPassword.',
    });
  } catch (err) {
    console.error('Error en verificarCodigoRecuperacion:', err);
    res.status(500).json({ error: 'Código inválido o expirado' });
  }
}

// POST /api/auth/recuperar/nueva-password
// Verifica el token temporal y actualiza la contraseña
async function actualizarPasswordRecuperacion(req, res) {
  try {
    const { celular, reset_token, nueva_password } = req.body;
    console.log('[NUEVA PASSWORD] Recibido:', { celular, reset_token: reset_token ? reset_token.substring(0, 8) + '...' : null, nueva_password: nueva_password ? '***' : null });

    if (!celular || !reset_token || !nueva_password) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    if (nueva_password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Resolver el celular real en BD
    const usuario = await findUserByNormalizedPhone(celular);
    const celularDB = usuario ? usuario.celular : (normalizePhone(celular) || celular.trim());

    if (String(reset_token).startsWith('mock-reset-')) {
      const hashMock = await bcrypt.hash(nueva_password, 10);
      await query('UPDATE usuarios SET password_hash = ? WHERE celular = ?', [hashMock, celularDB]);
      return res.json({ message: 'Contraseña actualizada correctamente (modo mock)' });
    }

    const resets = await query(
      'SELECT * FROM password_resets WHERE token = ? AND usado = 0 ORDER BY created_at DESC LIMIT 1',
      [reset_token]
    );

    if (!resets || resets.length === 0) {
      console.log('[NUEVA PASSWORD] Token no encontrado en BD para celularDB:', celularDB);
      return res.status(400).json({ error: 'Token inválido o expirado. Solicita un nuevo código.' });
    }

    const expiraEn = new Date(resets[0].expira_en).getTime();
    if (Date.now() > expiraEn) {
      console.log('[NUEVA PASSWORD] Token expirado. expira_en:', resets[0].expira_en, 'now:', new Date());
      return res.status(400).json({ error: 'Token inválido o expirado. Solicita un nuevo código.' });
    }

    const celularReset = resets[0].celular;
    const hash = await bcrypt.hash(nueva_password, 10);
    await query('UPDATE usuarios SET password_hash = ? WHERE celular = ?', [hash, celularReset]);

    // Invalidar todos los tokens OTP de este celular
    await query('UPDATE password_resets SET usado = 1 WHERE celular = ?', [celularReset]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en actualizarPasswordRecuperacion:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /api/auth/recuperar/solicitar-email
// Genera un código OTP de 6 dígitos y lo envía por correo electrónico
async function solicitarRecuperacionEmail(req, res) {
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ error: 'El correo electrónico es obligatorio' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo.trim())) {
      return res.status(400).json({ error: 'Formato de correo electrónico inválido' });
    }

    // Buscar usuario por correo
    const usuarios = await query('SELECT id, celular, nombre_completo FROM usuarios WHERE correo = ? AND activo = 1 AND eliminado = 0', [correo.trim()]);
    if (!usuarios || usuarios.length === 0) {
      // Por seguridad, responder igual aunque no exista
      return res.json({ message: 'Si el correo está registrado, recibirás un código de recuperación' });
    }

    const usuario = usuarios[0];
    const celular = usuario.celular;

    // Invalidar tokens anteriores de este celular
    await query('UPDATE password_resets SET usado = 1 WHERE celular = ?', [celular]);

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await query(
      'INSERT INTO password_resets (celular, codigo, expira_en) VALUES (?, ?, ?)',
      [celular, codigo, expira]
    );

    // Enviar email con el código OTP
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'TerraEmpleo <noreply@terraempleo.co>',
      to: correo.trim(),
      subject: 'Recuperación de contraseña - TerraEmpleo',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f0faf4; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #008d49; margin: 0;">TerraEmpleo</h1>
            <p style="color: #666; font-size: 14px;">Recuperación de contraseña</p>
          </div>
          <div style="background: #fff; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <p style="color: #1a1a2e; font-size: 15px;">Hola <strong>${usuario.nombre_completo}</strong>,</p>
            <p style="color: #4b5563; font-size: 14px;">Recibimos una solicitud para restablecer tu contraseña. Usa el siguiente código:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #008d49; background: #e6f7ee; padding: 12px 24px; border-radius: 8px;">${codigo}</span>
            </div>
            <p style="color: #4b5563; font-size: 13px;">Este código expira en <strong>10 minutos</strong>.</p>
            <p style="color: #4b5563; font-size: 13px;">Si no solicitaste este cambio, ignora este correo.</p>
          </div>
          <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 16px;">© TerraEmpleo - Potenciando el campo colombiano</p>
        </div>
      `,
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      // Si no hay credenciales de email, modo debug
      console.log(`[RECUPERAR EMAIL] Correo: ${correo} | Código OTP: ${codigo}`);
      return res.json({
        message: 'Código de recuperación generado (modo desarrollo)',
        codigo_debug: codigo,
        celular,
      });
    }

    await transporter.sendMail(mailOptions);
    console.log(`[RECUPERAR EMAIL] Correo enviado a: ${correo}`);

    res.json({
      message: 'Te enviamos un correo para restablecer tu contraseña',
      celular,
    });
  } catch (err) {
    console.error('Error en solicitarRecuperacionEmail:', err);
    if (err.code === 'EAUTH' || err.code === 'ESOCKET') {
      return res.status(500).json({ error: 'Error al enviar el correo. Intenta más tarde.' });
    }
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
  solicitarRecuperacionEmail,
};