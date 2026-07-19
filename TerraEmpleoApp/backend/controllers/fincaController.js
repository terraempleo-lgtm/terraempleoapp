const bcrypt = require('bcryptjs');
const { query, getConnection } = require('../config/database');
const { registrarAuditoria, ipDe } = require('../helpers/auditoria');
const { normalizePhone } = require('../helpers/normalizePhone');

// ─────────────────────────────────────────────────────────────────────────────
// Conceptos semilla (tomados de la operación real del usuario)
// ─────────────────────────────────────────────────────────────────────────────
const CONCEPTOS_SEMILLA = [
  // tipo, nombre, periodicidad
  ['ingreso', 'Café', 'semanal'],
  ['ingreso', 'Plátano', 'semanal'],
  ['ingreso', 'Aguacate', 'semanal'],
  ['ingreso', 'Alimentaciones vendidas', 'semanal'],
  ['ingreso', 'Otros', 'semanal'],
  ['gasto_fijo', 'Mercado', 'semanal'],
  ['gasto_fijo', 'Carne', 'semanal'],
  ['gasto_fijo', 'Verduras', 'semanal'],
  ['gasto_fijo', 'Gasolina', 'semanal'],
  ['gasto_fijo', 'Cuido', 'semanal'],
  ['gasto_fijo', 'Pasajes', 'semanal'],
  ['gasto_variable', 'Aceite/Valvulina', 'semanal'],
  ['gasto_variable', 'Medicamentos', 'semanal'],
  ['gasto_variable', 'Descargue', 'semanal'],
  ['gasto_variable', 'Insumos agrícolas', 'semanal'],
  ['gasto_variable', 'Fertilizantes', 'semanal'],
  ['gasto_variable', 'Herbicidas', 'semanal'],
  ['factura', 'Energía', 'mensual'],
  ['factura', 'Internet', 'mensual'],
  ['factura', 'Agua', 'mensual'],
  ['factura', 'Telefonía', 'mensual'],
];

