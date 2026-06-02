const { query } = require('../config/database');

// Extrae la IP del cliente (respeta proxy/balanceador).
function ipDe(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = (fwd ? String(fwd).split(',')[0] : (req.socket && req.socket.remoteAddress)) || '';
  return ip.trim().slice(0, 45) || null;
}

// Registra una acción de auditoría. Nunca lanza: si falla, no debe romper la
// operación principal (solo deja un warning en consola).
async function registrarAuditoria({
  usuarioId = null, fincaId = null, entidad, registroId = null,
  accion, anterior = null, nuevo = null, descripcion = null, ip = null,
}) {
  try {
    await query(
      `INSERT INTO auditoria
        (usuario_id, finca_id, entidad, registro_id, accion, valor_anterior, valor_nuevo, descripcion, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId, fincaId, entidad, registroId, accion,
        anterior != null ? JSON.stringify(anterior) : null,
        nuevo != null ? JSON.stringify(nuevo) : null,
        descripcion ? String(descripcion).slice(0, 400) : null,
        ip,
      ]
    );
  } catch (e) {
    console.warn('[auditoria] no se pudo registrar:', e.message);
  }
}

module.exports = { registrarAuditoria, ipDe };
