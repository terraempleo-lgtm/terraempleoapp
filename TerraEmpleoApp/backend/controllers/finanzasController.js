const { query } = require('../config/database');
const { accesoFinca } = require('./fincaController');
const { registrarAuditoria, ipDe } = require('../helpers/auditoria');
const { deleteFromS3, signUrl, signArrayField } = require('../config/s3');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de calendario
// ─────────────────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, '0'); }

// Semanas en bloques de 7 días desde el día 1 (1-7, 8-14, 15-21, 22-28, 29-fin).
// Garantiza 4 o 5 semanas, cubre todo el mes y nunca pierde días.
function genSemanas(anio, mes) {
  const lastDay = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const semanas = [];
  let numero = 1;
  for (let d = 1; d <= lastDay; d += 7) {
    const fin = Math.min(d + 6, lastDay);
    semanas.push({
      numero,
      inicio: `${anio}-${pad(mes)}-${pad(d)}`,
      fin: `${anio}-${pad(mes)}-${pad(fin)}`,
    });
    numero++;
  }
  return semanas;
}

// Obtiene (o crea) el período del mes con sus semanas.
async function ensurePeriodo(fincaId, anio, mes) {
  let rows = await query(
    'SELECT * FROM fin_periodos WHERE finca_id = ? AND anio = ? AND mes = ?',
    [fincaId, anio, mes]
  );
  if (rows && rows.length) return rows[0];

  const lastDay = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const inicio = `${anio}-${pad(mes)}-01`;
  const fin = `${anio}-${pad(mes)}-${pad(lastDay)}`;
  try {
    const result = await query(
      'INSERT INTO fin_periodos (finca_id, anio, mes, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?, ?)',
      [fincaId, anio, mes, inicio, fin]
    );
    const periodoId = Number(result.insertId);
    for (const s of genSemanas(anio, mes)) {
      await query(
        'INSERT INTO fin_semanas (periodo_id, numero_semana, fecha_inicio, fecha_fin) VALUES (?, ?, ?, ?)',
        [periodoId, s.numero, s.inicio, s.fin]
      );
    }
  } catch (e) {
    // Carrera contra el UNIQUE (finca, anio, mes): re-seleccionamos.
    if (!/Duplicate entry/i.test(e.message)) throw e;
  }
  rows = await query(
    'SELECT * FROM fin_periodos WHERE finca_id = ? AND anio = ? AND mes = ?',
    [fincaId, anio, mes]
  );
  return rows[0];
}

