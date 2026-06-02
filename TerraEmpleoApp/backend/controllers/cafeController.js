const { query } = require('../config/database');
const { accesoFinca } = require('./fincaController');
const { registrarAuditoria, ipDe } = require('../helpers/auditoria');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de conversión y alertas
// ─────────────────────────────────────────────────────────────────────────────
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function estimarPergamino(finca, totalCereza) {
  const factor = Number(finca.factor_conversion) || 5;
  const kgArroba = Number(finca.kg_por_arroba) || 12.5;
  const kgCarga = Number(finca.kg_por_carga) || 125;
  const pergamino = factor > 0 ? totalCereza / factor : 0;
  return {
    factor,
    kg_pergamino_estimado: round2(pergamino),
    arrobas_estimadas: round2(kgArroba > 0 ? pergamino / kgArroba : 0),
    cargas_estimadas: round2(kgCarga > 0 ? pergamino / kgCarga : 0),
  };
}

function clasificarSeveridad(pct, umbral) {
  // pct = merma porcentual (estimado-real)/estimado*100. Solo la pérdida importa.
  if (pct <= umbral) return 'ok';
  if (pct <= umbral * 2) return 'revisar';
  return 'critica';
}

// Suma la cereza recolectada (Cuaderno) de la finca en un rango de fechas.
async function sumarCereza(finca, desde, hasta) {
  const rows = await query(
    `SELECT COALESCE(SUM(r.cantidad_kg), 0) AS total
       FROM cuaderno_registros_trabajo r
       JOIN cuaderno_jornadas j ON j.id = r.jornada_id
      WHERE (j.finca_id = ? OR (j.finca_id IS NULL AND j.empleador_id = ?))
        AND j.fecha BETWEEN ? AND ?`,
    [finca.id, finca.empleador_id, desde, hasta]
  );
  return Number((rows && rows[0] && rows[0].total) || 0);
}

async function getFinca(fincaId) {
  const rows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
  return rows && rows[0];
}

