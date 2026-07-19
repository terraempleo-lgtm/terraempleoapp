const { query } = require('../config/database');
const { accesoFinca } = require('./fincaController');

const TIPOS = ['maquinaria', 'vehiculo', 'herramienta_manual'];

// Resuelve la finca_id de una herramienta (para las rutas que solo traen
// el id de la herramienta, no de la finca).
async function fincaDeHerramienta(id) {
  const rows = await query('SELECT finca_id FROM herramientas WHERE id = ?', [id]);
  return rows && rows[0] ? Number(rows[0].finca_id) : null;
}

// GET /finca/:id/herramientas
async function listar(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id);
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const herramientas = await query(
      'SELECT * FROM herramientas WHERE finca_id = ? ORDER BY nombre ASC',
      [fincaId]
    );
    if (!herramientas || !herramientas.length) return res.json({ herramientas: [] });

    const ids = herramientas.map((h) => h.id);
    const mantenimientos = await query(
      `SELECT * FROM herramienta_mantenimientos WHERE herramienta_id IN (?) ORDER BY fecha DESC, id DESC`,
      [ids]
    );
    const porHerramienta = new Map();
    for (const m of mantenimientos || []) {
      const list = porHerramienta.get(Number(m.herramienta_id)) || [];
      list.push(m);
      porHerramienta.set(Number(m.herramienta_id), list);
    }

    const resultado = herramientas.map((h) => {
      const lista = porHerramienta.get(Number(h.id)) || [];
      return {
        ...h,
        ultimo_mantenimiento_fecha: lista[0]?.fecha || null,
        mantenimientos: lista,
      };
    });
    res.json({ herramientas: resultado });
  } catch (err) {
    console.error('listarHerramientas:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /finca/:id/herramientas
async function crear(req, res) {
  try {
    const fincaId = Number(req.params.id);
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const { nombre, tipo, fecha_compra, costo_compra, frecuencia_mantenimiento_dias } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre de la herramienta es obligatorio' });
    }
    const tipoNorm = TIPOS.includes(tipo) ? tipo : 'herramienta_manual';

    const result = await query(
      `INSERT INTO herramientas (finca_id, nombre, tipo, fecha_compra, costo_compra, frecuencia_mantenimiento_dias)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fincaId, String(nombre).trim(), tipoNorm, fecha_compra || null, costo_compra || null, frecuencia_mantenimiento_dias || null]
    );
    const id = Number(result.insertId);
    const rows = await query('SELECT * FROM herramientas WHERE id = ?', [id]);
    res.status(201).json({ ...rows[0], ultimo_mantenimiento_fecha: null, mantenimientos: [] });
  } catch (err) {
    console.error('crearHerramienta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// PUT /finca/herramientas/:id
async function actualizar(req, res) {
  try {
    const id = Number(req.params.id);
    const fincaId = await fincaDeHerramienta(id);
    if (!fincaId) return res.status(404).json({ error: 'Herramienta no encontrada' });
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    if (req.body.tipo !== undefined && !TIPOS.includes(req.body.tipo)) {
      return res.status(400).json({ error: 'tipo inválido' });
    }
    const campos = {
      nombre: req.body.nombre,
      tipo: req.body.tipo,
      fecha_compra: req.body.fecha_compra,
      costo_compra: req.body.costo_compra,
      frecuencia_mantenimiento_dias: req.body.frecuencia_mantenimiento_dias,
    };
    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(campos)) {
      if (v !== undefined) { sets.push(`${k} = ?`); params.push(v === '' ? null : v); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    await query(`UPDATE herramientas SET ${sets.join(', ')} WHERE id = ?`, params);
    const rows = await query('SELECT * FROM herramientas WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('actualizarHerramienta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /finca/herramientas/:id
async function eliminar(req, res) {
  try {
    const id = Number(req.params.id);
    const fincaId = await fincaDeHerramienta(id);
    if (!fincaId) return res.status(404).json({ error: 'Herramienta no encontrada' });
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    await query('DELETE FROM herramientas WHERE id = ?', [id]);
    res.json({ message: 'Herramienta eliminada' });
  } catch (err) {
    console.error('eliminarHerramienta:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// POST /finca/herramientas/:id/mantenimientos
async function crearMantenimiento(req, res) {
  try {
    const herramientaId = Number(req.params.id);
    const fincaId = await fincaDeHerramienta(herramientaId);
    if (!fincaId) return res.status(404).json({ error: 'Herramienta no encontrada' });
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    const { fecha, costo, descripcion } = req.body;
    if (!fecha) return res.status(400).json({ error: 'La fecha es obligatoria' });

    const result = await query(
      'INSERT INTO herramienta_mantenimientos (herramienta_id, fecha, costo, descripcion) VALUES (?, ?, ?, ?)',
      [herramientaId, fecha, costo || null, descripcion || null]
    );
    const rows = await query('SELECT * FROM herramienta_mantenimientos WHERE id = ?', [Number(result.insertId)]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('crearMantenimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// DELETE /finca/herramientas/:id/mantenimientos/:mantenimientoId
async function eliminarMantenimiento(req, res) {
  try {
    const herramientaId = Number(req.params.id);
    const mantenimientoId = Number(req.params.mantenimientoId);
    const fincaId = await fincaDeHerramienta(herramientaId);
    if (!fincaId) return res.status(404).json({ error: 'Herramienta no encontrada' });
    const acc = await accesoFinca(fincaId, req.user.id, { escribir: true });
    if (!acc.ok) return res.status(acc.status).json({ error: acc.error });

    await query('DELETE FROM herramienta_mantenimientos WHERE id = ? AND herramienta_id = ?', [mantenimientoId, herramientaId]);
    res.json({ message: 'Mantenimiento eliminado' });
  } catch (err) {
    console.error('eliminarMantenimiento:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
  crearMantenimiento,
  eliminarMantenimiento,
};