async function sembrarConceptos(fincaId) {
  let orden = 0;
  for (const [tipo, nombre, periodicidad] of CONCEPTOS_SEMILLA) {
    await query(
      'INSERT INTO fin_conceptos (finca_id, nombre, tipo, periodicidad, orden) VALUES (?, ?, ?, ?, ?)',
      [fincaId, nombre, tipo, periodicidad, orden++]
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autorización por finca (separación de funciones)
// Devuelve { ok, status, error, rol } — rol = rol_finca del usuario en la finca.
// minRol acepta jerarquía: propietario > administrador > contador/auxiliar.
// ─────────────────────────────────────────────────────────────────────────────
const PUEDE_ESCRIBIR = ['propietario', 'administrador', 'contador'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function accesoFinca(fincaId, usuarioId, { escribir = false, soloPropietario = false, escritores = PUEDE_ESCRIBIR } = {}) {
  const rows = await query(
    'SELECT rol_finca FROM finca_usuarios WHERE finca_id = ? AND usuario_id = ? AND activo = 1',
    [fincaId, usuarioId]
  );
  const rol = rows && rows[0] && rows[0].rol_finca;
  if (!rol) return { ok: false, status: 403, error: 'No tienes acceso a esta finca' };
  if (soloPropietario && rol !== 'propietario') {
    return { ok: false, status: 403, error: 'Solo el propietario puede realizar esta acción' };
  }
  if (escribir && !escritores.includes(rol)) {
    return { ok: false, status: 403, error: 'Tu rol en la finca es de solo lectura' };
  }
  return { ok: true, rol };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fincas
// ─────────────────────────────────────────────────────────────────────────────

// Fincas a las que pertenece el usuario (vía finca_usuarios), junto con su
// rol_finca en cada una. Si es empleador/admin y no tiene ninguna, le crea una
// por defecto y lo deja como propietario, sembrando los conceptos. Reutilizado
// por misFincas() y por otros módulos (cuaderno, nómina) para resolver el
// scoping por finca en vez de por "quién creó el registro".
async function obtenerFincasUsuario(usuarioId, rol) {
  let fincas = await query(
    `SELECT f.*, fu.rol_finca
       FROM fincas f
       JOIN finca_usuarios fu ON fu.finca_id = f.id AND fu.usuario_id = ? AND fu.activo = 1
      WHERE f.activa = 1
      ORDER BY f.id ASC`,
    [usuarioId]
  );

  if ((!fincas || fincas.length === 0) && (rol === 'empleador' || rol === 'admin')) {
    const u = await query('SELECT nombre_completo, municipio, vereda FROM usuarios WHERE id = ?', [usuarioId]);
    const datos = (u && u[0]) || {};
    const nombre = datos.nombre_completo ? `Finca de ${datos.nombre_completo}` : 'Mi finca';
    const result = await query(
      'INSERT INTO fincas (empleador_id, nombre, municipio, vereda) VALUES (?, ?, ?, ?)',
      [usuarioId, nombre, datos.municipio || null, datos.vereda || null]
    );
    const fincaId = Number(result.insertId);
    await query(
      'INSERT INTO finca_usuarios (finca_id, usuario_id, rol_finca) VALUES (?, ?, ?)',
      [fincaId, usuarioId, 'propietario']
    );
    await sembrarConceptos(fincaId);
    fincas = await query(
      `SELECT f.*, fu.rol_finca
         FROM fincas f
         JOIN finca_usuarios fu ON fu.finca_id = f.id AND fu.usuario_id = ? AND fu.activo = 1
        WHERE f.activa = 1 ORDER BY f.id ASC`,
      [usuarioId]
    );
  }

  return fincas || [];
}

async function misFincas(req, res) {
  try {
    const fincas = await obtenerFincasUsuario(req.user.id, req.user.rol);
    res.json({ fincas });
  } catch (err) {
    console.error('misFincas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearFinca(req, res) {
  try {
    const usuarioId = req.user.id;
    const { nombre, municipio, vereda, hectareas } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre de la finca es obligatorio' });
    }
    const result = await query(
      'INSERT INTO fincas (empleador_id, nombre, municipio, vereda, hectareas) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, String(nombre).trim(), municipio || null, vereda || null, hectareas || null]
    );
    const fincaId = Number(result.insertId);
    await query(
      'INSERT INTO finca_usuarios (finca_id, usuario_id, rol_finca) VALUES (?, ?, ?)',
      [fincaId, usuarioId, 'propietario']
    );
    await sembrarConceptos(fincaId);
    const rows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    res.status(201).json({ finca: rows[0], rol_finca: 'propietario' });
  } catch (err) {
    console.error('crearFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function detalleFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const rows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Finca no encontrada' });
    res.json({ finca: rows[0], rol_finca: acc.rol });
  } catch (err) {
    console.error('detalleFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Actualiza datos generales y parámetros de conversión (solo propietario).
async function actualizarFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    // Los precios del cuaderno (jornal, kilo, alimentación) los puede ajustar
    // también el administrador; el resto de la configuración es solo del propietario.
    const CAMPOS_PRECIOS = ['precio_jornal_default', 'precio_kilo_default', 'precio_alimentacion'];
    const soloPrecios = Object.keys(req.body).every((k) => CAMPOS_PRECIOS.includes(k));
    const acc = soloPrecios
      ? await accesoFinca(fincaId, req.user.id, { escribir: true })
      : await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const campos = {
      nombre: req.body.nombre,
      municipio: req.body.municipio,
      vereda: req.body.vereda,
      hectareas: req.body.hectareas,
      modalidad_alimentacion: req.body.modalidad_alimentacion,
      factor_conversion: req.body.factor_conversion,
      kg_por_arroba: req.body.kg_por_arroba,
      kg_por_carga: req.body.kg_por_carga,
      umbral_merma_pct: req.body.umbral_merma_pct,
      precio_jornal_default: req.body.precio_jornal_default,
      precio_kilo_default: req.body.precio_kilo_default,
      precio_alimentacion: req.body.precio_alimentacion,
      meta_kg_semanal: req.body.meta_kg_semanal,
      meta_kg_cosecha: req.body.meta_kg_cosecha,
    };
    if (campos.modalidad_alimentacion &&
        !['incluida', 'independiente'].includes(campos.modalidad_alimentacion)) {
      return res.status(400).json({ error: 'modalidad_alimentacion inválida' });
    }
    const prevRows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    const prev = (prevRows && prevRows[0]) || {};

    const sets = [];
    const params = [];
    const anterior = {};
    const nuevo = {};
    for (const [k, v] of Object.entries(campos)) {
      if (v !== undefined) {
        const val = v === '' ? null : v;
        sets.push(`${k} = ?`); params.push(val);
        anterior[k] = prev[k]; nuevo[k] = val;
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(fincaId);
    await query(`UPDATE fincas SET ${sets.join(', ')} WHERE id = ?`, params);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId, entidad: 'finca', registroId: fincaId, accion: 'editar',
      anterior, nuevo, descripcion: 'Configuración de finca actualizada', ip: ipDe(req),
    });
    const rows = await query('SELECT * FROM fincas WHERE id = ?', [fincaId]);
    res.json({ finca: rows[0] });
  } catch (err) {
    console.error('actualizarFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-usuarios de la finca
// ─────────────────────────────────────────────────────────────────────────────

async function listarUsuarios(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const rows = await query(
      `SELECT fu.id, fu.rol_finca, fu.activo, u.id AS usuario_id, u.nombre_completo, u.celular
         FROM finca_usuarios fu
         JOIN usuarios u ON u.id = fu.usuario_id
        WHERE fu.finca_id = ?
        ORDER BY FIELD(fu.rol_finca,'propietario','administrador','contador','auxiliar'), u.nombre_completo`,
      [fincaId]
    );
    res.json({ usuarios: rows || [] });
  } catch (err) {
    console.error('listarUsuarios:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Invita a un usuario existente (por celular) con un rol de finca. Solo propietario.
async function invitarUsuario(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const { celular, rol_finca } = req.body;
    const rol = rol_finca || 'auxiliar';
    if (!celular) return res.status(400).json({ error: 'El celular es obligatorio' });
    if (!['administrador', 'auxiliar', 'contador'].includes(rol)) {
      return res.status(400).json({ error: 'rol_finca inválido' });
    }
    const u = await query('SELECT id FROM usuarios WHERE celular = ?', [String(celular).trim()]);
    if (!u || u.length === 0) {
      return res.status(404).json({ error: 'No existe un usuario con ese celular' });
    }
    const usuarioId = Number(u[0].id);
    const existe = await query(
      'SELECT id FROM finca_usuarios WHERE finca_id = ? AND usuario_id = ?',
      [fincaId, usuarioId]
    );
    if (existe && existe.length > 0) {
      await query(
        'UPDATE finca_usuarios SET rol_finca = ?, activo = 1 WHERE id = ?',
        [rol, existe[0].id]
      );
    } else {
      await query(
        'INSERT INTO finca_usuarios (finca_id, usuario_id, rol_finca) VALUES (?, ?, ?)',
        [fincaId, usuarioId, rol]
      );
    }
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId, entidad: 'finca_usuario', registroId: usuarioId, accion: 'invitar',
      nuevo: { usuario_id: usuarioId, rol_finca: rol }, descripcion: `Usuario invitado como ${rol}`, ip: ipDe(req),
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('invitarUsuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// Crea una cuenta nueva (rol empleador, sin cédula/SMS/fotos) y la asocia de
// una vez a la finca con un rol_finca. Solo el propietario puede usarlo —
// pensado para darle acceso a un capataz que no tiene cuenta todavía.
async function crearCuentaUsuario(req, res) {
  let db;
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const { nombre_completo, celular, password, rol_finca } = req.body;
    if (!nombre_completo || !String(nombre_completo).trim()) {
      return res.status(400).json({ error: 'El nombre completo es obligatorio' });
    }
    if (!celular) {
      return res.status(400).json({ error: 'El celular es obligatorio' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!['administrador', 'auxiliar', 'contador'].includes(rol_finca)) {
      return res.status(400).json({ error: 'rol_finca inválido' });
    }

    const celularNorm = normalizePhone(celular) || String(celular).replace(/[\s\-\(\)\.]/g, '');
    if (!celularNorm) {
      return res.status(400).json({ error: 'El celular no es válido' });
    }

    const existente = await query('SELECT id FROM usuarios WHERE celular = ?', [celularNorm]);
    if (existente && existente.length > 0) {
      return res.status(409).json({
        error: "Ese celular ya tiene una cuenta, usa 'invitar' en vez de 'crear cuenta'",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    db = await getConnection();
    await db.beginTransaction();

    const result = await db.query(
      `INSERT INTO usuarios (rol, nombre_completo, celular, password_hash, cedula, acepta_habeas_data)
       VALUES ('empleador', ?, ?, ?, '', 1)`,
      [String(nombre_completo).trim(), celularNorm, password_hash]
    );
    const usuarioId = Number(result.insertId);
    if (!usuarioId) throw new Error('No se obtuvo ID de usuario tras el INSERT');

    await db.query(
      'INSERT INTO finca_usuarios (finca_id, usuario_id, rol_finca) VALUES (?, ?, ?)',
      [fincaId, usuarioId, rol_finca]
    );

    await db.commit();

    await registrarAuditoria({
      usuarioId: req.user.id, fincaId, entidad: 'finca_usuario', registroId: usuarioId, accion: 'crear_cuenta',
      nuevo: { usuario_id: usuarioId, rol_finca }, descripcion: `Cuenta creada para ${nombre_completo} como ${rol_finca}`, ip: ipDe(req),
    });

    res.status(201).json({
      id: usuarioId,
      celular: celularNorm,
      nombre_completo: String(nombre_completo).trim(),
      rol_finca,
    });
  } catch (err) {
    if (db) await db.rollback().catch(() => {});
    console.error('crearCuentaUsuario:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: "Ese celular ya tiene una cuenta, usa 'invitar' en vez de 'crear cuenta'",
      });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    if (db) db.release();
  }
}

async function quitarUsuario(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const fuId = Number(req.params.fuId);
    const rows = await query('SELECT rol_finca FROM finca_usuarios WHERE id = ? AND finca_id = ?', [fuId, fincaId]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Miembro no encontrado' });
    if (rows[0].rol_finca === 'propietario') {
      return res.status(400).json({ error: 'No se puede quitar al propietario' });
    }
    await query('DELETE FROM finca_usuarios WHERE id = ?', [fuId]);
    await registrarAuditoria({
      usuarioId: req.user.id, fincaId, entidad: 'finca_usuario', registroId: fuId, accion: 'eliminar',
      anterior: { rol_finca: rows[0].rol_finca }, descripcion: 'Usuario removido de la finca', ip: ipDe(req),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('quitarUsuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auditoría (solo propietario): registro de acciones sensibles de la finca.
// ─────────────────────────────────────────────────────────────────────────────
async function auditoria(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const rows = await query(
      `SELECT a.id, a.entidad, a.registro_id, a.accion, a.valor_anterior, a.valor_nuevo,
              a.descripcion, a.ip, a.created_at, u.nombre_completo AS usuario
         FROM auditoria a
         LEFT JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.finca_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`,
      [fincaId, limit]
    );
    res.json({ registros: rows || [] });
  } catch (err) {
    console.error('auditoria:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lotes/parcelas de la finca (ej. "Lote 1", cultivo café) — se seleccionan al
// cerrar una jornada para saber en qué parte de la finca trabajó cada
// jornalero, y así rastrear a qué lote pertenece el café recogido.
// ─────────────────────────────────────────────────────────────────────────────
async function listarLotesFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const rows = await query(
      'SELECT * FROM finca_lotes WHERE finca_id = ? AND activo = 1 ORDER BY nombre ASC',
      [fincaId]
    );
    res.json({ lotes: rows || [] });
  } catch (err) {
    console.error('listarLotesFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function crearLoteFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    const { nombre, cultivo, hectareas } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del lote es obligatorio' });
    }
    const hectareasNum = hectareas !== undefined && hectareas !== null && hectareas !== ''
      ? Number(hectareas) : null;
    const result = await query(
      'INSERT INTO finca_lotes (finca_id, nombre, cultivo, hectareas) VALUES (?, ?, ?, ?)',
      [fincaId, String(nombre).trim(), cultivo || null, hectareasNum]
    );
    const loteId = Number(result.insertId);
    await registrarAuditoria({
      fincaId, usuarioId: req.user.id, entidad: 'finca_lote', registroId: loteId, accion: 'crear',
      nuevo: { nombre, cultivo, hectareas: hectareasNum }, descripcion: `Lote "${nombre}" creado`, ip: ipDe(req),
    });
    res.status(201).json({ id: loteId, nombre: String(nombre).trim(), cultivo: cultivo || null, hectareas: hectareasNum });
  } catch (err) {
    console.error('crearLoteFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function listarRendimientoLotes(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: 'desde y hasta son obligatorios' });
    }
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const lotes = await query(
      'SELECT id, nombre, cultivo, hectareas FROM finca_lotes WHERE finca_id = ? AND activo = 1 ORDER BY nombre ASC',
      [fincaId]
    );
    const totales = await query(
      `SELECT r.finca_lote_id AS lote_id,
              COALESCE(SUM(r.cantidad_kg), 0) AS kg_total,
              COUNT(*) AS jornales,
              COALESCE(SUM(r.pago_total), 0) AS costo_mano_obra
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE (j.finca_id = ?) AND j.fecha BETWEEN ? AND ?
          AND r.finca_lote_id IS NOT NULL
        GROUP BY r.finca_lote_id`,
      [fincaId, desde, hasta]
    );
    const totalesPorLote = new Map();
    (totales || []).forEach((t) => totalesPorLote.set(Number(t.lote_id), t));

    const resultado = (lotes || []).map((l) => {
      const t = totalesPorLote.get(Number(l.id));
      return {
        id: l.id,
        nombre: l.nombre,
        cultivo: l.cultivo,
        hectareas: l.hectareas !== null && l.hectareas !== undefined ? Number(l.hectareas) : null,
        kg_total: t ? round2(Number(t.kg_total)) : 0,
        jornales: t ? Number(t.jornales) : 0,
        costo_mano_obra: t ? round2(Number(t.costo_mano_obra)) : 0,
      };
    });
    res.json({ lotes: resultado });
  } catch (err) {
    console.error('listarRendimientoLotes:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// GET /finca/:id/cultivos/rendimiento?desde=&hasta=
async function listarRendimientoCultivos(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: 'desde y hasta son obligatorios' });
    }
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    // kg/horas/pago SOLO de recolección, por cultivo.
    const recoleccion = await query(
      `SELECT r.cultivo,
              COALESCE(SUM(r.cantidad_kg), 0) AS kg_total,
              COALESCE(SUM(r.horas), 0) AS horas_total,
              COALESCE(SUM(r.pago_total), 0) AS pago_recoleccion_total
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE j.finca_id = ? AND j.fecha BETWEEN ? AND ?
          AND j.tipo_trabajo = 'Recolección' AND r.cultivo IS NOT NULL
        GROUP BY r.cultivo`,
      [fincaId, desde, hasta]
    );

    // Costo de TODAS las labores (no solo recolección) ligadas al cultivo.
    const costoTotal = await query(
      `SELECT r.cultivo, COALESCE(SUM(r.pago_total), 0) AS costo_cosecha_total
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE j.finca_id = ? AND j.fecha BETWEEN ? AND ?
          AND r.cultivo IS NOT NULL
        GROUP BY r.cultivo`,
      [fincaId, desde, hasta]
    );
    const costoPorCultivo = new Map((costoTotal || []).map((c) => [c.cultivo, Number(c.costo_cosecha_total)]));

    // Ranking de trabajadores por cultivo (solo recolección).
    const trabajadores = await query(
      `SELECT r.cultivo, a.trabajador_id, COALESCE(u.nombre_completo, a.manual_nombre) AS nombre,
              u.foto_selfie AS foto,
              COALESCE(SUM(r.cantidad_kg), 0) AS kg,
              COALESCE(SUM(r.horas), 0) AS horas,
              COALESCE(SUM(r.pago_total), 0) AS pago
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
         JOIN cuaderno_asistencias a ON a.id = r.asistencia_id
         LEFT JOIN usuarios u ON u.id = a.trabajador_id
        WHERE j.finca_id = ? AND j.fecha BETWEEN ? AND ?
          AND j.tipo_trabajo = 'Recolección' AND r.cultivo IS NOT NULL
        GROUP BY r.cultivo, a.trabajador_id, nombre, foto
        ORDER BY kg DESC`,
      [fincaId, desde, hasta]
    );
    const trabajadoresPorCultivo = new Map();
    for (const t of trabajadores || []) {
      const lista = trabajadoresPorCultivo.get(t.cultivo) || [];
      lista.push({
        trabajador_id: t.trabajador_id, nombre: t.nombre || 'Trabajador', foto: t.foto || null,
        kg: round2(Number(t.kg)), horas: round2(Number(t.horas)), pago: round2(Number(t.pago)),
      });
      trabajadoresPorCultivo.set(t.cultivo, lista);
    }

    // Precio de venta por cultivo — del mes de `desde`.
    const [anio, mes] = String(desde).split('-').map(Number);
    const periodoRows = await query(
      'SELECT id FROM fin_periodos WHERE finca_id = ? AND anio = ? AND mes = ?',
      [fincaId, anio, mes]
    );
    const periodoId = periodoRows && periodoRows[0] ? Number(periodoRows[0].id) : null;
    const preciosPorCultivo = new Map();
    if (periodoId) {
      const precios = await query(
        'SELECT cultivo, precio_venta_kilo FROM finanzas_precio_venta_cultivo WHERE periodo_id = ?',
        [periodoId]
      );
      for (const p of precios || []) {
        preciosPorCultivo.set(p.cultivo, p.precio_venta_kilo !== null ? Number(p.precio_venta_kilo) : null);
      }
    }

    const cultivos = (recoleccion || []).map((r) => ({
      cultivo: r.cultivo,
      kg_total: round2(Number(r.kg_total)),
      horas_total: round2(Number(r.horas_total)),
      pago_recoleccion_total: round2(Number(r.pago_recoleccion_total)),
      costo_cosecha_total: round2(costoPorCultivo.get(r.cultivo) || 0),
      precio_venta_kilo: preciosPorCultivo.has(r.cultivo) ? preciosPorCultivo.get(r.cultivo) : null,
      trabajadores: trabajadoresPorCultivo.get(r.cultivo) || [],
    }));

    const sinCultivoRows = await query(
      `SELECT COUNT(*) AS n
         FROM cuaderno_registros_trabajo r
         JOIN cuaderno_jornadas j ON j.id = r.jornada_id
        WHERE j.finca_id = ? AND j.fecha BETWEEN ? AND ?
          AND j.tipo_trabajo = 'Recolección' AND r.cultivo IS NULL`,
      [fincaId, desde, hasta]
    );
    const jornadas_sin_cultivo = sinCultivoRows && sinCultivoRows[0] ? Number(sinCultivoRows[0].n) : 0;

    res.json({ cultivos, jornadas_sin_cultivo });
  } catch (err) {
    console.error('listarRendimientoCultivos:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

async function eliminarLoteFinca(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const loteId = Number(req.params.loteId);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });
    // Se desactiva en vez de borrar para no perder la trazabilidad de
    // jornadas/registros ya anclados a este lote.
    await query('UPDATE finca_lotes SET activo = 0 WHERE id = ? AND finca_id = ?', [loteId, fincaId]);
    await registrarAuditoria({
      fincaId, usuarioId: req.user.id, entidad: 'finca_lote', registroId: loteId, accion: 'eliminar',
      descripcion: 'Lote desactivado', ip: ipDe(req),
    });
    res.json({ message: 'Lote eliminado' });
  } catch (err) {
    console.error('eliminarLoteFinca:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  accesoFinca,          // reutilizado por finanzas/cafe/cuaderno controllers
  listarLotesFinca,
  crearLoteFinca,
  eliminarLoteFinca,
  listarRendimientoLotes,
  listarRendimientoCultivos,
  obtenerFincasUsuario, // reutilizado por cuaderno/nómina para scoping por finca
  sembrarConceptos,
  misFincas,
  crearFinca,
  detalleFinca,
  actualizarFinca,
  listarUsuarios,
  invitarUsuario,
  crearCuentaUsuario,
  quitarUsuario,
  auditoria,
};
