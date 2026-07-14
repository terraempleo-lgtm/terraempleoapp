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
      tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo','por_kilo') DEFAULT NULL,
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
      tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo','por_kilo') DEFAULT NULL,
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
      vacante_id INT DEFAULT NULL,
      empleador_id INT NOT NULL,
      trabajador_id INT NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE CASCADE,
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Hacer vacante_id nullable en chats si ya existía como NOT NULL (migracion)
  await query(`
    ALTER TABLE chats MODIFY COLUMN vacante_id INT DEFAULT NULL
  `).catch(() => {});
  // Eliminar unique key antigua si existe (no permite NULL duplicados correctamente en algunos motores)
  await query(`
    ALTER TABLE chats DROP INDEX uk_chat
  `).catch(() => {});

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
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado_at DATETIME DEFAULT NULL'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS eliminado_motivo VARCHAR(255) DEFAULT NULL'); } catch (_) {}

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
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_portada VARCHAR(500) DEFAULT NULL'); } catch (_) {}

  // Migración: compatibilidad de tipos de notificación + columnas de navegación
  try { await query('ALTER TABLE notificaciones MODIFY COLUMN tipo VARCHAR(60) NOT NULL'); } catch (_) {}
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS vacante_id INT NULL'); } catch (_) {}
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS conversacion_id INT NULL'); } catch (_) {}
  // Compatibilidad hacia atrás con implementaciones previas
  try { await query('ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS chat_id INT NULL'); } catch (_) {}

  // Migración: verificación de empresa/finca para empleadores
  try { await query("ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS doc_verificacion_url VARCHAR(500) DEFAULT NULL"); } catch (_) {}
  try { await query("ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS verificacion_empresa_estado ENUM('sin_enviar','pendiente','aprobada','rechazada') NOT NULL DEFAULT 'sin_enviar'"); } catch (_) {}
  try { await query("ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS verificacion_empresa_revisado_por INT NULL"); } catch (_) {}
  try { await query("ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS verificacion_empresa_revisado_at TIMESTAMP NULL"); } catch (_) {}
  try { await query("ALTER TABLE perfil_empleador ADD COLUMN IF NOT EXISTS verificacion_empresa_comentario VARCHAR(400) NULL"); } catch (_) {}

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

  // Tabla de reportes de contenido / usuarios
  await query(`
    CREATE TABLE IF NOT EXISTS reportes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reportado_por INT NOT NULL,
      usuario_reportado INT NOT NULL,
      mensaje_id INT DEFAULT NULL,
      chat_id INT DEFAULT NULL,
      motivo VARCHAR(100) NOT NULL,
      descripcion TEXT DEFAULT NULL,
      estado ENUM('pendiente','revisado','resuelto') NOT NULL DEFAULT 'pendiente',
      accion_tomada VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      revisado_at TIMESTAMP NULL DEFAULT NULL,
      revisado_por INT DEFAULT NULL,
      FOREIGN KEY (reportado_por) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_reportado) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Tabla de usuarios bloqueados
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios_bloqueados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bloqueador_id INT NOT NULL,
      bloqueado_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_bloqueo (bloqueador_id, bloqueado_id),
      FOREIGN KEY (bloqueador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (bloqueado_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migración: campo baneado en usuarios
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baneado TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS baneado_motivo VARCHAR(255) DEFAULT NULL'); } catch (_) {}

  // Migración: campo reportado en mensajes
  try { await query('ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS reportado TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}

  // Tabla PQRS
  await query(`
    CREATE TABLE IF NOT EXISTS pqrs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo ENUM('peticion','queja','reclamo','sugerencia') NOT NULL,
      asunto VARCHAR(200) NOT NULL,
      descripcion TEXT NOT NULL,
      estado ENUM('recibido','en_proceso','resuelto','cerrado') NOT NULL DEFAULT 'recibido',
      respuesta TEXT DEFAULT NULL,
      respuesta_usuario TEXT DEFAULT NULL,
      respondido_por INT DEFAULT NULL,
      respondido_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

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

  // ── Especialistas ──────────────────────────────────────────────────────────
  // Migración: ampliar ENUM rol para incluir especialista
  try {
    await query("ALTER TABLE usuarios MODIFY COLUMN rol ENUM('trabajador','empleador','admin','especialista') NOT NULL");
  } catch (e) {
    if (!e.message.includes('Duplicate') && !e.message.includes('already exists')) console.warn('[Migration] rol ENUM:', e.message);
  }

  // Perfil especialista (agroindustrial / técnico / prestador de servicios)
  await query(`
    CREATE TABLE IF NOT EXISTS perfil_especialista (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL UNIQUE,
      descripcion_servicio TEXT DEFAULT NULL,
      nivel_formacion ENUM('empirico','tecnico_tecnologo','profesional') DEFAULT NULL,
      titulo_certificacion VARCHAR(200) DEFAULT NULL,
      anios_experiencia ENUM('menos_1','1_3','3_5','5_10','mas_10') DEFAULT NULL,
      modalidad_trabajo ENUM('por_proyecto','por_dias','mensual','asesoria_puntual') DEFAULT NULL,
      radio_cobertura ENUM('municipio','departamento','eje_cafetero','nacional') DEFAULT 'municipio',
      hoja_vida_url VARCHAR(500) DEFAULT NULL,
      hoja_vida_nombre VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Especialidades del especialista (chips)
  await query(`
    CREATE TABLE IF NOT EXISTS especialista_especialidades (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_especialista_id INT NOT NULL,
      especialidad VARCHAR(150) NOT NULL,
      es_personalizada TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_especialista_id) REFERENCES perfil_especialista(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Cultivos/producciones con los que ha trabajado el especialista
  await query(`
    CREATE TABLE IF NOT EXISTS especialista_cultivos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_especialista_id INT NOT NULL,
      cultivo VARCHAR(150) NOT NULL,
      es_personalizado TINYINT(1) DEFAULT 0,
      FOREIGN KEY (perfil_especialista_id) REFERENCES perfil_especialista(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Fotos de trabajo del trabajador (portafolio)
  await query(`
    CREATE TABLE IF NOT EXISTS trabajador_fotos_trabajo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_trabajador_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (perfil_trabajador_id) REFERENCES perfil_trabajador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Fotos del trabajo del especialista (portafolio)
  await query(`
    CREATE TABLE IF NOT EXISTS especialista_fotos_trabajo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_especialista_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (perfil_especialista_id) REFERENCES perfil_especialista(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Contactos directos empleador → especialista (sin necesidad de vacante)
  await query(`
    CREATE TABLE IF NOT EXISTS contactos_especialista (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleador_id INT NOT NULL,
      especialista_id INT NOT NULL,
      estado ENUM('solicitado','aceptado','rechazado') DEFAULT 'solicitado',
      chat_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_contacto (empleador_id, especialista_id),
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (especialista_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Experiencias laborales (trabajador y especialista)
  await query(`
    CREATE TABLE IF NOT EXISTS experiencias_laborales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      entidad VARCHAR(255) NOT NULL,
      descripcion TEXT DEFAULT NULL,
      duracion VARCHAR(100) DEFAULT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Fotos de finca del empleador (hasta 4)
  await query(`
    CREATE TABLE IF NOT EXISTS empleador_fotos_finca (
      id INT AUTO_INCREMENT PRIMARY KEY,
      perfil_empleador_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (perfil_empleador_id) REFERENCES perfil_empleador(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS certificados_usuario (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      entidad VARCHAR(200) DEFAULT NULL,
      anio INT DEFAULT NULL,
      archivo_url VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Servicios que ofrecen los especialistas
  await query(`
    CREATE TABLE IF NOT EXISTS servicios_especialista (
      id INT AUTO_INCREMENT PRIMARY KEY,
      especialista_id INT NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      descripcion TEXT DEFAULT NULL,
      cultivos JSON DEFAULT NULL,
      precio_desde DECIMAL(10,2) DEFAULT NULL,
      precio_hasta DECIMAL(10,2) DEFAULT NULL,
      modalidad VARCHAR(100) DEFAULT NULL,
      activo TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (especialista_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS servicio_fotos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      servicio_id INT NOT NULL,
      url VARCHAR(500) NOT NULL,
      orden INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (servicio_id) REFERENCES servicios_especialista(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Cuaderno del empleador (control y seguimiento de trabajadores) ─────────
  // Una jornada = un día de trabajo asociado opcionalmente a una vacante.
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_jornadas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleador_id INT NOT NULL,
      vacante_id INT DEFAULT NULL,
      fecha DATE NOT NULL,
      titulo VARCHAR(200) DEFAULT NULL,
      finca VARCHAR(200) DEFAULT NULL,
      tipo_trabajo VARCHAR(150) DEFAULT NULL,
      tipo_pago_default ENUM('jornal','por_kilo','mixto') DEFAULT 'jornal',
      precio_jornal DECIMAL(12,2) DEFAULT NULL,
      precio_kilo DECIMAL(12,2) DEFAULT NULL,
      costos_generales DECIMAL(12,2) DEFAULT 0,
      observaciones TEXT DEFAULT NULL,
      estado ENUM('planeada','en_curso','cerrada') NOT NULL DEFAULT 'planeada',
      cerrada_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cuad_emp_fecha (empleador_id, fecha),
      INDEX idx_cuad_vacante (vacante_id),
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (vacante_id) REFERENCES vacantes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Asistencia del trabajador a una jornada.
  // trabajador_id puede ser NULL si el empleador agrega un trabajador externo (manual_nombre).
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_asistencias (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jornada_id INT NOT NULL,
      trabajador_id INT DEFAULT NULL,
      manual_nombre VARCHAR(200) DEFAULT NULL,
      manual_telefono VARCHAR(30) DEFAULT NULL,
      estado ENUM('pendiente','llego','llego_tarde','no_llego','cancelo') NOT NULL DEFAULT 'pendiente',
      hora_llegada TIME DEFAULT NULL,
      notas VARCHAR(400) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cuad_asis_jornada (jornada_id),
      INDEX idx_cuad_asis_trabajador (trabajador_id),
      FOREIGN KEY (jornada_id) REFERENCES cuaderno_jornadas(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Registro de trabajo: producción, horas y pago calculado por asistencia.
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_registros_trabajo (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asistencia_id INT NOT NULL UNIQUE,
      jornada_id INT NOT NULL,
      cantidad_kg DECIMAL(10,2) DEFAULT NULL,
      horas DECIMAL(5,2) DEFAULT NULL,
      tipo_pago ENUM('jornal','por_kilo','mixto') DEFAULT 'jornal',
      precio_jornal DECIMAL(12,2) DEFAULT NULL,
      precio_kilo DECIMAL(12,2) DEFAULT NULL,
      pago_total DECIMAL(12,2) DEFAULT 0,
      pagado TINYINT(1) NOT NULL DEFAULT 0,
      pagado_at TIMESTAMP NULL DEFAULT NULL,
      estado ENUM('completo','parcial','cancelado') NOT NULL DEFAULT 'completo',
      notas VARCHAR(400) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cuad_reg_jornada (jornada_id),
      FOREIGN KEY (asistencia_id) REFERENCES cuaderno_asistencias(id) ON DELETE CASCADE,
      FOREIGN KEY (jornada_id) REFERENCES cuaderno_jornadas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Calificación rápida interna (privada del empleador) + observaciones.
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_calificaciones_internas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asistencia_id INT NOT NULL UNIQUE,
      jornada_id INT NOT NULL,
      empleador_id INT NOT NULL,
      trabajador_id INT DEFAULT NULL,
      nivel ENUM('bien','regular','mal') NOT NULL,
      comentario VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cuad_calif_trab (trabajador_id),
      INDEX idx_cuad_calif_emp (empleador_id),
      FOREIGN KEY (asistencia_id) REFERENCES cuaderno_asistencias(id) ON DELETE CASCADE,
      FOREIGN KEY (jornada_id) REFERENCES cuaderno_jornadas(id) ON DELETE CASCADE,
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Notas privadas del empleador sobre un trabajador (independiente de jornada).
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_notas_trabajador (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleador_id INT NOT NULL,
      trabajador_id INT DEFAULT NULL,
      manual_nombre VARCHAR(200) DEFAULT NULL,
      nota TEXT NOT NULL,
      tipo ENUM('observacion','incidencia','recordatorio') NOT NULL DEFAULT 'observacion',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cuad_notas_emp (empleador_id),
      INDEX idx_cuad_notas_trab (trabajador_id),
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Trabajadores identificados por cédula que aún no tienen cuenta en la app.
  // Acumula experiencia (jornadas) entre fincas distintas hasta que el
  // trabajador se registre; en ese momento se enlaza (trabajador_id) sin borrarse.
  await query(`
    CREATE TABLE IF NOT EXISTS trabajadores_externos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cedula VARCHAR(20) NOT NULL UNIQUE,
      nombre_completo VARCHAR(200) NOT NULL,
      celular VARCHAR(20) DEFAULT NULL,
      creado_por_empleador_id INT NOT NULL,
      trabajador_id INT DEFAULT NULL,
      migrado TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_trabext_trabajador (trabajador_id),
      FOREIGN KEY (creado_por_empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE,
      FOREIGN KEY (trabajador_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Nota: finca_id se agrega a esta tabla (y a cuaderno_notas_trabajador) más
  // abajo vía ALTER TABLE, después de que la tabla `fincas` ya existe — ver
  // migración "scoping por finca: notas y trabajadores_externos".

  // ── Módulo Finca Cafetera · Fase 1: Finanzas ───────────────────────────────
  // Entidad finca: cuelga parámetros de conversión y la modalidad de alimentación.
  await query(`
    CREATE TABLE IF NOT EXISTS fincas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleador_id INT NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      municipio VARCHAR(150) DEFAULT NULL,
      vereda VARCHAR(150) DEFAULT NULL,
      hectareas DECIMAL(8,2) DEFAULT NULL,
      modalidad_alimentacion ENUM('incluida','independiente') NOT NULL DEFAULT 'incluida',
      factor_conversion DECIMAL(6,3) NOT NULL DEFAULT 5.000,
      kg_por_arroba DECIMAL(6,3) NOT NULL DEFAULT 12.500,
      kg_por_carga DECIMAL(7,2) NOT NULL DEFAULT 125.00,
      umbral_merma_pct DECIMAL(5,2) NOT NULL DEFAULT 15.00,
      moneda CHAR(3) NOT NULL DEFAULT 'COP',
      activa TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_finca_emp (empleador_id),
      FOREIGN KEY (empleador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Roles internos por finca (separación de funciones para antifraude).
  await query(`
    CREATE TABLE IF NOT EXISTS finca_usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      finca_id INT NOT NULL,
      usuario_id INT NOT NULL,
      rol_finca ENUM('propietario','administrador','auxiliar','contador') NOT NULL DEFAULT 'auxiliar',
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_finca_usuario (finca_id, usuario_id),
      INDEX idx_fu_usuario (usuario_id),
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Período mensual: un mes contiene 4 o 5 semanas (filas, no columnas).
  await query(`
    CREATE TABLE IF NOT EXISTS fin_periodos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      finca_id INT NOT NULL,
      anio SMALLINT NOT NULL,
      mes TINYINT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      estado ENUM('abierto','cerrado') NOT NULL DEFAULT 'abierto',
      cerrado_at TIMESTAMP NULL DEFAULT NULL,
      cerrado_por INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_finca_periodo (finca_id, anio, mes),
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE,
      FOREIGN KEY (cerrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Semanas del período (numero_semana 1..5, lunes-inicio recortado al mes).
  await query(`
    CREATE TABLE IF NOT EXISTS fin_semanas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      periodo_id INT NOT NULL,
      numero_semana TINYINT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      UNIQUE KEY uq_periodo_semana (periodo_id, numero_semana),
      FOREIGN KEY (periodo_id) REFERENCES fin_periodos(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Catálogo de conceptos financieros (los 4 cuadros: ventas/fijos/variables/facturas).
  await query(`
    CREATE TABLE IF NOT EXISTS fin_conceptos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      finca_id INT NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      tipo ENUM('ingreso','gasto_fijo','gasto_variable','factura') NOT NULL,
      periodicidad ENUM('semanal','mensual','bimensual') NOT NULL DEFAULT 'semanal',
      orden INT NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_concepto_finca_tipo (finca_id, tipo),
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Movimientos: una fila por concepto+semana (o por período en facturas).
  await query(`
    CREATE TABLE IF NOT EXISTS fin_movimientos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      concepto_id INT NOT NULL,
      periodo_id INT NOT NULL,
      semana_id INT DEFAULT NULL,
      monto DECIMAL(14,2) NOT NULL DEFAULT 0,
      fecha DATE DEFAULT NULL,
      nota VARCHAR(300) DEFAULT NULL,
      registrado_por INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_mov_periodo (periodo_id),
      INDEX idx_mov_semana (semana_id),
      INDEX idx_mov_concepto (concepto_id),
      FOREIGN KEY (concepto_id) REFERENCES fin_conceptos(id) ON DELETE CASCADE,
      FOREIGN KEY (periodo_id) REFERENCES fin_periodos(id) ON DELETE CASCADE,
      FOREIGN KEY (semana_id) REFERENCES fin_semanas(id) ON DELETE SET NULL,
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Módulo Finca Cafetera · Fase 2: Nómina enriquecida ─────────────────────
  // Ajustes a la liquidación de un trabajador en una jornada: bonificaciones,
  // descuentos, anticipos y labores extra (ej. "guadañando x 120").
  await query(`
    CREATE TABLE IF NOT EXISTS cuaderno_ajustes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      asistencia_id INT NOT NULL,
      jornada_id INT NOT NULL,
      tipo ENUM('bonificacion','descuento','anticipo','labor_extra') NOT NULL,
      monto DECIMAL(12,2) NOT NULL DEFAULT 0,
      motivo VARCHAR(300) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ajuste_asis (asistencia_id),
      INDEX idx_ajuste_jornada (jornada_id),
      FOREIGN KEY (asistencia_id) REFERENCES cuaderno_asistencias(id) ON DELETE CASCADE,
      FOREIGN KEY (jornada_id) REFERENCES cuaderno_jornadas(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Módulo Finca Cafetera · Fase 3: Conversión y antifraude ────────────────
  // Lote de café: agrupa la cereza recolectada (de un rango de fechas) y guarda
  // la estimación de pergamino seco / arrobas / cargas con el factor de la finca.
  await query(`
    CREATE TABLE IF NOT EXISTS cafe_lotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      finca_id INT NOT NULL,
      fecha DATE NOT NULL,
      rango_desde DATE DEFAULT NULL,
      rango_hasta DATE DEFAULT NULL,
      descripcion VARCHAR(200) DEFAULT NULL,
      total_kg_cereza DECIMAL(12,2) NOT NULL DEFAULT 0,
      factor_usado DECIMAL(6,3) NOT NULL DEFAULT 5.000,
      kg_pergamino_estimado DECIMAL(12,2) NOT NULL DEFAULT 0,
      arrobas_estimadas DECIMAL(10,2) NOT NULL DEFAULT 0,
      cargas_estimadas DECIMAL(10,3) NOT NULL DEFAULT 0,
      estado ENUM('en_proceso','secado','vendido','almacenado') NOT NULL DEFAULT 'en_proceso',
      registrado_por INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lote_finca (finca_id),
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE,
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Producción real: lo que de verdad pesó al vender o almacenar (báscula).
  await query(`
    CREATE TABLE IF NOT EXISTS cafe_produccion_real (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lote_id INT NOT NULL,
      fecha DATE NOT NULL,
      kg_pergamino_real DECIMAL(12,2) NOT NULL DEFAULT 0,
      destino ENUM('venta','almacen') NOT NULL DEFAULT 'venta',
      precio_venta DECIMAL(14,2) DEFAULT NULL,
      comprador VARCHAR(200) DEFAULT NULL,
      nota VARCHAR(300) DEFAULT NULL,
      registrado_por INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_real_lote (lote_id),
      FOREIGN KEY (lote_id) REFERENCES cafe_lotes(id) ON DELETE CASCADE,
      FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Alerta de conversión: compara estimado vs real y marca severidad/estado.
  await query(`
    CREATE TABLE IF NOT EXISTS cafe_alertas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lote_id INT NOT NULL UNIQUE,
      estimado_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
      real_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
      diferencia_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
      diferencia_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
      severidad ENUM('ok','revisar','critica') NOT NULL DEFAULT 'ok',
      estado ENUM('abierta','justificada','cerrada') NOT NULL DEFAULT 'abierta',
      justificacion VARCHAR(500) DEFAULT NULL,
      revisado_por INT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (lote_id) REFERENCES cafe_lotes(id) ON DELETE CASCADE,
      FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // ── Módulo Finca Cafetera · Fase 4: Auditoría ──────────────────────────────
  // Registra acciones sensibles (ediciones tras cierre, cambios de factores,
  // gestión de alertas, etc.) para dar trazabilidad al control antifraude.
  await query(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT DEFAULT NULL,
      finca_id INT DEFAULT NULL,
      entidad VARCHAR(60) NOT NULL,
      registro_id INT DEFAULT NULL,
      accion VARCHAR(30) NOT NULL,
      valor_anterior TEXT DEFAULT NULL,
      valor_nuevo TEXT DEFAULT NULL,
      descripcion VARCHAR(400) DEFAULT NULL,
      ip VARCHAR(45) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_aud_finca (finca_id, created_at),
      INDEX idx_aud_usuario (usuario_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE CASCADE
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

  // Migraciones de columnas (ALTER TABLE IF NOT EXISTS no es soportado en MariaDB, se usa try/catch)
  try {
    await query('ALTER TABLE pqrs ADD COLUMN respuesta_usuario TEXT DEFAULT NULL');
    console.log('[Migration] Columna respuesta_usuario agregada a pqrs.');
  } catch (e) {
    if (!e.message.includes('Duplicate column')) console.warn('[Migration] pqrs.respuesta_usuario:', e.message);
  }

  // Migración: agregar 'por_kilo' al ENUM tipo_pago en perfil_empleador y vacantes
  try {
    await query("ALTER TABLE perfil_empleador MODIFY tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo','por_kilo') DEFAULT NULL");
    await query("ALTER TABLE vacantes MODIFY tipo_pago ENUM('jornal','semanal','quincenal','mensual','destajo','por_kilo') DEFAULT NULL");
    console.log('[Migration] ENUM tipo_pago actualizado con por_kilo.');
  } catch (e) {
    console.warn('[Migration] tipo_pago ENUM:', e.message);
  }

  // Migración: enlazar jornadas del Cuaderno con una finca (para que la nómina
  // entre al Resumen Financiero por período).
  try {
    await query('ALTER TABLE cuaderno_jornadas ADD COLUMN finca_id INT DEFAULT NULL');
    await query('ALTER TABLE cuaderno_jornadas ADD INDEX idx_cuad_finca (finca_id)');
    await query('ALTER TABLE cuaderno_jornadas ADD FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE SET NULL');
    console.log('[Migration] cuaderno_jornadas.finca_id agregada.');
  } catch (e) {
    if (!/Duplicate column|Duplicate key name|errno: 121|foreign key constraint/i.test(e.message)) {
      console.warn('[Migration] cuaderno_jornadas.finca_id:', e.message);
    }
  }

  // Backfill: resolver finca_id en jornadas creadas antes de las cuentas de
  // capataz (que solo guardaban `finca` como texto libre y el creador como
  // dueño único). Caso 1 (la gran mayoría): el creador tiene exactamente una
  // finca → se le asigna esa, sin importar el texto. Caso 2: el creador tiene
  // varias fincas → se resuelve por coincidencia exacta de nombre. El resto
  // queda con finca_id NULL (solo lo sigue viendo quien la creó).
  try {
    await query(`
      UPDATE cuaderno_jornadas j
      JOIN fincas f ON f.empleador_id = j.empleador_id
      LEFT JOIN fincas f2 ON f2.empleador_id = j.empleador_id AND f2.id <> f.id
      SET j.finca_id = f.id
      WHERE j.finca_id IS NULL AND f2.id IS NULL
    `);
    await query(`
      UPDATE cuaderno_jornadas j
      JOIN fincas f ON f.empleador_id = j.empleador_id AND f.nombre = j.finca
      SET j.finca_id = f.id
      WHERE j.finca_id IS NULL
    `);
    const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM cuaderno_jornadas WHERE finca_id IS NULL');
    console.log(`[Migration] cuaderno_jornadas backfill de finca_id: ${cnt} jornada(s) sin resolver (siguen visibles solo para quien las creó).`);
  } catch (e) {
    console.warn('[Migration] cuaderno_jornadas backfill finca_id:', e.message);
  }

  // Migración: firma de recibido del trabajador en la asistencia (Fase 2 nómina).
  try {
    await query('ALTER TABLE cuaderno_asistencias ADD COLUMN firma_recibido TINYINT(1) NOT NULL DEFAULT 0');
    await query('ALTER TABLE cuaderno_asistencias ADD COLUMN firmado_at TIMESTAMP NULL DEFAULT NULL');
    console.log('[Migration] cuaderno_asistencias.firma_recibido/firmado_at agregadas.');
  } catch (e) {
    if (!/Duplicate column/i.test(e.message)) console.warn('[Migration] cuaderno_asistencias.firma:', e.message);
  }

  // Migración: check-out del trabajador (hora de salida) en la asistencia.
  try {
    await query('ALTER TABLE cuaderno_asistencias ADD COLUMN IF NOT EXISTS hora_salida TIME DEFAULT NULL');
  } catch (e) {
    if (!/Duplicate column/i.test(e.message)) console.warn('[Migration] cuaderno_asistencias.hora_salida:', e.message);
  }

  // Migración: precios por defecto del cuaderno en la finca
  // (jornal, kilo y alimentación — la alimentación se descuenta del pago si el trabajador la tomó).
  try {
    await query('ALTER TABLE fincas ADD COLUMN IF NOT EXISTS precio_jornal_default DECIMAL(12,2) DEFAULT NULL');
    await query('ALTER TABLE fincas ADD COLUMN IF NOT EXISTS precio_kilo_default DECIMAL(12,2) DEFAULT NULL');
    await query('ALTER TABLE fincas ADD COLUMN IF NOT EXISTS precio_alimentacion DECIMAL(12,2) DEFAULT NULL');
  } catch (e) {
    if (!/Duplicate column/i.test(e.message)) console.warn('[Migration] fincas.precios cuaderno:', e.message);
  }

  // Migración: descuentos (alimentación u otros) en el registro de trabajo.
  try {
    await query('ALTER TABLE cuaderno_registros_trabajo ADD COLUMN IF NOT EXISTS descuento_alimentacion DECIMAL(12,2) NOT NULL DEFAULT 0');
    await query('ALTER TABLE cuaderno_registros_trabajo ADD COLUMN IF NOT EXISTS descuento_otro DECIMAL(12,2) NOT NULL DEFAULT 0');
    await query('ALTER TABLE cuaderno_registros_trabajo ADD COLUMN IF NOT EXISTS descuento_nota VARCHAR(200) DEFAULT NULL');
  } catch (e) {
    if (!/Duplicate column/i.test(e.message)) console.warn('[Migration] cuaderno_registros_trabajo.descuentos:', e.message);
  }

  // ── Muro de compra/venta (mercado entre agricultores) ─────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS muro_publicaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo ENUM('venta','compra') NOT NULL DEFAULT 'venta',
      producto VARCHAR(150) NOT NULL,
      descripcion TEXT DEFAULT NULL,
      cantidad VARCHAR(100) DEFAULT NULL,
      precio DECIMAL(14,2) DEFAULT NULL,
      unidad VARCHAR(30) DEFAULT NULL,
      foto_url VARCHAR(512) DEFAULT NULL,
      ubicacion VARCHAR(200) DEFAULT NULL,
      estado ENUM('activa','cerrada') NOT NULL DEFAULT 'activa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_muro_estado_fecha (estado, created_at),
      INDEX idx_muro_usuario (usuario_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migración: enlazar asistencias con un trabajador externo (por cédula, sin
  // cuenta todavía) en vez de solo texto suelto (manual_nombre/manual_telefono).
  try {
    await query('ALTER TABLE cuaderno_asistencias ADD COLUMN trabajador_externo_id INT DEFAULT NULL');
    await query('ALTER TABLE cuaderno_asistencias ADD INDEX idx_cuad_asis_externo (trabajador_externo_id)');
    await query('ALTER TABLE cuaderno_asistencias ADD FOREIGN KEY (trabajador_externo_id) REFERENCES trabajadores_externos(id) ON DELETE SET NULL');
    console.log('[Migration] cuaderno_asistencias.trabajador_externo_id agregada.');
  } catch (e) {
    if (!/Duplicate column|Duplicate key name|errno: 121|foreign key constraint/i.test(e.message)) {
      console.warn('[Migration] cuaderno_asistencias.trabajador_externo_id:', e.message);
    }
  }

  // Migración: scoping por finca para notas del cuaderno y trabajadores
  // externos — mismo criterio que cuaderno_jornadas.finca_id (ver arriba):
  // antes se veían/editaban solo por quien los creó, lo que rompía en
  // cuanto hay capataces compartiendo la misma finca.
  try {
    await query('ALTER TABLE cuaderno_notas_trabajador ADD COLUMN finca_id INT DEFAULT NULL');
    await query('ALTER TABLE cuaderno_notas_trabajador ADD INDEX idx_cuad_notas_finca (finca_id)');
    await query('ALTER TABLE cuaderno_notas_trabajador ADD FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE SET NULL');
    console.log('[Migration] cuaderno_notas_trabajador.finca_id agregada.');
  } catch (e) {
    if (!/Duplicate column|Duplicate key name|errno: 121|foreign key constraint/i.test(e.message)) {
      console.warn('[Migration] cuaderno_notas_trabajador.finca_id:', e.message);
    }
  }
  try {
    await query('ALTER TABLE trabajadores_externos ADD COLUMN finca_id INT DEFAULT NULL');
    await query('ALTER TABLE trabajadores_externos ADD INDEX idx_trabext_finca (finca_id)');
    await query('ALTER TABLE trabajadores_externos ADD FOREIGN KEY (finca_id) REFERENCES fincas(id) ON DELETE SET NULL');
    console.log('[Migration] trabajadores_externos.finca_id agregada.');
  } catch (e) {
    if (!/Duplicate column|Duplicate key name|errno: 121|foreign key constraint/i.test(e.message)) {
      console.warn('[Migration] trabajadores_externos.finca_id:', e.message);
    }
  }

  // Backfill: igual que con cuaderno_jornadas, si el creador tiene
  // exactamente una finca se le asigna esa sin ambigüedad. Ninguna de las
  // dos tablas tiene un campo de texto libre con nombre de finca, así que
  // no hay una segunda pasada por coincidencia de nombre — lo que quede sin
  // resolver es porque el creador tiene (o tenía) más de una finca.
  try {
    await query(`
      UPDATE cuaderno_notas_trabajador n
      JOIN fincas f ON f.empleador_id = n.empleador_id
      LEFT JOIN fincas f2 ON f2.empleador_id = n.empleador_id AND f2.id <> f.id
      SET n.finca_id = f.id
      WHERE n.finca_id IS NULL AND f2.id IS NULL
    `);
    const [{ cnt: cntNotas }] = await query('SELECT COUNT(*) AS cnt FROM cuaderno_notas_trabajador WHERE finca_id IS NULL');
    console.log(`[Migration] cuaderno_notas_trabajador backfill de finca_id: ${cntNotas} nota(s) sin resolver (siguen visibles solo para quien las creó).`);
  } catch (e) {
    console.warn('[Migration] cuaderno_notas_trabajador backfill finca_id:', e.message);
  }
  try {
    await query(`
      UPDATE trabajadores_externos te
      JOIN fincas f ON f.empleador_id = te.creado_por_empleador_id
      LEFT JOIN fincas f2 ON f2.empleador_id = te.creado_por_empleador_id AND f2.id <> f.id
      SET te.finca_id = f.id
      WHERE te.finca_id IS NULL AND f2.id IS NULL
    `);
    const [{ cnt: cntExternos }] = await query('SELECT COUNT(*) AS cnt FROM trabajadores_externos WHERE finca_id IS NULL');
    console.log(`[Migration] trabajadores_externos backfill de finca_id: ${cntExternos} registro(s) sin resolver (siguen visibles solo para quien los creó).`);
  } catch (e) {
    console.warn('[Migration] trabajadores_externos backfill finca_id:', e.message);
  }

  console.log('Base de datos inicializada correctamente.');
}

module.exports = { initializeDatabase };
