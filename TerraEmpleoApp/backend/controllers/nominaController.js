const { query } = require('../config/database');
const { obtenerFincasUsuario, accesoFinca } = require('./fincaController');

// Mismos roles que pueden escribir en el Cuaderno (cuadernoController.js) —
// el 'contador' queda de solo lectura también para nómina.
const CUADERNO_ESCRITORES = ['propietario', 'administrador', 'auxiliar'];

async function fincaIdsDeUsuario(usuarioId, rol) {
  const fincas = await obtenerFincasUsuario(usuarioId, rol);
  const ids = fincas.map((f) => Number(f.id));
  return ids.length ? ids : [0];
}

async function permisoJornadaResuelta(fincaId, creadorId, usuarioId, { escribir = false } = {}) {
  if (!fincaId) {
    if (Number(creadorId) !== Number(usuarioId)) {
      return { ok: false, status: 403, error: 'No tienes acceso a esta jornada' };
    }
    return { ok: true };
  }
  return accesoFinca(fincaId, usuarioId, { escribir, escritores: CUADERNO_ESCRITORES });
}

// Resuelve la finca "principal" del usuario logueado (dueña o capataz) para
// operaciones que no cuelgan de una jornada/asistencia puntual, como la nota
// de nómina. Con escritura=true solo cuenta si su rol_finca puede escribir.
async function resolverFincaUsuario(usuarioId, rol, { escribir = false } = {}) {
  const fincas = await obtenerFincasUsuario(usuarioId, rol);
  if (!fincas.length) return null;
  if (!escribir) return Number(fincas[0].id);
  const f = fincas.find((x) => CUADERNO_ESCRITORES.includes(x.rol_finca));
  return f ? Number(f.id) : null;
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTA_MAX_LEN = 2000;

const TIPOS_AJUSTE = ['bonificacion', 'descuento', 'anticipo', 'labor_extra'];
// Signo con que cada ajuste afecta el neto a pagar.
const SIGNO = { bonificacion: 1, labor_extra: 1, descuento: -1, anticipo: -1 };

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

// Semana actual (lunes..domingo) en UTC, como respaldo si no envían rango.
function semanaActual() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dow = d.getUTCDay(); // 0=Dom..6=Sab
  const diffLunes = (dow === 0 ? -6 : 1 - dow);
  const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() + diffLunes);
  const domingo = new Date(lunes); domingo.setUTCDate(lunes.getUTCDate() + 6);
  return { desde: ymd(lunes), hasta: ymd(domingo) };
}

