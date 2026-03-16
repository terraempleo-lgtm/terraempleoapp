#!/usr/bin/env node
/**
 * scripts/normalizeUserPhones.js
 *
 * Normaliza los números de celular en la tabla `usuarios` al formato E.164 (+57XXXXXXXXXX).
 * También normaliza las tablas `password_resets` y `codigos_verificacion`.
 *
 * Seguridad:
 *   - Si al normalizar se detecta un duplicado (dos filas distintas mapean al mismo E.164),
 *     NO actualiza ninguna de las filas en conflicto y las reporta para revisión manual.
 *   - Los registros que no se pueden normalizar (ej: admin "0000000000") se saltan sin tocar.
 *   - Ejecuta un dry-run por defecto. Usa --apply para ejecutar cambios reales.
 *
 * Uso:
 *   node scripts/normalizeUserPhones.js          # dry-run (solo muestra qué haría)
 *   node scripts/normalizeUserPhones.js --apply  # ejecuta los UPDATE reales
 */

require('dotenv').config();
const { query, pool } = require('../config/database');
const { normalizePhone } = require('../helpers/normalizePhone');

const DRY_RUN = !process.argv.includes('--apply');

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  NORMALIZACIÓN DE CELULARES — TerraEmpleo');
  console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (no se modifica nada)' : '⚡ APPLY (cambios reales)'}`);
  console.log('  Fecha:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Tabla usuarios ──
  await normalizeTable({
    table: 'usuarios',
    idCol: 'id',
    phoneCol: 'celular',
    extraCols: ['nombre_completo', 'rol'],
    isUnique: true,
  });

  // ── 2. Tabla password_resets ──
  await normalizeTable({
    table: 'password_resets',
    idCol: 'id',
    phoneCol: 'celular',
    extraCols: [],
    isUnique: false,
  });

  // ── 3. Tabla codigos_verificacion ──
  await normalizeTable({
    table: 'codigos_verificacion',
    idCol: 'id',
    phoneCol: 'celular',
    extraCols: [],
    isUnique: false,
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  if (DRY_RUN) {
    console.log('  Dry-run completado. Para aplicar cambios ejecuta:');
    console.log('  node scripts/normalizeUserPhones.js --apply');
  } else {
    console.log('  Normalización completada.');
  }
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
}

async function normalizeTable({ table, idCol, phoneCol, extraCols, isUnique }) {
  console.log(`── Tabla: ${table} ──`);

  let rows;
  try {
    const cols = [idCol, phoneCol, ...extraCols].join(', ');
    rows = await query(`SELECT ${cols} FROM ${table} ORDER BY ${idCol}`);
  } catch (err) {
    console.log(`  Tabla ${table} no encontrada, saltando.\n`);
    return;
  }

  let alreadyOk = 0;
  let updated = 0;
  let skippedInvalid = 0;
  let skippedDuplicate = 0;

  // Primer paso: construir mapa de normalización para detectar duplicados
  const normalizedMap = {}; // normalized → [{ id, raw }]
  for (const row of rows) {
    const raw = row[phoneCol];
    const normalized = normalizePhone(raw);
    if (!normalized) continue;
    if (!normalizedMap[normalized]) normalizedMap[normalized] = [];
    normalizedMap[normalized].push({ id: row[idCol], raw });
  }

  // Detectar conflictos: números distintos que mapean al mismo E.164
  const conflictSet = new Set();
  if (isUnique) {
    for (const [norm, entries] of Object.entries(normalizedMap)) {
      if (entries.length > 1) {
        for (const e of entries) conflictSet.add(String(e.id));
        console.log(`  ⚠ DUPLICADO al normalizar a ${norm}:`);
        for (const e of entries) {
          console.log(`    id=${e.id}  celular="${e.raw}"`);
        }
      }
    }
  }

  // Segundo paso: actualizar
  for (const row of rows) {
    const raw = row[phoneCol];
    const normalized = normalizePhone(raw);

    if (!normalized) {
      skippedInvalid++;
      continue;
    }

    if (raw === normalized) {
      alreadyOk++;
      continue;
    }

    // No actualizar si crearía un duplicado en columna UNIQUE
    if (isUnique && conflictSet.has(String(row[idCol]))) {
      skippedDuplicate++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] id=${row[idCol]}  "${raw}" → "${normalized}"`);
    } else {
      await query(`UPDATE ${table} SET ${phoneCol} = ? WHERE ${idCol} = ?`, [normalized, row[idCol]]);
    }
    updated++;
  }

  console.log(`  Total: ${rows.length}  |  OK: ${alreadyOk}  |  Actualizados: ${updated}  |  Inválidos: ${skippedInvalid}  |  Duplicados evitados: ${skippedDuplicate}\n`);
}

run().catch(err => {
  console.error('Error en normalización:', err);
  process.exit(1);
});
