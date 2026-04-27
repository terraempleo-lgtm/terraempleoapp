const { query } = require('../config/database');

async function initializeDatabase() {
  console.log('Inicializando base de datos TerraEmpleo...');

  // Tabla usuarios
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      rol ENUM('trabajador','empleador','admin') NOT NULL,
      nombre_completo VARCHAR(200) NOT NULL,
      celular VARCHAR(20) NOT NULL UNIQUE,
      correo VARCHAR(150) DEFAULT NULL,
      password_hash VARCHAR(255) NOT NULL,
      cedula VARCHAR(20) NOT NULL,
      departamento VARCHAR(100) DEFAULT NULL,
      municipio VARCHAR(100) DEFAULT NULL,
      vereda VARCHAR(150) DEFAULT NULL,
      latitud DECIMAL(10,7) DEFAULT NULL,
      longitud DECIMAL(10,7) DEFAULT NULL,
      acepta_habeas_data TINYINT(1) NOT NULL DEFAULT 0,
      verificado_sms TINYINT(1) NOT NULL DEFAULT 0,
      codigo_sms VARCHAR(6) DEFAULT NULL,
      foto_selfie VARCHAR(500) DEFAULT NULL,
      foto_cedula VARCHAR(500) DEFAULT NULL,
      foto_selfie_cedula VARCHAR(500) DEFAULT NULL,
      calificacion_promedio DECIMAL(3,2) DEFAULT 0.00,
      total_calificaciones INT DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Perfil trabajador
  await query(`
    CREATE TABLE IF NOT EXISTS perfil_trabajador (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL UNIQUE,
      acerca_de TEXT DEFAULT NULL,
      hoja_vida_url VARCHAR(500) DEFAULT NULL,
      hoja_vida_nombre VARCHAR(255) DEFAULT NULL,
      nivel_estudios ENUM('sin_estudios','primaria_completa','bachiller','tecnico_tecnologo','universitario') DEFAULT NULL,
      titulo_estudio VARCHAR(200) DEFAULT NULL,
      anios_experiencia ENUM('sin','menos_1','1_3','3_5','5_10','mas_10') DEFAULT NULL,
      disponibilidad ENUM('tiempo_completo','por_dias','temporada_cosecha','fines_semana','disponible_inmediatamente') DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Habilidades/roles del trabajador
  await query(`
    CREATE TABLE IF NOT EXISTS trabajador_habilidades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_trabajador_id INT NOT NULL,
      habilidad VARCHAR(150) NOT NULL,
      es_personalizada TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_trabajador_id) REFERENCES perfil_trabajador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Cultivos/producciones del trabajador
  await query(`
    CREATE TABLE IF NOT EXISTS trabajador_cultivos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_trabajador_id INT NOT NULL,
      cultivo VARCHAR(150) NOT NULL,
      es_personalizado TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_trabajador_id) REFERENCES perfil_trabajador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Perfil empleador
  await query(`
    CREATE TABLE IF NOT EXISTS perfil_empleador (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL UNIQUE,
      nombre_empresa_finca VARCHAR(250) NOT NULL,
      acerca_de TEXT DEFAULT NULL,
      tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo') DEFAULT NULL,
      ofrece_alojamiento TINYINT(1) DEFAULT 0,
      ofrece_alimentacion TINYINT(1) DEFAULT 0,
      beneficios_extra TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Cultivos del empleador
  await query(`
    CREATE TABLE IF NOT EXISTS empleador_cultivos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_empleador_id INT NOT NULL,
      cultivo VARCHAR(150) NOT NULL,
      es_personalizado TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_empleador_id) REFERENCES perfil_empleador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Labores del empleador
  await query(`
    CREATE TABLE IF NOT EXISTS empleador_labores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_empleador_id INT NOT NULL,
      labor VARCHAR(150) NOT NULL,
      es_personalizada TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_empleador_id) REFERENCES perfil_empleador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Vacantes
  await query(`
    CREATE TABLE IF NOT EXISTS vacantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleador_id INT NOT NULL,
      titulo VARCHAR(250) NOT NULL,
      descripcion TEXT DEFAULT NULL,
      tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo') DEFAULT NULL,
      monto_pago DECIMAL(12,2) DEFAULT NULL,
      duracion VARCHAR(120) DEFAULT NULL,
      requisitos TEXT DEFAULT NULL,
      departamento VARCHAR(100) DEFAULT NULL,
      municipio VARCHAR(100) DEFAULT NULL,
      vereda VARCHAR(150) DEFAULT NULL,
      latitud DECIMAL(10,7) DEFAULT NULL,
      longitud DECIMAL(10,7) DEFAULT NULL,
      urgente TINYINT(1) DEFAULT 0,
      estado ENUM('activa','cerrada','pausada') DEFAULT 'activa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Cultivos de la vacante
  await query(`
    CREATE TABLE IF NOT EXISTS vacante_cultivos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vacante_id INT NOT NULL,
      cultivo VARCHAR(150) NOT NULL,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Labores de la vacante
  await query(`
    CREATE TABLE IF NOT EXISTS vacante_labores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vacante_id INT NOT NULL,
      labor VARCHAR(150) NOT NULL,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Fotos de vacante
  await query(`
    CREATE TABLE IF NOT EXISTS vacante_fotos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vacante_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      descripcion VARCHAR(255) DEFAULT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Postulaciones
  await query(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vacante_id INT NOT NULL,
      trabajador_id INT NOT NULL,
      estado ENUM('pendiente','contacto_solicitado','aceptada','rechazada','match_auto') DEFAULT 'pendiente',
      es_match_automatico TINYINT(1) DEFAULT 0,
      puntaje_match DECIMAL(5,2) DEFAULT 0.00,
      mensaje TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_vacante_trabajador (vacante_id, trabajador_id),
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Calificaciones
  await query(`
    CREATE TABLE IF NOT EXISTS calificaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      calificador_id INT NOT NULL,
      calificado_id INT NOT NULL,
      vacante_id INT DEFAULT NULL,
      estrellas TINYINT NOT NULL CHECK (estrellas >= 1 AND estrellas <= 5),
      comentario VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (calificador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (calificado_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Chats
  await query(`
    CREATE TABLE IF NOT EXISTS chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vacante_id INT NOT NULL,
      empleador_id INT NOT NULL,
      trabajador_id INT NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_chat (vacante_id, trabajador_id),
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE,
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Mensajes de chat
  await query(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chat_id INT NOT NULL,
      emisor_id INT NOT NULL,
      mensaje TEXT NOT NULL,
      leido TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (emisor_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migraciones: soporte multimedia en mensajes de chat
  try { await query("ALTER TABLE mensajes MODIFY COLUMN mensaje TEXT NULL DEFAULT NULL"); } catch (_) {}
  try { await query("ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS tipo ENUM('texto','imagen','audio') NOT NULL DEFAULT 'texto'"); } catch (_) {}
  try { await query("ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS archivo_url VARCHAR(512) DEFAULT NULL"); } catch (_) {}
  try { await query("ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS duracion_audio INT DEFAULT NULL"); } catch (_) {}

  // Notificaciones
  await query(`
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo VARCHAR(60) NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      mensaje TEXT NOT NULL,
      vacante_id INT DEFAULT NULL,
      conversacion_id INT DEFAULT NULL,
      leida TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE SET NULL,
      FOREIGN KEY (conversacion_id) REFERENCES chats(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migración: soft delete
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS eliminado TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}

  // Migración: agregar columnas a vacantes si no existen
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS ofrece_alojamiento TINYINT(1) DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS ofrece_alimentacion TINYINT(1) DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS otros_beneficios TEXT DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS fecha_inicio DATE DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS fecha_fin DATE DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS duracion VARCHAR(120) DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE vacantes ADD COLUMN IF NOT EXISTS requisitos TEXT DEFAULT NULL'); } catch (_) {}

  // Migración: campos nuevos de perfil
  try { await query('ALTER TABLE perfil_trabajador ADD COLUMN IF NOT EXISTS acerca_de TEXT DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE perfil_trabajador ADD COLUMN IF NOT EXISTS hoja_vida_url VARCHAR(500) DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE perfil_trabajador ADD COLUMN IF NOT EXISTS hoja_vida_nombre VARCHAR(255) DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS acerca_de TEXT DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS foto_finca_fachada VARCHAR(500) DEFAULT NULL'); } catch (_) {}
  try { await query("ALTER TABLE perfil_trabajador MODIFY COLUMN nivel_estudios ENUM('sin_estudios','primaria_completa','bachiller','tecnico_tecnologo','universitario') DEFAULT NULL"); } catch (_) {}

  // Migración: nuevos estados de postulación
  try {
    await query("ALTER TABLE postulaciones MODIFY COLUMN estado ENUM('pendiente','contacto_solicitado','aceptada','rechazada','match_auto') DEFAULT 'pendiente'");
  } catch (_) {}

  // Migración: estado de validación interna de identidad
  try { await query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS validacion_identidad_estado ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente'"); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS validacion_identidad_revisado_por INT NULL'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS validacion_identidad_revisado_at TIMESTAMP NULL'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS validacion_identidad_comentario VARCHAR(400) NULL'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS validacion_identidad_enviado_at TIMESTAMP NULL'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_selfie_cambiada_at TIMESTAMP NULL'); } catch (_) {}

  // Migración: compatibilidad de tipos de notificación + columnas de navegación
  try { await query('ALTER TABLE notificaciones MODIFY COLUMN tipo VARCHAR(60) NOT NULL'); } catch (_) {}
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS vacante_id INT NULL'); } catch (_) {}
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS conversacion_id INT NULL'); } catch (_) {}
  // Compatibilidad hacia atrás con implementaciones previas
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS chat_id INT NULL'); } catch (_) {}

  // Tabla password_resets para recuperación de contraseña
  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      celular VARCHAR(20) NOT NULL,
      codigo VARCHAR(6) NOT NULL,
      token VARCHAR(64) DEFAULT NULL,
      expira_en TIMESTAMP NOT NULL,
      usado TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_celular (celular)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Migraciones: columnas que pueden no existir si la tabla fue creada antes
  try { await query('ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS token VARCHAR(64) DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE password_resets ADD INDEX IF NOT EXISTS idx_token (token)'); } catch (_) {}
  // Eliminar ON UPDATE CURRENT_TIMESTAMP de expira_en — causaba que el UPDATE del token sobreescribiera la expiración
  try { await query('ALTER TABLE password_resets MODIFY COLUMN expira_en TIMESTAMP NOT NULL DEFAULT current_timestamp()'); } catch (_) {}

  // Migración: push token para notificaciones móviles
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_token VARCHAR(500) NULL'); } catch (_) {}

  // Tabla para códigos de verificación SMS (funciona para usuarios registrados y no registrados)
  await query(`
    CREATE TABLE IF NOT EXISTS codigos_verificacion (
      id INT AUTO_INCREMENT PRIMARY KEY,
      celular VARCHAR(20) NOT NULL,
      codigo VARCHAR(6) NOT NULL,
      verificado TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_celular (celular)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Crear usuario admin por defecto
  const bcrypt = require('bcryptjs');
  const adminExists = await query('SELECT id FROM usuarios WHERE rol = ? AND celular = ?', ['admin', '0000000000']);
  if (!adminExists || adminExists.length === 0) {
    const adminSeedPassword = (process.env.ADMIN_SEED_PASSWORD || '').trim();
    if (!adminSeedPassword) {
      console.warn('ADMIN_SEED_PASSWORD no configurado; no se creará el usuario admin por defecto.');
    } else {
      const hash = await bcrypt.hash(adminSeedPassword, 10);
      await query(`
        INSERT INTO usuarios (rol, nombre_completo, celular, correo, password_hash, cedula, acepta_habeas_data, verificado_sms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['admin', 'Administrador TerraEmpleo', '0000000000', 'admin@terraempleo.co', hash, '0000000000', 1, 1]);
      console.log('Usuario admin creado con ADMIN_SEED_PASSWORD (celular=0000000000).');
    }
  }

  console.log('Base de datos inicializada correctamente.');
}

module.exports = { initializeDatabase };