// Verifica que la asistencia pertenezca a una jornada de la finca del usuario
// (dueña o capataz), no solo a quien la creó — ver cuadernoController.js.
async function asegurarAsistencia(asisId, usuarioId, opts = {}) {
  const rows = await query(
    `SELECT a.id, a.jornada_id, j.empleador_id, j.finca_id
       FROM cuaderno_asistencias a
       JOIN cuaderno_jornadas j ON j.id = a.jornada_id
      WHERE a.id = ?`,
    [asisId]
  );
  const a = rows && rows[0];
  if (!a) return { ok: false, status: 404, error: 'Asistencia no encontrada' };
  const acc = await permisoJornadaResuelta(a.finca_id, a.empleador_id, usuarioId, opts);
  if (!acc.ok) return acc;
  return { ok: true, jornadaId: Number(a.jornada_id) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ajustes (bonificación, descuento, anticipo, labor_extra)
// ─────────────────────────────────────────────────────────────────────────────
async function agregarAjuste(req, res) {
  try {
    const asisId = Number(req.params.asisId);
    const guard = await asegurarAsistencia(asisId, req.user.id, { escribir: true });
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });

    const { tipo, motivo } = req.body;
    const monto = Math.abs(Number(req.body.monto) || 0);
    if (!TIPOS_AJUSTE.includes(tipo)) return res.status(400).json({ error: 'Tipo de ajuste inválido' });
    if (monto <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

    const result = await query(
      'INSERT INTO cuaderno_ajustes (asistencia_id, jornada_id, tipo, monto, motivo) VALUES (?, ?, ?, ?, ?)',
      [asisId, guard.jornadaId, tipo, monto, motivo || null]
    );
    res.status(201).json({ message: 'Ajuste agregado', id: Number(result.insertId) });
  } catch (err) {
    console.error('agregarAjuste:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarAjuste(req, res) {
  try {
    const id = Number(req.params.id);
    const rows = await query(
      `SELECT aj.id, j.empleador_id, j.finca_id
         FROM cuaderno_ajustes aj
         JOIN cuaderno_jornadas j ON j.id = aj.jornada_id
        WHERE aj.id = ?`,
      [id]
    );
    const aj = rows && rows[0];
    if (!aj) return res.status(404).json({ error: 'Ajuste no encontrado' });
    const acc = await permisoJornadaResuelta(aj.finca_id, aj.empleador_id, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    await query('DELETE FROM cuaderno_ajustes WHERE id = ?', [id]);
    res.json({ message: 'Ajuste eliminado' });
  } catch (err) {
    console.error('eliminarAjuste:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Firma de recibido (a nivel de asistencia)
// ─────────────────────────────────────────────────────────────────────────────
async function marcarFirma(req, res) {
  try {
    const asisId = Number(req.params.asisId);
    const guard = await asegurarAsistencia(asisId, req.user.id, { escribir: true });
    if (!guard.ok) return res.status(guard.status).json({ error: guard.error });
    const firmado = req.body.firmado ? 1 : 0;
    await query(
      `UPDATE cuaderno_asistencias
          SET firma_recibido = ?, firmado_at = ${firmado ? 'CURRENT_TIMESTAMP' : 'NULL'}
        WHERE id = ?`,
      [firmado, asisId]
    );
    res.json({ message: 'Firma actualizada', firmado: !!firmado });
  } catch (err) {
    console.error('marcarFirma:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Planilla semanal: agrega por trabajador en un rango de fechas.
// GET /cuaderno/nomina?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
async function planilla(req, res) {
  try {
    const usuarioId = req.user.id;
    const fincaIds = await fincaIdsDeUsuario(usuarioId, req.user.rol);
    const def = semanaActual();
    const desde = req.query.desde || def.desde;
    const hasta = req.query.hasta || def.hasta;

    // Asistencias del rango (con su registro de pago y datos del trabajador).
    const asistencias = await query(
      `SELECT a.id AS asistencia_id, a.trabajador_id, a.manual_nombre, a.estado,
              a.firma_recibido, j.id AS jornada_id, j.fecha, j.titulo AS jornada_titulo,
              u.nombre_completo, u.foto_selfie,
              r.cantidad_kg, r.pago_total, r.tipo_pago, r.pagado, r.notas AS registro_notas
         FROM cuaderno_asistencias a
         JOIN cuaderno_jornadas j ON j.id = a.jornada_id
         LEFT JOIN usuarios u ON u.id = a.trabajador_id
         LEFT JOIN cuaderno_registros_trabajo r ON r.asistencia_id = a.id
        WHERE (j.finca_id IN (?) OR (j.finca_id IS NULL AND j.empleador_id = ?)) AND j.fecha BETWEEN ? AND ?
        ORDER BY j.fecha ASC, a.id ASC`,
      [fincaIds, usuarioId, desde, hasta]
    );

    // Ajustes del rango.
    const ajustes = await query(
      `SELECT aj.id, aj.asistencia_id, aj.tipo, aj.monto, aj.motivo
         FROM cuaderno_ajustes aj
         JOIN cuaderno_asistencias a ON a.id = aj.asistencia_id
         JOIN cuaderno_jornadas j ON j.id = a.jornada_id
        WHERE (j.finca_id IN (?) OR (j.finca_id IS NULL AND j.empleador_id = ?)) AND j.fecha BETWEEN ? AND ?`,
      [fincaIds, usuarioId, desde, hasta]
    );
    const ajustesPorAsis = {};
    for (const x of ajustes || []) (ajustesPorAsis[x.asistencia_id] ||= []).push(x);

    // Agregar por trabajador (clave: usuario id o nombre manual).
    const mapa = new Map();
    for (const a of asistencias || []) {
      const key = a.trabajador_id ? `u:${a.trabajador_id}` : `m:${(a.manual_nombre || 'Sin nombre').toLowerCase()}`;
      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          trabajador_id: a.trabajador_id || null,
          nombre: a.nombre_completo || a.manual_nombre || 'Sin nombre',
          foto: a.foto_selfie || null,
          total_kg: 0, dias: 0, base: 0,
          bonificacion: 0, labor_extra: 0, descuento: 0, anticipo: 0,
          ajustes: [],
          asistencias: [],
          _lastFecha: '',
          ajuste_target_asistencia_id: null,
          firmado: false,
          pagado_all: true, pagado_any: false,
        });
      }
      const f = mapa.get(key);
      f.total_kg += Number(a.cantidad_kg) || 0;
      if (['llego', 'llego_tarde'].includes(a.estado)) f.dias += 1;
      f.base += Number(a.pago_total) || 0;
      f.asistencias.push({ asistencia_id: a.asistencia_id, fecha: a.fecha, jornada_titulo: a.jornada_titulo });

      // El ajuste/firma se ancla a la asistencia más reciente del trabajador.
      if (!f._lastFecha || String(a.fecha) >= f._lastFecha) {
        f._lastFecha = String(a.fecha);
        f.ajuste_target_asistencia_id = a.asistencia_id;
        f.firmado = !!a.firma_recibido;
      }
      if (a.pago_total != null) {
        if (a.pagado) f.pagado_any = true; else f.pagado_all = false;
      }

      for (const aj of ajustesPorAsis[a.asistencia_id] || []) {
        f[aj.tipo] += Number(aj.monto) || 0;
        f.ajustes.push({ id: aj.id, tipo: aj.tipo, monto: Number(aj.monto) || 0, motivo: aj.motivo, fecha: a.fecha });
      }
    }

    const filas = [...mapa.values()].map((f) => {
      const neto = f.base + f.bonificacion + f.labor_extra - f.descuento - f.anticipo;
      const { _lastFecha, ...rest } = f;
      return { ...rest, neto, pagado: f.pagado_any && f.pagado_all };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));

    const totales = filas.reduce((t, f) => ({
      kg: t.kg + f.total_kg,
      base: t.base + f.base,
      bonificacion: t.bonificacion + f.bonificacion,
      labor_extra: t.labor_extra + f.labor_extra,
      descuento: t.descuento + f.descuento,
      anticipo: t.anticipo + f.anticipo,
      neto: t.neto + f.neto,
    }), { kg: 0, base: 0, bonificacion: 0, labor_extra: 0, descuento: 0, anticipo: 0, neto: 0 });

    res.json({ desde, hasta, filas, totales });
  } catch (err) {
    console.error('planilla:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Nota libre de nómina por semana (no de un trabajador en particular).
// GET/PUT /cuaderno/nomina/nota?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────────────────
async function obtenerNotaNomina(req, res) {
  try {
    const usuarioId = req.user.id;
    const { desde } = req.query;
    if (!desde || !FECHA_RE.test(desde)) {
      return res.status(400).json({ error: 'desde es obligatorio (YYYY-MM-DD)' });
    }

    const fincaId = await resolverFincaUsuario(usuarioId, req.user.rol);
    if (!fincaId) return res.status(403).json({ error: 'No tienes acceso a ninguna finca' });

    const rows = await query(
      'SELECT nota FROM nomina_notas WHERE finca_id = ? AND semana_inicio = ?',
      [fincaId, desde]
    );
    res.json({ nota: (rows && rows[0] && rows[0].nota) || '' });
  } catch (err) {
    console.error('obtenerNotaNomina:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function guardarNotaNomina(req, res) {
  try {
    const usuarioId = req.user.id;
    const { desde, hasta } = req.body;
    const nota = req.body.nota != null ? String(req.body.nota) : '';

    if (!desde || !FECHA_RE.test(desde)) {
      return res.status(400).json({ error: 'desde es obligatorio (YYYY-MM-DD)' });
    }
    if (hasta !== undefined && hasta !== null && !FECHA_RE.test(hasta)) {
      return res.status(400).json({ error: 'hasta debe tener formato YYYY-MM-DD' });
    }
    if (nota.length > NOTA_MAX_LEN) {
      return res.status(400).json({ error: `La nota no puede superar ${NOTA_MAX_LEN} caracteres` });
    }

    const fincaId = await resolverFincaUsuario(usuarioId, req.user.rol, { escribir: true });
    if (!fincaId) return res.status(403).json({ error: 'Tu rol en la finca es de solo lectura' });

    await query(
      `INSERT INTO nomina_notas (finca_id, semana_inicio, semana_fin, nota, actualizado_por)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE semana_fin = VALUES(semana_fin), nota = VALUES(nota), actualizado_por = VALUES(actualizado_por)`,
      [fincaId, desde, hasta || null, nota, usuarioId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('guardarNotaNomina:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  agregarAjuste, eliminarAjuste, marcarFirma, planilla,
  obtenerNotaNomina, guardarNotaNomina,
};
