const { query } = require('../config/database');

// Claves válidas de tutoriales de primera vez. Al crear un tutorial nuevo,
// agregar la clave aquí y en TUTORIALES del frontend
// (src/context/TutorialContext.js).
const TUTORIALES_VALIDOS = ['cuaderno', 'finanzas', 'nueva_jornada'];

// GET /api/tutoriales — claves de los tutoriales que el usuario ya vio
async function misTutoriales(req, res) {
  try {
    const rows = await query(
      'SELECT tutorial_key FROM tutoriales_vistos WHERE usuario_id = ?',
      [req.user.id]
    );
    res.json({ tutoriales: rows.map((r) => r.tutorial_key) });
  } catch (err) {
    console.error('Error listando tutoriales vistos:', err);
    res.status(500).json({ error: 'Error consultando tutoriales' });
  }
}

// POST /api/tutoriales/:key/visto — marca un tutorial como visto (idempotente:
// repetir la llamada no duplica filas ni cambia la fecha original)
async function marcarVisto(req, res) {
  const { key } = req.params;
  if (!TUTORIALES_VALIDOS.includes(key)) {
    return res.status(400).json({ error: 'Tutorial desconocido' });
  }
  try {
    await query(
      'INSERT INTO tutoriales_vistos (usuario_id, tutorial_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE visto_at = visto_at',
      [req.user.id, key]
    );
    res.json({ message: 'Tutorial marcado como visto', tutorial: key });
  } catch (err) {
    console.error('Error marcando tutorial visto:', err);
    res.status(500).json({ error: 'Error guardando tutorial' });
  }
}

module.exports = { misTutoriales, marcarVisto };
