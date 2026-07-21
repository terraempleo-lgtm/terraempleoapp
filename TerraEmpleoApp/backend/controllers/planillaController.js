const { query } = require('../config/database');
const { invocarConImagen } = require('../config/bedrock');
const { signUrl } = require('../config/s3');
const { fincaIdsDeUsuario } = require('./cuadernoController');

const PROMPT_PLANILLA = 'Esta es una planilla de registro de jornada agrícola de TerraEmpleo. Extrae los datos de cada fila de trabajador y devuélvelos ÚNICAMENTE en formato JSON válido, sin texto adicional, sin explicaciones, sin bloques de código. El JSON debe tener esta estructura exacta: {"fecha": "DD/MM/YYYY o null si no se lee", "finca": "nombre o null", "labor": "labor del día o null", "trabajadores": [{"nombre": "string o null", "cedula": "string o null", "kg_cereza": number o null, "notas": "string o null"}]}. Si un campo no es legible escribe null. No inventes datos. Si la imagen no es una planilla de TerraEmpleo responde: {"error": "no_es_planilla"}.';

// La respuesta debería venir sin nada más que el JSON (se lo pedimos
// explícito en el prompt), pero los modelos a veces igual envuelven en
// ```json ... ``` — se limpia por si acaso antes de parsear.
function extraerJSON(texto) {
  const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error('sin JSON');
  return JSON.parse(limpio.slice(inicio, fin + 1));
}

// Distancia de Levenshtein — para el matching de nombre con tolerancia de
// 1-2 caracteres pedido (typos de OCR: "Ana Perez" vs "Ana Pérez").
function distancia(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = a[i - 1] === b[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}
function normalizar(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// POST /cuaderno/jornadas/leer-planilla { imagen: base64 }
async function leerPlanilla(req, res) {
  try {
    const { imagen } = req.body;
    if (!imagen) return res.status(400).json({ error: 'imagen (base64) es obligatoria' });

    const base64Limpio = imagen.includes(',') ? imagen.split(',').pop() : imagen;
    const buffer = Buffer.from(base64Limpio, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'imagen inválida' });

    const respuestaTexto = await invocarConImagen(buffer, PROMPT_PLANILLA);

    let datos;
    try {
      datos = extraerJSON(respuestaTexto);
    } catch (e) {
      console.error('[Planilla] parsing:', e.message, '| respuesta:', respuestaTexto?.slice(0, 300));
      return res.status(422).json({ error: 'No se pudieron extraer los datos. Intente con mejor iluminación.' });
    }

    if (datos.error === 'no_es_planilla') {
      return res.status(400).json({ error: 'La imagen no corresponde a una planilla de TerraEmpleo.' });
    }

    // Candidatos para vincular: trabajadores con los que este empleador ya
    // ha trabajado (por finca), con cédula si la tienen registrada.
    const usuarioId = req.user.id;
    const fincaIds = await fincaIdsDeUsuario(usuarioId, req.user.rol);
    const candidatos = await query(
      `SELECT DISTINCT u.id AS trabajador_id, u.nombre_completo, u.cedula, u.foto_selfie
         FROM cuaderno_asistencias a
         JOIN cuaderno_jornadas j ON j.id = a.jornada_id
         JOIN usuarios u ON u.id = a.trabajador_id
        WHERE (j.finca_id IN (?) OR (j.finca_id IS NULL AND j.empleador_id = ?))`,
      [fincaIds.length ? fincaIds : [0], usuarioId]
    );

    const trabajadores = [];
    for (const t of (datos.trabajadores || [])) {
      let match = null;
      if (t.cedula) {
        match = candidatos.find((c) => c.cedula && String(c.cedula).trim() === String(t.cedula).trim());
      }
      if (!match && t.nombre) {
        const nombreNorm = normalizar(t.nombre);
        let mejor = null, mejorDist = Infinity;
        for (const c of candidatos) {
          const dist = distancia(nombreNorm, normalizar(c.nombre_completo));
          if (dist < mejorDist) { mejorDist = dist; mejor = c; }
        }
        // Tolerancia de 1-2 caracteres (escala con el largo del nombre para
        // no aceptar coincidencias falsas en nombres muy cortos).
        if (mejor && mejorDist <= Math.max(2, Math.round(nombreNorm.length * 0.15))) match = mejor;
      }
      trabajadores.push({
        nombre: t.nombre ?? null,
        cedula: t.cedula ?? null,
        kg_cereza: t.kg_cereza ?? null,
        notas: t.notas ?? null,
        trabajador_id: match ? match.trabajador_id : null,
        foto: match?.foto_selfie ? await signUrl(match.foto_selfie) : null,
      });
    }

    res.json({
      success: true,
      fecha: datos.fecha ?? null,
      finca: datos.finca ?? null,
      labor: datos.labor ?? null,
      trabajadores,
    });
  } catch (err) {
    console.error('leerPlanilla:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

module.exports = { leerPlanilla };
