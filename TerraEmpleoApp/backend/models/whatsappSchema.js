/**
 * whatsappSchema.js — Tablas del Módulo de mensajería WhatsApp.
 *
 * Se mantiene separado del schema principal para que el módulo sea autocontenido.
 * Se invoca desde server.js DESPUÉS de initializeDatabase() (necesita la tabla `usuarios`).
 *
 * Diseño (ver "Módulo backend de mensajería_Whatsapp.docx"):
 *   - whatsapp_conversaciones → máquina de estados del flujo guiado (paso + payload temporal)
 *   - whatsapp_mensajes       → log/auditoría inbound+outbound con idempotencia por provider_message_id
 *   - usuarios.whatsapp_opt_in → consentimiento para recibir mensajes operativos
 *
 * Las solicitudes de trabajo NO crean tablas nuevas: el flujo del empleador genera una
 * `vacante` normal (reutilizando vacantes/vacante_cultivos/vacante_labores/postulaciones),
 * para no replicar lo que ya existe y que la app las vea sin cambios.
 */

const { query } = require('../config/database');

async function initWhatsappSchema() {
  // Conversaciones: una fila por número con flujo/paso activo y payload temporal.
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      telefono VARCHAR(25) NOT NULL,
      usuario_id INT DEFAULT NULL,
      flujo VARCHAR(60) DEFAULT NULL,
      paso VARCHAR(60) DEFAULT NULL,
      datos JSON DEFAULT NULL,
      estado ENUM('activa','completada','cancelada','expirada') NOT NULL DEFAULT 'activa',
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_wa_conv_tel (telefono),
      INDEX idx_wa_conv_estado (estado),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Log de mensajes: auditoría + idempotencia. provider_message_id es el id de Evolution/Meta.
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider_message_id VARCHAR(128) DEFAULT NULL,
      telefono VARCHAR(25) NOT NULL,
      usuario_id INT DEFAULT NULL,
      conversacion_id INT DEFAULT NULL,
      direccion ENUM('inbound','outbound') NOT NULL,
      tipo VARCHAR(40) NOT NULL DEFAULT 'texto',
      contenido TEXT DEFAULT NULL,
      payload JSON DEFAULT NULL,
      estado VARCHAR(40) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_wa_provider_msg (provider_message_id),
      INDEX idx_wa_msg_tel (telefono),
      INDEX idx_wa_msg_conv (conversacion_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (conversacion_id) REFERENCES whatsapp_conversaciones(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Mapeo de identidad de WhatsApp → usuario. Necesario porque WhatsApp entrega el
  // remitente como "<id>@lid" (oculta el número). Se llena cuando un @lid desconocido
  // se identifica con su número registrado; desde ahí se reconoce automáticamente.
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_identidades (
      jid VARCHAR(40) PRIMARY KEY,
      usuario_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wa_ident_usuario (usuario_id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Base de conocimiento (FAQ) que usa la IA para responder con datos reales de TerraEmpleo.
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_kb (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clave VARCHAR(80) NOT NULL UNIQUE,
      pregunta VARCHAR(300) DEFAULT NULL,
      respuesta TEXT NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Bitácora de preguntas (para que los admins revisen y enriquezcan la KB → "aprendizaje").
  await query(`
    CREATE TABLE IF NOT EXISTS whatsapp_preguntas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      telefono VARCHAR(25) DEFAULT NULL,
      usuario_id INT DEFAULT NULL,
      texto TEXT NOT NULL,
      accion VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_wa_preg_fecha (created_at),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Seed inicial de la KB (INSERT IGNORE → no pisa ediciones de los admins).
  const KB_SEED = [
    ['que_es', '¿Qué es TerraEmpleo?', 'TerraEmpleo es una app colombiana de empleo rural que conecta a trabajadores del campo con fincas y empleadores agrícolas.'],
    ['registrarse', '¿Cómo me registro?', 'Para registrarte escribe *REGISTRARME* aquí y te guío. La verificación final (foto y cédula) se hace en la app TerraEmpleo.'],
    ['postularse', '¿Cómo me postulo a un trabajo?', 'Escribe *OFERTAS* para ver las vacantes; cada una trae un link. Ábrelo en la app TerraEmpleo y ahí te postulas.'],
    ['ver_ofertas', '¿Cómo veo trabajos disponibles?', 'Escribe *OFERTAS* y te muestro las vacantes activas con su pago, ubicación y link.'],
    ['publicar', '¿Cómo publico una vacante? (empleador)', 'Si tienes finca y necesitas gente, escribe *Necesito trabajadores* y te guío paso a paso para publicarla.'],
    ['costo', '¿Cuánto cuesta?', 'Usar TerraEmpleo y este asistente de WhatsApp es gratis, tanto para trabajadores como para empleadores.'],
    ['selfie_cedula', '¿Por qué la cédula va en la app?', 'Por seguridad, la selfie y la foto de cédula se suben en la app, no por WhatsApp. El resto del registro sí lo puedes hacer aquí.'],
    ['soporte', '¿Cómo hablo con una persona?', 'Cuéntame tu problema y con gusto te paso con un asesor de TerraEmpleo.'],
  ];
  for (const [clave, pregunta, respuesta] of KB_SEED) {
    await query('INSERT IGNORE INTO whatsapp_kb (clave, pregunta, respuesta) VALUES (?, ?, ?)', [clave, pregunta, respuesta]).catch(() => {});
  }

  // Consentimiento (opt-in) para recibir mensajes operativos por WhatsApp.
  try { await query('ALTER TABLE usuarios ADD COLUMN whatsapp_opt_in TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN whatsapp_opt_in_at TIMESTAMP NULL DEFAULT NULL'); } catch (_) {}

  // Control de mensaje de seguimiento al empleador (para no repetirlo por vacante).
  try { await query('ALTER TABLE vacantes ADD COLUMN whatsapp_seguimiento_at TIMESTAMP NULL DEFAULT NULL'); } catch (_) {}

  console.log('[WhatsApp] Schema del módulo de mensajería inicializado.');
}

module.exports = { initWhatsappSchema };