// Recalcula (upsert) la alerta de un lote según el total real registrado.
async function recomputarAlerta(lote, umbralPct) {
  const realRows = await query(
    'SELECT COALESCE(SUM(kg_pergamino_real), 0) AS total FROM cafe_produccion_real WHERE lote_id = ?',
    [lote.id]
  );
  const real = Number((realRows && realRows[0] && realRows[0].total) || 0);
  const estimado = Number(lote.kg_pergamino_estimado) || 0;
  const difKg = round2(estimado - real);
  const difPct = estimado > 0 ? round2((difKg / estimado) * 100) : 0;
  const severidad = real > 0 ? clasificarSeveridad(difPct, Number(umbralPct) || 15) : 'ok';

  const existe = await query('SELECT id, estado FROM cafe_alertas WHERE lote_id = ?', [lote.id]);
  if (existe && existe.length) {
    // Conservamos el estado de gestión (abierta/justificada/cerrada); solo refrescamos cifras.
    await query(
      `UPDATE cafe_alertas SET estimado_kg = ?, real_kg = ?, diferencia_kg = ?, diferencia_pct = ?, severidad = ?
        WHERE lote_id = ?`,
      [estimado, real, difKg, difPct, severidad, lote.id]
    );
  } else {
    await query(
      `INSERT INTO cafe_alertas (lote_id, estimado_kg, real_kg, diferencia_kg, diferencia_pct, severidad, estado)
       VALUES (?, ?, ?, ?, ?, ?, 'abierta')`,
      [lote.id, estimado, real, difKg, difPct, severidad]
    );
  }
  return { estimado, real, diferencia_kg: difKg, diferencia_pct: difPct, severidad };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista previa de conversión (antes de crear el lote)
// GET /cafe/preview?finca_id=&desde=&hasta=
// ─────────────────────────────────────────────────────────────────────────────
async function preview(req, res) {
  try {
    const fincaId = Number(req.query.finca_id);
    const { desde, hasta } = req.query;
    if (!fincaId || !desde || !hasta) {
      return res.status(400).json({ error: 'finca_id, desde y hasta son obligatorios' });
    }
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const finca = await getFinca(fincaId);
    const totalCereza = await sumarCereza(finca, desde, hasta);
    res.json({ total_kg_cereza: round2(totalCereza), ...estimarPergamino(finca, totalCereza) });
  } catch (err) {
    console.error('preview:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lotes
// ─────────────────────────────────────────────────────────────────────────────
async function listarLotes(req, res) {
  try {
    const fincaId = Number(req.query.finca_id);
    if (!fincaId) return res.status(400).json({ error: 'finca_id es obligatorio' });
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const lotes = await query(
      `SELECT l.*,
              al.real_kg, al.diferencia_kg, al.diferencia_pct, al.severidad, al.estado AS alerta_estado,
              al.justificacion,
              (SELECT COUNT(*) FROM cafe_produccion_real pr WHERE pr.lote_id = l.id) AS reg_reales
         FROM cafe_lotes l
         LEFT JOIN cafe_alertas al ON al.lote_id = l.id
        WHERE l.finca_id = ?
        ORDER BY l.fecha DESC, l.id DESC`,
      [fincaId]
    );
    res.json({ rol_finca: acc.rol, lotes: lotes || [] });
  } catch (err) {
    console.error('listarLotes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearLote(req, res) {
  try {
    const fincaId = Number(req.body.finca_id);
    const { fecha, rango_desde, rango_hasta, descripcion } = req.body;
    if (!fincaId || !fecha) return res.status(400).json({ error: 'finca_id y fecha son obligatorios' });
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const finca = await getFinca(fincaId);
    // Si dan rango, se calcula la cereza del Cuaderno; si no, se puede enviar manual.
    let totalCereza = Number(req.body.total_kg_cereza) || 0;
    if (rango_desde && rango_hasta) totalCereza = await sumarCereza(finca, rango_desde, rango_hasta);

    const est = estimarPergamino(finca, totalCereza);
    const result = await query(
      `INSERT INTO cafe_lotes
        (finca_id, fecha, rango_desde, rango_hasta, descripcion, total_kg_cereza,
         factor_usado, kg_pergamino_estimado, arrobas_estimadas, cargas_estimadas, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fincaId, fecha, rango_desde || null, rango_hasta || null, descripcion || null,
       round2(totalCereza), est.factor, est.kg_pergamino_estimado, est.arrobas_estimadas, est.cargas_estimadas,
       req.user.id]
    );
    const loteId = Number(result.insertId);
    const loteRows = await query('SELECT * FROM cafe_lotes WHERE id = ?', [loteId]);
    await recomputarAlerta(loteRows[0], finca.umbral_merma_pct);
    res.status(201).json({ lote: loteRows[0] });
  } catch (err) {
    console.error('crearLote:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function detalleLote(req, res) {
  try {
    const id = Number(req.params.id);
    const loteRows = await query('SELECT * FROM cafe_lotes WHERE id = ?', [id]);
    const lote = loteRows && loteRows[0];
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    const acc = await accesoFinca(Number(lote.finca_id), req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const reales = await query(
      'SELECT * FROM cafe_produccion_real WHERE lote_id = ? ORDER BY fecha ASC, id ASC',
      [id]
    );
    const alertaRows = await query('SELECT * FROM cafe_alertas WHERE lote_id = ?', [id]);
    res.json({ rol_finca: acc.rol, lote, reales: reales || [], alerta: (alertaRows && alertaRows[0]) || null });
  } catch (err) {
    console.error('detalleLote:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarLote(req, res) {
  try {
    const id = Number(req.params.id);
    const loteRows = await query('SELECT finca_id FROM cafe_lotes WHERE id = ?', [id]);
    if (!loteRows || !loteRows.length) return res.status(404).json({ error: 'Lote no encontrado' });
    const acc = await accesoFinca(Number(loteRows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const sets = [];
    const params = [];
    if (req.body.descripcion !== undefined) { sets.push('descripcion = ?'); params.push(req.body.descripcion || null); }
    if (req.body.estado !== undefined) {
      if (!['en_proceso', 'secado', 'vendido', 'almacenado'].includes(req.body.estado)) {
        return res.status(400).json({ error: 'estado inválido' });
      }
      sets.push('estado = ?'); params.push(req.body.estado);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    await query(`UPDATE cafe_lotes SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (err) {
    console.error('actualizarLote:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarLote(req, res) {
  try {
    const id = Number(req.params.id);
    const loteRows = await query('SELECT finca_id FROM cafe_lotes WHERE id = ?', [id]);
    if (!loteRows || !loteRows.length) return res.status(404).json({ error: 'Lote no encontrado' });
    const acc = await accesoFinca(Number(loteRows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    await query('DELETE FROM cafe_lotes WHERE id = ?', [id]);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(loteRows[0].finca_id), entidad: 'cafe_lote', registroId: id,
      accion: 'eliminar', descripcion: 'Lote de café eliminado', ip: ipDe(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('eliminarLote:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Producción real (báscula) — recalcula la alerta
// ─────────────────────────────────────────────────────────────────────────────
async function registrarReal(req, res) {
  try {
    const loteId = Number(req.params.id);
    const loteRows = await query('SELECT * FROM cafe_lotes WHERE id = ?', [loteId]);
    const lote = loteRows && loteRows[0];
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    const acc = await accesoFinca(Number(lote.finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const kg = Number(req.body.kg_pergamino_real) || 0;
    if (kg <= 0) return res.status(400).json({ error: 'kg_pergamino_real debe ser mayor a 0' });
    const destino = ['venta', 'almacen'].includes(req.body.destino) ? req.body.destino : 'venta';
    const fecha = req.body.fecha || lote.fecha;

    await query(
      `INSERT INTO cafe_produccion_real
        (lote_id, fecha, kg_pergamino_real, destino, precio_venta, comprador, nota, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loteId, fecha, round2(kg), destino, req.body.precio_venta || null,
       req.body.comprador || null, req.body.nota || null, req.user.id]
    );

    const finca = await getFinca(Number(lote.finca_id));
    const alerta = await recomputarAlerta(lote, finca.umbral_merma_pct);
    res.status(201).json({ ok: true, alerta });
  } catch (err) {
    console.error('registrarReal:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarReal(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      `SELECT pr.lote_id, l.finca_id FROM cafe_produccion_real pr
         JOIN cafe_lotes l ON l.id = pr.lote_id WHERE pr.id = ?`,
      [id]
    );
    if (!rows || !rows.length) return res.status(404).json({ error: 'Registro no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    await query('DELETE FROM cafe_produccion_real WHERE id = ?', [id]);
    const loteRows = await query('SELECT * FROM cafe_lotes WHERE id = ?', [rows[0].lote_id]);
    const finca = await getFinca(Number(rows[0].finca_id));
    await recomputarAlerta(loteRows[0], finca.umbral_merma_pct);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(rows[0].finca_id), entidad: 'cafe_produccion_real', registroId: id,
      accion: 'eliminar', descripcion: 'Registro de producción real eliminado', ip: ipDe(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('eliminarReal:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestión de alertas (justificar / cerrar) — solo propietario
// ─────────────────────────────────────────────────────────────────────────────
async function gestionarAlerta(req, res) {
  try {
    const loteId = Number(req.params.id);
    const loteRows = await query('SELECT finca_id FROM cafe_lotes WHERE id = ?', [loteId]);
    if (!loteRows || !loteRows.length) return res.status(404).json({ error: 'Lote no encontrado' });
    const acc = await accesoFinca(Number(loteRows[0].finca_id), req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const estado = req.body.estado;
    if (!['abierta', 'justificada', 'cerrada'].includes(estado)) {
      return res.status(400).json({ error: 'estado inválido' });
    }
    await query(
      'UPDATE cafe_alertas SET estado = ?, justificacion = ?, revisado_por = ? WHERE lote_id = ?',
      [estado, req.body.justificacion || null, req.user.id, loteId]
    );
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(loteRows[0].finca_id), entidad: 'cafe_alerta', registroId: loteId,
      accion: estado === 'cerrada' ? 'cerrar' : (estado === 'justificada' ? 'justificar' : 'reabrir'),
      nuevo: { estado, justificacion: req.body.justificacion || null },
      descripcion: `Alerta de conversión: ${estado}`, ip: ipDe(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('gestionarAlerta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Panel de alertas abiertas que requieren atención.
async function alertas(req, res) {
  try {
    const fincaId = Number(req.query.finca_id);
    if (!fincaId) return res.status(400).json({ error: 'finca_id es obligatorio' });
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const rows = await query(
      `SELECT al.*, l.fecha, l.descripcion, l.total_kg_cereza
         FROM cafe_alertas al
         JOIN cafe_lotes l ON l.id = al.lote_id
        WHERE l.finca_id = ? AND al.severidad IN ('revisar','critica') AND al.estado = 'abierta'
        ORDER BY FIELD(al.severidad,'critica','revisar'), al.diferencia_pct DESC`,
      [fincaId]
    );
    res.json({ alertas: rows || [] });
  } catch (err) {
    console.error('alertas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  preview,
  listarLotes,
  crearLote,
  detalleLote,
  actualizarLote,
  eliminarLote,
  registrarReal,
  eliminarReal,
  gestionarAlerta,
  alertas,
};
