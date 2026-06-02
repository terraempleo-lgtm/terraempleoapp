const { query } = require('../config/database');

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

async function accesoFinca(fincaId, usuarioId, { escribir = false, soloPropietario = false } = {}) {
  const rows = await query(
    'SELECT rol_finca FROM finca_usuarios WHERE finca_id = ? AND usuario_id = ? AND activo = 1',
    [fincaId, usuarioId]
  );
  const rol = rows && rows[0] && rows[0].rol_finca;
  if (!rol) return { ok: false, status: 403, error: 'No tienes acceso a esta finca' };
  if (soloPropietario && rol !== 'propietario') {
    return { ok: false, status: 403, error: 'Solo el propietario puede realizar esta acción' };
  }
  if (escribir && !PUEDE_ESCRIBIR.includes(rol)) {
    return { ok: false, status: 403, error: 'Tu rol en la finca es de solo lectura' };
  }
  return { ok: true, rol };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fincas
// ─────────────────────────────────────────────────────────────────────────────

// Lista las fincas a las que el usuario pertenece. Si es empleador y no tiene
// ninguna, le crea una por defecto (con su nombre/municipio) y lo deja como
// propietario, sembrando los conceptos. Garantiza que el módulo "funcione solo".
async function misFincas(req, res) {
  try {
    const usuarioId = req.user.id;
    let fincas = await query(
      `SELECT f.*, fu.rol_finca
         FROM fincas f
         JOIN finca_usuarios fu ON fu.finca_id = f.id AND fu.usuario_id = ? AND fu.activo = 1
        WHERE f.activa = 1
        ORDER BY f.id ASC`,
      [usuarioId]
    );

    if ((!fincas || fincas.length === 0) && (req.user.rol === 'empleador' || req.user.rol === 'admin')) {
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

    res.json({ fincas: fincas || [] });
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
    const acc = await accesoFinca(fincaId, req.user.id, { soloPropietario: true });
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
    };
    if (campos.modalidad_alimentacion &&
        !['incluida', 'independiente'].includes(campos.modalidad_alimentacion)) {
      return res.status(400).json({ error: 'modalidad_alimentacion inválida' });
    }
    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(campos)) {
      if (v !== undefined) { sets.push(`${k} = ?`); params.push(v === '' ? null : v); }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(fincaId);
    await query(`UPDATE fincas SET ${sets.join(', ')} WHERE id = ?`, params);
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
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('invitarUsuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
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
    res.json({ ok: true });
  } catch (err) {
    console.error('quitarUsuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  accesoFinca,          // reutilizado por finanzasController
  sembrarConceptos,
  misFincas,
  crearFinca,
  detalleFinca,
  actualizarFinca,
  listarUsuarios,
  invitarUsuario,
  quitarUsuario,
};
