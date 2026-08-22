const { query } = require('../config/database');
const { accesoFinca } = require('./fincaController');
const { ensurePeriodo } = require('./finanzasController');

const TIPOS = ['aporte', 'retiro', 'otro_ingreso', 'otro_egreso'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const signo = (tipo) => (tipo === 'aporte' || tipo === 'otro_ingreso' ? 1 : -1);

// Los movimientos de capital (aporte/retiro) se reflejan también como su
// propia fila en Finanzas (Ingresos / Gastos variables), para que el dueño
// los vea en un solo lugar. 'otro_ingreso'/'otro_egreso' NO se conectan.
const TIPO_FIN_DE_BALANCE = { aporte: 'ingreso', retiro: 'gasto_variable' };

// Concepto de Finanzas para un movimiento de Balance: reutiliza uno ya
// creado desde Balance con el mismo nombre (origen='balance'); si no existe,
// lo crea. No reutiliza conceptos creados a mano por el dueño en Finanzas,
// para no mezclar históricos y así poder excluirlos limpio de los totales.
async function ensureConceptoBalance(fincaId, nombre, tipoFin) {
  const nombreNorm = String(nombre).trim();
  const existente = await query(
    `SELECT id FROM fin_conceptos WHERE finca_id = ? AND tipo = ? AND nombre = ? AND origen = 'balance' LIMIT 1`,
    [fincaId, tipoFin, nombreNorm]
  );
  if (existente && existente.length) return existente[0].id;

  const max = await query(
    'SELECT COALESCE(MAX(orden), 0) AS m FROM fin_conceptos WHERE finca_id = ? AND tipo = ?',
    [fincaId, tipoFin]
  );
  const orden = Number((max && max[0] && max[0].m) || 0) + 1;
  const result = await query(
    `INSERT INTO fin_conceptos (finca_id, nombre, tipo, periodicidad, orden, origen)
     VALUES (?, ?, ?, 'semanal', ?, 'balance')`,
    [fincaId, nombreNorm, tipoFin, orden]
  );
  return Number(result.insertId);
}

// Semana del período que contiene la fecha dada.
async function ensureSemana(periodoId, fecha) {
  const rows = await query(
    'SELECT id FROM fin_semanas WHERE periodo_id = ? AND ? BETWEEN fecha_inicio AND fecha_fin LIMIT 1',
    [periodoId, fecha]
  );
  return rows && rows.length ? Number(rows[0].id) : null;
}

// Suma `monto` al fin_movimientos de ese concepto+semana (mismo criterio de
// upsert que ya usa la Nota Rápida de Finanzas: concepto+periodo+semana).
async function sumarMovimientoFinanzas({ conceptoId, periodoId, semanaId, monto, fecha, nota, userId }) {
  const existente = await query(
    `SELECT id, monto FROM fin_movimientos WHERE concepto_id = ? AND periodo_id = ? AND (semana_id <=> ?)`,
    [conceptoId, periodoId, semanaId]
  );
  if (existente && existente.length) {
    const nuevoMonto = round2(Number(existente[0].monto) + monto);
    await query('UPDATE fin_movimientos SET monto = ? WHERE id = ?', [nuevoMonto, existente[0].id]);
    return existente[0].id;
  }
  const result = await query(
    `INSERT INTO fin_movimientos (concepto_id, periodo_id, semana_id, monto, fecha, nota, registrado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [conceptoId, periodoId, semanaId, monto, fecha, nota || null, userId]
  );
  return Number(result.insertId);
}

// Resta `monto` del fin_movimientos vinculado a un movimiento de Balance; si
// queda en 0 (o menos, por redondeo) se borra la fila.
async function restarMovimientoFinanzas({ conceptoId, periodoId, semanaId, monto }) {
  const existente = await query(
    `SELECT id, monto FROM fin_movimientos WHERE concepto_id = ? AND periodo_id = ? AND (semana_id <=> ?)`,
    [conceptoId, periodoId, semanaId]
  );
  if (!existente || !existente.length) return;
  const restante = round2(Number(existente[0].monto) - monto);
  if (restante <= 0) {
    await query('DELETE FROM fin_movimientos WHERE id = ?', [existente[0].id]);
  } else {
    await query('UPDATE fin_movimientos SET monto = ? WHERE id = ?', [restante, existente[0].id]);
  }
}

// Crea/actualiza la fila espejo en Finanzas para un movimiento de Balance
// recién insertado, y devuelve las referencias a guardar en la fila.
async function reflejarEnFinanzas({ fincaId, tipo, categoria, descripcion, monto, fecha, userId }) {
  const tipoFin = TIPO_FIN_DE_BALANCE[tipo];
  if (!tipoFin) return null;
  const [anioStr, mesStr] = String(fecha).split('-');
  const periodo = await ensurePeriodo(fincaId, Number(anioStr), Number(mesStr));
  const conceptoId = await ensureConceptoBalance(fincaId, categoria, tipoFin);
  const semanaId = await ensureSemana(periodo.id, fecha);
  await sumarMovimientoFinanzas({
    conceptoId, periodoId: periodo.id, semanaId, monto, fecha, nota: descripcion || categoria, userId,
  });
  return { fin_concepto_id: conceptoId, fin_periodo_id: periodo.id, fin_semana_id: semanaId };
}

// GET /finca/:id/balance?desde=&hasta=
// Combina lo YA registrado en Finanzas (ventas, gastos, nómina real del
// Cuaderno) — histórico completo, no solo el mes visible en el tablero —
// con los movimientos manuales de capital de esta tabla.
async function balance(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const fincaRows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    const finca = fincaRows && fincaRows[0];
    if (!finca) return res.status(404).json({ error: 'Finca no encontrada' });

    const { desde, hasta } = req.query;

    // Ventas/gastos: todos los períodos de Finanzas de esta finca, filtrados
    // por rango de fecha del período si se pidió (si no, todo el histórico).
    const condPeriodo = [];
    const paramsPeriodo = [fincaId];
    if (desde) { condPeriodo.push('p.fecha_fin >= ?'); paramsPeriodo.push(desde); }
    if (hasta) { condPeriodo.push('p.fecha_inicio <= ?'); paramsPeriodo.push(hasta); }
    const whereRango = condPeriodo.length ? `AND ${condPeriodo.join(' AND ')}` : '';

    // Línea a línea de Finanzas (ventas y gastos) — no solo el total: cada
    // fila se vuelve un renglón del historial. fin_movimientos.fecha casi
    // nunca está poblada (solo la usa el espejo de Balance), por eso la
    // fecha real sale de la semana (o del período si es mensual/factura).
    // Excluye los conceptos origen='balance' — esos montos ya se cuentan
    // aparte como aportes/retiros de finca_balance_movimientos más abajo;
    // sumarlos aquí también los contaría dos veces en el saldo. 'nomina'
    // (nómina manual/migrada de Finanzas) tampoco entra: el balance usa la
    // nómina REAL del Cuaderno, igual que ya hacía el total anterior.
    const finRows = await query(
      `SELECT m.id, m.concepto_id, m.monto, c.tipo, c.nombre AS concepto_nombre,
              COALESCE(s.fecha_inicio, p.fecha_inicio) AS fecha
         FROM fin_movimientos m
         JOIN fin_conceptos c ON c.id = m.concepto_id
         JOIN fin_periodos p ON p.id = m.periodo_id
         LEFT JOIN fin_semanas s ON s.id = m.semana_id
        WHERE p.finca_id = ? AND c.origen != 'balance'
          AND c.tipo IN ('ingreso','gasto_fijo','gasto_variable','factura') ${whereRango}
        ORDER BY fecha ASC, m.id ASC`,
      paramsPeriodo
    );

    // Nómina real, línea a línea: se lee del Cuaderno (jornadas de esta
    // finca), no de Finanzas — una fila por bloque de trabajo pagado.
    const condNomina = ['(j.finca_id = ? OR (j.finca_id IS NULL AND j.empleador_id = ?))'];
    const paramsNomina = [finca.id, finca.empleador_id];
    if (desde) { condNomina.push('j.fecha >= ?'); paramsNomina.push(desde); }
    if (hasta) { condNomina.push('j.fecha <= ?'); paramsNomina.push(hasta); }
    const nomRows = await query(
      `SELECT r.id, r.pago_total AS monto, j.fecha,
              COALESCE(u.nombre_completo, a.manual_nombre, 'Trabajador') AS nombre_trabajador
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
         LEFT JOIN cuaderno_asistencias a ON a.id = r.asistencia_id
         LEFT JOIN usuarios u ON u.id = a.trabajador_id
        WHERE ${condNomina.join(' AND ')}
        ORDER BY j.fecha ASC, r.id ASC`,
      paramsNomina
    );

    // Movimientos manuales (capital) en el rango.
    const condMov = ['finca_id = ?'];
    const paramsMov = [fincaId];
    if (desde) { condMov.push('fecha >= ?'); paramsMov.push(desde); }
    if (hasta) { condMov.push('fecha <= ?'); paramsMov.push(hasta); }
    const movimientos = await query(
      `SELECT * FROM finca_balance_movimientos WHERE ${condMov.join(' AND ')} ORDER BY fecha ASC, id ASC`,
      paramsMov
    );

    let aportes = 0;
    let retiros = 0;
    for (const m of movimientos || []) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === 'aporte' || m.tipo === 'otro_ingreso') aportes += monto;
      else retiros += monto;
    }

    const TIPO_LABEL_FIN = { ingreso: 'Venta', gasto_fijo: 'Gasto fijo', gasto_variable: 'Gasto variable', factura: 'Factura' };
    let ventas = 0;
    let gastosFinanzas = 0;
    let nomina = 0;

    // Se combinan las tres fuentes (manual + Finanzas + Cuaderno) en un solo
    // historial cronológico, cada una con su propio signo — así el saldo
    // corriente arranca en 0 y no hay que sumar aparte un "saldo base": los
    // totales de abajo salen de sumar estas mismas filas, para que nunca
    // puedan desalinearse del historial. Solo los movimientos manuales son
    // editables/eliminables desde acá (tipo dentro del enum de
    // finca_balance_movimientos) — Finanzas y Cuaderno se editan en su
    // propia pantalla, por eso llevan un `tipo` fuera de ese enum.
    const combinado = [
      ...(movimientos || []).map((m) => ({
        id: m.id, fecha: m.fecha, tipo: m.tipo, categoria: m.categoria, descripcion: m.descripcion,
        concepto_id: null,
        montoFirmado: signo(m.tipo) * (Number(m.monto) || 0),
      })),
      ...(finRows || []).map((r) => {
        const monto = Number(r.monto) || 0;
        if (r.tipo === 'ingreso') ventas += monto; else gastosFinanzas += monto;
        return {
          id: r.id, fecha: r.fecha, tipo: r.tipo, categoria: TIPO_LABEL_FIN[r.tipo] || r.tipo, descripcion: r.concepto_nombre,
          concepto_id: Number(r.concepto_id),
          montoFirmado: (r.tipo === 'ingreso' ? 1 : -1) * monto,
        };
      }),
      ...(nomRows || []).map((r) => {
        const monto = Number(r.monto) || 0;
        nomina += monto;
        return {
          id: r.id, fecha: r.fecha, tipo: 'nomina', categoria: 'Nómina', descripcion: r.nombre_trabajador,
          concepto_id: null,
          montoFirmado: -monto,
        };
      }),
    ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || a.id - b.id);

    let corriendo = 0;
    const historialAsc = combinado.map((h) => {
      corriendo = round2(corriendo + round2(h.montoFirmado));
      return {
        id: h.id,
        fecha: h.fecha,
        tipo: h.tipo,
        categoria: h.categoria,
        descripcion: h.descripcion,
        concepto_id: h.concepto_id,
        monto: round2(h.montoFirmado),
        saldo_despues: corriendo,
      };
    });
    const saldoActual = round2(corriendo);

    res.json({
      saldo_actual: saldoActual,
      ingresos_totales: { ventas: round2(ventas), aportes: round2(aportes) },
      egresos_totales: { nomina: round2(nomina), gastos: round2(gastosFinanzas), retiros: round2(retiros) },
      historial: historialAsc.slice().reverse(),
    });
  } catch (err) {
    console.error('balance:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /finca/:id/balance/movimientos { tipo, categoria, descripcion, monto, fecha }
async function crearMovimiento(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const { tipo, categoria, descripcion, monto, fecha } = req.body;
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
    if (!categoria || !String(categoria).trim()) return res.status(400).json({ error: 'La categoría es obligatoria' });
    if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria' });
    const montoNum = Number(monto);
    if (!montoNum || Number.isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const result = await query(
      `INSERT INTO finca_balance_movimientos (finca_id, fecha, tipo, categoria, descripcion, monto, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fincaId, fecha, tipo, String(categoria).trim(), descripcion || null, montoNum, req.user.id]
    );
    const movId = Number(result.insertId);

    const refs = await reflejarEnFinanzas({
      fincaId, tipo, categoria: String(categoria).trim(), descripcion, monto: montoNum, fecha, userId: req.user.id,
    }).catch((e) => { console.error('reflejarEnFinanzas:', e); return null; });
    if (refs) {
      await query(
        'UPDATE finca_balance_movimientos SET fin_concepto_id = ?, fin_periodo_id = ?, fin_semana_id = ? WHERE id = ?',
        [refs.fin_concepto_id, refs.fin_periodo_id, refs.fin_semana_id, movId]
      );
    }

    const rows = await query('SELECT * FROM finca_balance_movimientos WHERE id = ?', [movId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('crearMovimientoBalance:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /finca/:id/balance/movimientos/:movId
async function eliminarMovimiento(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const movId = Number(req.params.movId);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const rows = await query('SELECT * FROM finca_balance_movimientos WHERE id = ? AND finca_id = ?', [movId, fincaId]);
    const mov = rows && rows[0];
    if (mov && mov.fin_concepto_id) {
      await restarMovimientoFinanzas({
        conceptoId: mov.fin_concepto_id, periodoId: mov.fin_periodo_id, semanaId: mov.fin_semana_id,
        monto: Number(mov.monto) || 0,
      }).catch((e) => console.error('restarMovimientoFinanzas:', e));
    }

    await query('DELETE FROM finca_balance_movimientos WHERE id = ? AND finca_id = ?', [movId, fincaId]);
    res.json({ message: 'Movimiento eliminado' });
  } catch (err) {
    console.error('eliminarMovimientoBalance:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  balance,
  crearMovimiento,
  eliminarMovimiento,
};
