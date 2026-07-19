const { query } = require('../config/database');
const { accesoFinca } = require('./fincaController');

const TIPOS = ['aporte', 'retiro', 'otro_ingreso', 'otro_egreso'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const signo = (tipo) => (tipo === 'aporte' || tipo === 'otro_ingreso' ? 1 : -1);

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

    const porTipo = await query(
      `SELECT c.tipo, COALESCE(SUM(m.monto), 0) AS total
         FROM fin_movimientos m
         JOIN fin_conceptos c ON c.id = m.concepto_id
         JOIN fin_periodos p ON p.id = m.periodo_id
        WHERE p.finca_id = ? ${whereRango}
        GROUP BY c.tipo`,
      paramsPeriodo
    );
    const totalesFin = { ingreso: 0, gasto_fijo: 0, gasto_variable: 0, factura: 0 };
    for (const r of porTipo || []) totalesFin[r.tipo] = Number(r.total) || 0;
    const ventas = totalesFin.ingreso;
    const gastosFinanzas = totalesFin.gasto_fijo + totalesFin.gasto_variable + totalesFin.factura;

    // Nómina real: se lee del Cuaderno (jornadas de esta finca), no de Finanzas.
    const condNomina = ['(j.finca_id = ? OR (j.finca_id IS NULL AND j.empleador_id = ?))'];
    const paramsNomina = [finca.id, finca.empleador_id];
    if (desde) { condNomina.push('j.fecha >= ?'); paramsNomina.push(desde); }
    if (hasta) { condNomina.push('j.fecha <= ?'); paramsNomina.push(hasta); }
    const nomRows = await query(
      `SELECT COALESCE(SUM(r.pago_total), 0) AS total
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE ${condNomina.join(' AND ')}`,
      paramsNomina
    );
    const nomina = Number((nomRows && nomRows[0] && nomRows[0].total) || 0);

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

    // Saldo base = todo lo de Finanzas/Cuaderno (ventas y aportes suman,
    // nómina y gastos restan), sobre el que se acumulan los movimientos
    // manuales en orden cronológico para el historial con saldo corriente.
    const saldoBase = ventas - nomina - gastosFinanzas;
    let corriendo = saldoBase;
    const historialAsc = (movimientos || []).map((m) => {
      const montoFirmado = round2(signo(m.tipo) * (Number(m.monto) || 0));
      corriendo = round2(corriendo + montoFirmado);
      return {
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        categoria: m.categoria,
        descripcion: m.descripcion,
        monto: montoFirmado,
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
    const rows = await query('SELECT * FROM finca_balance_movimientos WHERE id = ?', [Number(result.insertId)]);
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
