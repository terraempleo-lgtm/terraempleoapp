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

  // Consentimiento (opt-in) para recibir mensajes operativos por WhatsApp.
  try { await query('ALTER TABLE usuarios ADD COLUMN whatsapp_opt_in TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await query('ALTER TABLE usuarios ADD COLUMN whatsapp_opt_in_at TIMESTAMP NULL DEFAULT NULL'); } catch (_) {}

  console.log('[WhatsApp] Schema del módulo de mensajería inicializado.');
}

module.exports = { initWhatsappSchema };
