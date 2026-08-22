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

// Gasto/ingreso del período agrupado por lote_id y por cultivo — para la
// tarjeta "Gasto e ingreso por lote y cultivo" de Nota rápida, sin que el
// frontend tenga que sumarlo a mano en meses con muchos movimientos.
async function calcularAnalisisLoteCultivo(periodo) {
  const porLote = await query(
    `SELECT m.lote_id, l.nombre AS lote_nombre,
            COALESCE(SUM(CASE WHEN c.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingreso,
            COALESCE(SUM(CASE WHEN c.tipo <> 'ingreso' THEN m.monto ELSE 0 END), 0) AS gasto
       FROM fin_movimientos m
       JOIN fin_conceptos c ON c.id = m.concepto_id
       LEFT JOIN finca_lotes l ON l.id = m.lote_id
      WHERE m.periodo_id = ? AND m.lote_id IS NOT NULL
      GROUP BY m.lote_id, l.nombre
      ORDER BY l.nombre ASC`,
    [periodo.id]
  );
  const porCultivo = await query(
    `SELECT m.cultivo,
            COALESCE(SUM(CASE WHEN c.tipo = 'ingreso' THEN m.monto ELSE 0 END), 0) AS ingreso,
            COALESCE(SUM(CASE WHEN c.tipo <> 'ingreso' THEN m.monto ELSE 0 END), 0) AS gasto
       FROM fin_movimientos m
       JOIN fin_conceptos c ON c.id = m.concepto_id
      WHERE m.periodo_id = ? AND m.cultivo IS NOT NULL AND m.cultivo <> ''
      GROUP BY m.cultivo
      ORDER BY m.cultivo ASC`,
    [periodo.id]
  );
  return {
    por_lote: (porLote || []).map((r) => ({
      lote_id: Number(r.lote_id),
      lote_nombre: r.lote_nombre || null,
      ingreso: Number(r.ingreso) || 0,
      gasto: Number(r.gasto) || 0,
    })),
    por_cultivo: (porCultivo || []).map((r) => ({
      cultivo: r.cultivo,
      ingreso: Number(r.ingreso) || 0,
      gasto: Number(r.gasto) || 0,
    })),
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
    const analisis_lote_cultivo = await calcularAnalisisLoteCultivo(periodo);

    res.json({
      finca,
      rol_finca: acc.rol,
      periodo,
      semanas: semanas || [],
      conceptos: conceptos || [],
      movimientos: movimientos || [],
      resumen,
      analisis_lote_cultivo,
    });
  } catch (err) {
    console.error('tablero:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Movimientos (upsert por concepto + semana/período)
// PUT /finanzas/movimientos  { concepto_id, periodo_id, semana_id|null, monto, nota,
//                               lote_id|null, cultivo|null }
// lote_id/cultivo son opcionales y "parciales": si la llave no viene en el
// body, el valor ya guardado se conserva; solo se limpia si viene null
// explícito. Le dan a cada movimiento (gasto/ingreso) del Cuaderno una
// etiqueta de lote de finca (finca_lotes, NO cafe_lotes) y/o cultivo (texto
// libre, igual que finca_lotes.cultivo) para el análisis "Gasto e ingreso
// por lote y cultivo" de Nota rápida.
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

    // lote_id/cultivo: "ausente" (llave no viene en el body) conserva el
    // valor ya guardado; null explícito lo limpia.
    const tieneLote = Object.prototype.hasOwnProperty.call(req.body, 'lote_id');
    const tieneCultivo = Object.prototype.hasOwnProperty.call(req.body, 'cultivo');
    let loteIdNorm = null;
    if (tieneLote && req.body.lote_id !== null) {
      loteIdNorm = Number(req.body.lote_id) || null;
      if (loteIdNorm) {
        const l = await query('SELECT id FROM finca_lotes WHERE id = ? AND finca_id = ?', [loteIdNorm, fincaId]);
        if (!l || !l.length) return res.status(400).json({ error: 'El lote no pertenece a esta finca' });
      }
    }
    const cultivoNorm = tieneCultivo && req.body.cultivo !== null
      ? (String(req.body.cultivo).trim() || null)
      : null;

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
      const sets = ['monto = ?', 'nota = ?', 'registrado_por = ?'];
      const vals = [monto, nota || null, req.user.id];
      if (tieneLote) { sets.push('lote_id = ?'); vals.push(loteIdNorm); }
      if (tieneCultivo) { sets.push('cultivo = ?'); vals.push(cultivoNorm); }
      vals.push(existente[0].id);
      await query(`UPDATE fin_movimientos SET ${sets.join(', ')} WHERE id = ?`, vals);
      return res.json({ ok: true, id: existente[0].id });
    }

    if (monto === 0 && (nota == null || nota === '')) return res.json({ ok: true });
    const result = await query(
      `INSERT INTO fin_movimientos (concepto_id, periodo_id, semana_id, monto, nota, registrado_por, lote_id, cultivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [concepto_id, periodo_id, semIdNorm, monto, nota || null, req.user.id, loteIdNorm, cultivoNorm]
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

// El concepto se desactiva (no se borra la fila, para no romper el FK de
// fin_movimientos ni el historial de auditoría) PERO sus movimientos SÍ se
// borran de verdad, de todos los períodos/semanas — no solo el mes visible
// en el tablero. Si solo se desactivara el concepto, montos de meses
// anteriores seguirían sumando en Balance (acumulado de toda la vida de la
// finca: ingresos_totales/egresos_totales/saldo_actual e historial), aunque
// el concepto ya no aparezca en Finanzas. Esto es irreversible — coincide
// con el aviso "no se puede deshacer" del modal de confirmación del cliente.
async function eliminarConcepto(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT finca_id FROM fin_conceptos WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Concepto no encontrado' });
    const acc = await accesoFinca(Number(rows[0].finca_id), req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const movimientos = await query('SELECT id, monto, foto_url FROM fin_movimientos WHERE concepto_id = ?', [id]);
    for (const m of movimientos || []) {
      if (m.foto_url) await deleteFromS3(m.foto_url).catch((e) => console.warn('eliminarConcepto: foto S3:', e.message));
    }
    await query('DELETE FROM fin_movimientos WHERE concepto_id = ?', [id]);
    await query('UPDATE fin_conceptos SET activo = 0 WHERE id = ?', [id]);

    const montoTotal = (movimientos || []).reduce((s, m) => s + (Number(m.monto) || 0), 0);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId: Number(rows[0].finca_id), entidad: 'fin_concepto', registroId: id,
      accion: 'eliminar',
      anterior: { movimientos_eliminados: (movimientos || []).length, monto_total_eliminado: montoTotal },
      descripcion: 'Concepto financiero desactivado y sus movimientos borrados de todos los períodos (irreversible)',
      ip: ipDe(req),
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
    if (req.body.precio_venta_arroba !== undefined) {
      const precioArroba = normalizar(req.body.precio_venta_arroba);
      if (precioArroba !== null && (Number.isNaN(precioArroba) || precioArroba < 0)) {
        return res.status(400).json({ error: 'precio_venta_arroba inválido' });
      }
      sets.push('precio_venta_arroba = ?'); params.push(precioArroba);
      resultado.precio_venta_arroba = precioArroba;
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

// ─────────────────────────────────────────────────────────────────────────────
// Resumen por rango de fechas (para el Balance discriminado: mensual,
// trimestral, semestral o anual). Solo lectura — NO crea períodos.
// GET /finanzas/resumen-rango?finca_id=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
async function resumenRango(req, res) {
  try {
    const fincaId = Number(req.query.finca_id);
    const { desde, hasta } = req.query;
    if (!fincaId) return res.status(400).json({ error: 'finca_id es obligatorio' });
    if (!desde || !hasta) return res.status(400).json({ error: 'desde y hasta son obligatorios (YYYY-MM-DD)' });
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const fincaRows = await query('SELECT id, empleador_id FROM fincas WHERE id = ?', [fincaId]);
    const finca = fincaRows && fincaRows[0];
    if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

    // Total por concepto en el rango. Se usa la semana (o el período para
    // facturas mensuales) para ubicar cada movimiento en el tiempo.
    const porConcepto = await query(
      `SELECT c.id, c.nombre, c.tipo, COALESCE(SUM(m.monto), 0) AS total
         FROM fin_movimientos m
         JOIN fin_conceptos c ON c.id = m.concepto_id
         JOIN fin_periodos p ON p.id = m.periodo_id
         LEFT JOIN fin_semanas s ON s.id = m.semana_id
        WHERE p.finca_id = ?
          AND COALESCE(s.fecha_inicio, p.fecha_inicio) <= ?
          AND COALESCE(s.fecha_fin, p.fecha_fin) >= ?
        GROUP BY c.id, c.nombre, c.tipo
       HAVING total <> 0
        ORDER BY c.tipo, total DESC`,
      [fincaId, hasta, desde]
    );

    // Nómina real del Cuaderno en el rango (jornadas de la finca).
    const nomRows = await query(
      `SELECT COALESCE(SUM(r.pago_total), 0) AS total
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE (j.finca_id = ? OR (j.finca_id IS NULL AND j.empleador_id = ?))
          AND j.fecha BETWEEN ? AND ?`,
      [finca.id, finca.empleador_id, desde, hasta]
    );

    const conceptos = (porConcepto || []).map((c) => ({
      id: Number(c.id), nombre: c.nombre, tipo: c.tipo, total: Number(c.total) || 0,
    }));
    const totalTipo = (tipo) => conceptos.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.total, 0);
    const nominaCuaderno = Number((nomRows && nomRows[0] && nomRows[0].total) || 0);
    const nominaManual = totalTipo('nomina');

    res.json({
      desde, hasta,
      conceptos,
      totales: {
        ventas: totalTipo('ingreso'),
        nomina_cuaderno: nominaCuaderno,
        nomina_manual: nominaManual,
        nomina: nominaCuaderno + nominaManual,
        gasto_fijo: totalTipo('gasto_fijo'),
        gasto_variable: totalTipo('gasto_variable'),
        factura: totalTipo('factura'),
      },
    });
  } catch (err) {
    console.error('resumenRango:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  genSemanas,
  ensurePeriodo,
  tablero,
  resumenRango,
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