async function calcularResumen(finca, periodo) {
  // Totales financieros por tipo de concepto.
  const tot = await query(
    `SELECT c.tipo, COALESCE(SUM(m.monto), 0) AS total
       FROM fin_movimientos m
       JOIN fin_conceptos c ON c.id = m.concepto_id
      WHERE m.periodo_id = ?
      GROUP BY c.tipo`,
    [periodo.id]
  );
  // 'nomina' se agrega aquí solo para que quede disponible si se necesita a
  // futuro, pero NO entra en total_gastos/diferencia: esa combinación
  // (nómina real del Cuaderno + nómina migrada tipo 'nomina') la hace el
  // frontend leyendo el array `conceptos`/`movimientos` del tablero.
  const porTipo = { ingreso: 0, gasto_fijo: 0, gasto_variable: 0, factura: 0, nomina: 0 };
  for (const r of tot || []) porTipo[r.tipo] = Number(r.total) || 0;

  // Nómina: se LEE del Cuaderno (no se duplica). Jornadas de esta finca
  // (o sin finca asignada pero del mismo dueño) dentro del rango del período.
  const nom = await query(
    `SELECT COALESCE(SUM(r.pago_total), 0) AS total
       FROM cuaderno_registros_trabajo r
       JOIN cuaderno_jornadas j ON j.id = r.jornada_id
      WHERE (j.finca_id = ? OR (j.finca_id IS NULL AND j.empleador_id = ?))
        AND j.fecha BETWEEN ? AND ?`,
    [finca.id, finca.empleador_id, periodo.fecha_inicio, periodo.fecha_fin]
  );
  const totalNomina = Number((nom && nom[0] && nom[0].total) || 0);

  const totalVentas = porTipo.ingreso;
  const totalGastos = totalNomina + porTipo.gasto_fijo + porTipo.gasto_variable + porTipo.factura;
  return {
    total_nomina: totalNomina,
    total_gastos_fijos: porTipo.gasto_fijo,
    total_gastos_variables: porTipo.gasto_variable,
    total_facturas: porTipo.factura,
    total_gastos: totalGastos,
    total_ventas: totalVentas,
    diferencia: totalVentas - totalGastos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tablero: todo lo que la pantalla de Finanzas necesita en una sola llamada.
// GET /finanzas/tablero?finca_id=&anio=&mes=
// ─────────────────────────────────────────────────────────────────────────────
async function tablero(req, res) {
  try {
    const fincaId = Number(req.query.finca_id);
    if (!fincaId) return res.status(400).json({ error: 'finca_id es obligatorio' });
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const hoy = new Date();
    const anio = Number(req.query.anio) || hoy.getFullYear();
    const mes = Number(req.query.mes) || (hoy.getMonth() + 1);
    if (mes < 1 || mes > 12) return res.status(400).json({ error: 'mes inválido' });

    const fincaRows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    const finca = fincaRows[0];
    const periodo = await ensurePeriodo(fincaId, anio, mes);

    const semanas = await query(
      'SELECT * FROM fin_semanas WHERE periodo_id = ? ORDER BY numero_semana',
      [periodo.id]
    );
    const conceptos = await query(
      `SELECT * FROM fin_conceptos WHERE finca_id = ? AND activo = 1
        ORDER BY FIELD(tipo,'ingreso','gasto_fijo','gasto_variable','factura','nomina'), orden, id`,
      [fincaId]
    );
    const movimientos = await query(
      'SELECT * FROM fin_movimientos WHERE periodo_id = ?',
      [periodo.id]
    );
    // El bucket es privado (sin ACL) — foto_url cruda de S3 no carga en el
    // cliente, hay que firmarla igual que el resto de fotos del proyecto.
    await signArrayField(movimientos, 'foto_url');
    const resumen = await calcularResumen(finca, periodo);

    res.json({
      finca,
      rol_finca: acc.rol,
      periodo,
      semanas: semanas || [],
      conceptos: conceptos || [],
      movimientos: movimientos || [],
      resumen,
    });
  } catch (err) {
    console.error('tablero:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimientos (upsert por concepto + semana/período)
// PUT /finanzas/movimientos  { concepto_id, periodo_id, semana_id|null, monto, nota }
// ─────────────────────────────────────────────────────────────────────────────
async function upsertMovimiento(req, res) {
  try {
    const { concepto_id, periodo_id, semana_id, nota } = req.body;
    const monto = Number(req.body.monto) || 0;
    if (!concepto_id || !periodo_id) {
      return res.status(400).json({ error: 'concepto_id y periodo_id son obligatorios' });
    }

    // Resolver finca y validar coherencia concepto/período.
    const c = await query('SELECT id, finca_id FROM fin_conceptos WHERE id = ?', [concepto_id]);
    if (!c || !c.length) return res.status(404).json({ error: 'Concepto no encontrado' });
    const fincaId = Number(c[0].finca_id);

    const p = await query('SELECT id, finca_id, estado FROM fin_periodos WHERE id = ?', [periodo_id]);
    if (!p || !p.length || Number(p[0].finca_id) !== fincaId) {
      return res.status(400).json({ error: 'El período no corresponde a la finca del concepto' });
    }

    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    if (p[0].estado === 'cerrado' && acc.rol !== 'propietario') {
      return res.status(403).json({ error: 'El período está cerrado' });
    }

    let semIdNorm = null;
    if (semana_id) {
      const s = await query('SELECT id FROM fin_semanas WHERE id = ? AND periodo_id = ?', [semana_id, periodo_id]);
      if (!s || !s.length) return res.status(400).json({ error: 'La semana no pertenece al período' });
      semIdNorm = Number(semana_id);
    }

    // Auditoría: editar un movimiento en un período YA cerrado es sensible.
    if (p[0].estado === 'cerrado') {
      await registrarAuditoria({
        usuarioId: req.user.id, fincaId, entidad: 'fin_movimiento', registroId: Number(concepto_id),
        accion: 'editar_cerrado', nuevo: { concepto_id, periodo_id, semana_id: semIdNorm, monto },
        descripcion: 'Edición de movimiento en período cerrado', ip: ipDe(req),
      });
    }

    // Buscar movimiento existente (mismo concepto, período y semana — o ambos sin semana).
    const existente = await query(
      `SELECT id FROM fin_movimientos
        WHERE concepto_id = ? AND periodo_id = ?
          AND (semana_id <=> ?)`,
      [concepto_id, periodo_id, semIdNorm]
    );

    if (existente && existente.length) {
      if (monto === 0 && (nota == null || nota === '')) {
        await query('DELETE FROM fin_movimientos WHERE id = ?', [existente[0].id]);
        return res.json({ ok: true, deleted: true });
      }
      await query(
        'UPDATE fin_movimientos SET monto = ?, nota = ?, registrado_por = ? WHERE id = ?',
        [monto, nota || null, req.user.id, existente[0].id]
      );
      return res.json({ ok: true, id: existente[0].id });
    }

    if (monto === 0 && (nota == null || nota === '')) return res.json({ ok: true });
    const result = await query(
      `INSERT INTO fin_movimientos (concepto_id, periodo_id, semana_id, monto, nota, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [concepto_id, periodo_id, semIdNorm, monto, nota || null, req.user.id]
    );
    res.status(201).json({ ok: true, id: Number(result.insertId) });
  } catch (err) {
    console.error('upsertMovimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conceptos (catálogo configurable)
// ─────────────────────────────────────────────────────────────────────────────
const TIPOS = ['ingreso', 'gasto_fijo', 'gasto_variable', 'factura', 'nomina'];
const PERIODICIDADES = ['semanal', 'mensual', 'bimensual'];

async function crearConcepto(req, res) {
  try {
    const fincaId = Number(req.body.finca_id);
    const { nombre, tipo } = req.body;
    const periodicidad = req.body.periodicidad || 'semanal';
    if (!fincaId || !nombre || !tipo) {
      return res.status(400).json({ error: 'finca_id, nombre y tipo son obligatorios' });
    }
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    if (!PERIODICIDADES.includes(periodicidad)) return res.status(400).json({ error: 'periodicidad inválida' });

    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const max = await query(
      'SELECT COALESCE(MAX(orden), 0) AS m FROM fin_conceptos WHERE finca_id = ? AND tipo = ?',
      [fincaId, tipo]
    );
    const orden = Number((max && max[0] && max[0].m) || 0) + 1;
    const result = await query(
      'INSERT INTO fin_conceptos (finca_id, nombre, tipo, periodicidad, orden) VALUES (?, ?, ?, ?, ?)',
      [fincaId, String(nombre).trim(), tipo, periodicidad, orden]
    );
    const rows = await query('SELECT * FROM fin_conceptos WHERE id = ?', [Number(result.insertId)]);
    res.status(201).json({ concepto: rows[0] });
  } catch (err) {
    console.error('crearConcepto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function actualizarConcepto(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT finca_id FROM fin_conceptos WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Concepto no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const sets = [];
    const params = [];
    if (req.body.nombre !== undefined) { sets.push('nombre = ?'); params.push(String(req.body.nombre).trim()); }
    if (req.body.periodicidad !== undefined) {
      if (!PERIODICIDADES.includes(req.body.periodicidad)) return res.status(400).json({ error: 'periodicidad inválida' });
      sets.push('periodicidad = ?'); params.push(req.body.periodicidad);
    }
    if (req.body.orden !== undefined) { sets.push('orden = ?'); params.push(Number(req.body.orden) || 0); }
    if (req.body.activo !== undefined) { sets.push('activo = ?'); params.push(req.body.activo ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    await query(`UPDATE fin_conceptos SET ${sets.join(', ')} WHERE id = ?`, params);
    const out = await query('SELECT * FROM fin_conceptos WHERE id = ?', [id]);
    res.json({ concepto: out[0] });
  } catch (err) {
    console.error('actualizarConcepto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Borrado suave: se desactiva para no perder histórico de movimientos.
async function eliminarConcepto(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT finca_id FROM fin_conceptos WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Concepto no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    await query('UPDATE fin_conceptos SET activo = 0 WHERE id = ?', [id]);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(rows[0].finca_id), entidad: 'fin_concepto', registroId: id,
      accion: 'eliminar', descripcion: 'Concepto financiero desactivado', ip: ipDe(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('eliminarConcepto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cierre / reapertura de período (solo propietario)
// ─────────────────────────────────────────────────────────────────────────────
async function cambiarEstadoPeriodo(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT finca_id, estado FROM fin_periodos WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Período no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const nuevo = req.body.estado;
    if (!['abierto', 'cerrado'].includes(nuevo)) return res.status(400).json({ error: 'estado inválido' });
    if (nuevo === 'cerrado') {
      await query('UPDATE fin_periodos SET estado = ?, cerrado_at = NOW(), cerrado_por = ? WHERE id = ?',
        ['cerrado', req.user.id, id]);
    } else {
      await query('UPDATE fin_periodos SET estado = ?, cerrado_at = NULL, cerrado_por = NULL WHERE id = ?',
        ['abierto', id]);
    }
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(rows[0].finca_id), entidad: 'fin_periodo', registroId: id,
      accion: nuevo === 'cerrado' ? 'cerrar' : 'reabrir',
      anterior: { estado: rows[0].estado }, nuevo: { estado: nuevo },
      descripcion: `Período ${nuevo === 'cerrado' ? 'cerrado' : 'reabierto'}`, ip: ipDe(req),
    });
    res.json({ ok: true, estado: nuevo });
  } catch (err) {
    console.error('cambiarEstadoPeriodo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /finanzas/periodos/:id/precio-venta { precio_venta_kilo, precio_venta_kilo_cereza }
// Precios de venta del mes — cambian mes a mes, a diferencia de
// meta_kg_semanal que vive en la finca y no cambia. precio_venta_kilo es
// café procesado; precio_venta_kilo_cereza es café recién recogido, sin
// beneficio. Cualquiera de los dos, o ambos, en el mismo body.
async function actualizarPrecioVenta(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT finca_id FROM fin_periodos WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Período no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const normalizar = (valor) => (valor === '' || valor === null || valor === undefined ? null : Number(valor));
    const sets = [];
    const params = [];
    const resultado = {};

    if (req.body.precio_venta_kilo !== undefined) {
      const precio = normalizar(req.body.precio_venta_kilo);
      if (precio !== null && (Number.isNaN(precio) || precio < 0)) {
        return res.status(400).json({ error: 'precio_venta_kilo inválido' });
      }
      sets.push('precio_venta_kilo = ?'); params.push(precio);
      resultado.precio_venta_kilo = precio;
    }
    if (req.body.precio_venta_kilo_cereza !== undefined) {
      const precioCereza = normalizar(req.body.precio_venta_kilo_cereza);
      if (precioCereza !== null && (Number.isNaN(precioCereza) || precioCereza < 0)) {
        return res.status(400).json({ error: 'precio_venta_kilo_cereza inválido' });
      }
      sets.push('precio_venta_kilo_cereza = ?'); params.push(precioCereza);
      resultado.precio_venta_kilo_cereza = precioCereza;
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(id);
    await query(`UPDATE fin_periodos SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('actualizarPrecioVenta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Helper: resuelve finca_id + estado del período a partir de un movimiento.
async function fincaDeMovimiento(movimientoId) {
  const rows = await query(
    `SELECT m.id, p.finca_id, p.estado
       FROM fin_movimientos m
       JOIN fin_periodos p ON p.id = m.periodo_id
      WHERE m.id = ?`,
    [movimientoId]
  );
  return rows && rows[0] ? rows[0] : null;
}

// POST /finanzas/movimientos/:movimientoId/foto (multipart, campo `foto`)
// Solo actualiza un movimiento YA existente (creado antes vía upsertMovimiento).
async function subirFotoMovimiento(req, res) {
  try {
    const movimientoId = Number(req.params.movimientoId);
    const mov = await fincaDeMovimiento(movimientoId);
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    const acc = await accesoFinca(Number(mov.finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    if (mov.estado === 'cerrado' && acc.rol !== 'propietario') {
      return res.status(403).json({ error: 'El período está cerrado' });
    }
    if (!req.file) return res.status(400).json({ error: 'La foto es obligatoria' });

    const fotoUrl = req.file.location;
    await query('UPDATE fin_movimientos SET foto_url = ? WHERE id = ?', [fotoUrl, movimientoId]);
    res.status(201).json({ foto_url: await signUrl(fotoUrl) });
  } catch (err) {
    console.error('subirFotoMovimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /finanzas/movimientos/:movimientoId/foto
async function eliminarFotoMovimiento(req, res) {
  try {
    const movimientoId = Number(req.params.movimientoId);
    const mov = await fincaDeMovimiento(movimientoId);
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    const acc = await accesoFinca(Number(mov.finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    if (mov.estado === 'cerrado' && acc.rol !== 'propietario') {
      return res.status(403).json({ error: 'El período está cerrado' });
    }

    const rows = await query('SELECT foto_url FROM fin_movimientos WHERE id = ?', [movimientoId]);
    const fotoActual = rows && rows[0] && rows[0].foto_url;
    await query('UPDATE fin_movimientos SET foto_url = NULL WHERE id = ?', [movimientoId]);
    if (fotoActual) await deleteFromS3(fotoActual);
    res.json({ message: 'Foto eliminada' });
  } catch (err) {
    console.error('eliminarFotoMovimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /finanzas/periodos/:periodoId/precio-venta-cultivo { cultivo, precio_venta_kilo }
// Upsert por (periodo_id, cultivo). Café sigue viviendo en
// fin_periodos.precio_venta_kilo — esto es para el resto de cultivos.
async function actualizarPrecioVentaCultivo(req, res) {
  try {
    const periodoId = Number(req.params.periodoId);
    const { cultivo } = req.body;
    if (!cultivo || !String(cultivo).trim()) {
      return res.status(400).json({ error: 'cultivo es obligatorio' });
    }
    const rows = await query('SELECT finca_id FROM fin_periodos WHERE id = ?', [periodoId]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Período no encontrado' });
    const fincaId = Number(rows[0].finca_id);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const valor = req.body.precio_venta_kilo;
    const precio = valor === '' || valor === null || valor === undefined ? null : Number(valor);
    if (precio !== null && (Number.isNaN(precio) || precio < 0)) {
      return res.status(400).json({ error: 'precio_venta_kilo inválido' });
    }
    const cultivoNorm = String(cultivo).trim();

    await query(
      `INSERT INTO finanzas_precio_venta_cultivo (finca_id, periodo_id, cultivo, precio_venta_kilo)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE precio_venta_kilo = VALUES(precio_venta_kilo)`,
      [fincaId, periodoId, cultivoNorm, precio]
    );
    res.json({ ok: true, cultivo: cultivoNorm, precio_venta_kilo: precio });
  } catch (err) {
    console.error('actualizarPrecioVentaCultivo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /finanzas/periodos/:periodoId/precios-venta-cultivo
async function listarPreciosVentaCultivo(req, res) {
  try {
    const periodoId = Number(req.params.periodoId);
    const rows = await query('SELECT finca_id FROM fin_periodos WHERE id = ?', [periodoId]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Período no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const precios = await query(
      'SELECT cultivo, precio_venta_kilo FROM finanzas_precio_venta_cultivo WHERE periodo_id = ? ORDER BY cultivo ASC',
      [periodoId]
    );
    res.json(precios || []);
  } catch (err) {
    console.error('listarPreciosVentaCultivo:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  genSemanas,
  ensurePeriodo,
  tablero,
  upsertMovimiento,
  crearConcepto,
  actualizarConcepto,
  eliminarConcepto,
  cambiarEstadoPeriodo,
  actualizarPrecioVenta,
  subirFotoMovimiento,
  eliminarFotoMovimiento,
  actualizarPrecioVentaCultivo,
  listarPreciosVentaCultivo,
};
