#!/usr/bin/env node
/**
 * scripts/auditUserPhones.js
 *
 * Script de DIAGNÓSTICO (solo lectura) que analiza los números de celular
 * en la tabla `usuarios` y reporta:
 *   - Cuántos ya están en formato E.164 (+57XXXXXXXXXX)
 *   - Cuántos necesitan normalización
 *   - Cuántos no se pueden normalizar (inválidos)
 *   - Posibles duplicados que surgirían tras normalizar
 *   - Ejemplos de cada categoría
 *
 * NO modifica la base de datos.
 *
 * Uso:
 *   node scripts/auditUserPhones.js
 */

require('dotenv').config();
const { query, pool } = require('../config/database');
const { normalizePhone } = require('../helpers/normalizePhone');

async function audit() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AUDITORÍA DE NÚMEROS DE CELULAR — TerraEmpleo');
  console.log('  Fecha:', new Date().toISOString());
  console.log('  Modo: SOLO LECTURA (no se modifica nada)');
  console.log('═══════════════════════════════════════════════════════\n');

  const usuarios = await query('SELECT id, celular, nombre_completo, rol, activo, eliminado FROM usuarios ORDER BY id');

  const alreadyOk = [];     // Ya en formato E.164
  const wouldChange = [];    // Se pueden normalizar
  const invalid = [];        // No se pueden normalizar
  const normalizedMap = {};  // Para detectar duplicados: normalized → [usuarios]

  for (const u of usuarios) {
    const raw = u.celular;
    const normalized = normalizePhone(raw);

    if (!normalized) {
      invalid.push({ id: u.id, celular: raw, nombre: u.nombre_completo, rol: u.rol });
      continue;
    }

    // Registrar en mapa para detectar duplicados
    if (!normalizedMap[normalized]) normalizedMap[normalized] = [];
    normalizedMap[normalized].push({ id: u.id, celular: raw, nombre: u.nombre_completo, rol: u.rol, activo: u.activo, eliminado: u.eliminado });

    if (raw === normalized) {
      alreadyOk.push({ id: u.id, celular: raw });
    } else {
      wouldChange.push({ id: u.id, antes: raw, despues: normalized, nombre: u.nombre_completo });
    }
  }

  // Detectar duplicados
  const duplicates = Object.entries(normalizedMap).filter(([, users]) => users.length > 1);

  // ── Resultados ──
  console.log(`Total de usuarios: ${usuarios.length}\n`);

  console.log(`✓ Ya en formato E.164: ${alreadyOk.length}`);
  if (alreadyOk.length > 0 && alreadyOk.length <= 10) {
    alreadyOk.forEach(u => console.log(`    id=${u.id}  ${u.celular}`));
  } else if (alreadyOk.length > 10) {
    alreadyOk.slice(0, 5).forEach(u => console.log(`    id=${u.id}  ${u.celular}`));
    console.log(`    ... y ${alreadyOk.length - 5} más`);
  }

  console.log(`\n→ Necesitan normalización: ${wouldChange.length}`);
  if (wouldChange.length > 0) {
    wouldChange.slice(0, 15).forEach(u =>
      console.log(`    id=${u.id}  "${u.antes}" → "${u.despues}"  (${u.nombre})`)
    );
    if (wouldChange.length > 15) console.log(`    ... y ${wouldChange.length - 15} más`);
  }

  console.log(`\n✗ No normalizables (inválidos): ${invalid.length}`);
  if (invalid.length > 0) {
    invalid.forEach(u =>
      console.log(`    id=${u.id}  "${u.celular}"  (${u.nombre}, rol=${u.rol})`)
    );
  }

  console.log(`\n⚠ Posibles duplicados tras normalización: ${duplicates.length}`);
  if (duplicates.length > 0) {
    for (const [normalized, users] of duplicates) {
      console.log(`    ${normalized}:`);
      for (const u of users) {
        const flags = [];
        if (Number(u.activo) === 0) flags.push('INACTIVO');
        if (Number(u.eliminado) === 1) flags.push('ELIMINADO');
        console.log(`      id=${u.id}  celular="${u.celular}"  ${u.nombre}  rol=${u.rol}  ${flags.join(' ') || ''}`);
      }
    }
    console.log('\n    ⚠ Los duplicados NO se fusionarán automáticamente.');
    console.log('    Revisa manualmente antes de ejecutar normalizeUserPhones.js');
  }

  // También auditar password_resets y codigos_verificacion
  console.log('\n─── Tablas auxiliares ───');

  try {
    const resets = await query('SELECT DISTINCT celular FROM password_resets');
    const resetCount = resets.length;
    const resetNeedNorm = resets.filter(r => normalizePhone(r.celular) && r.celular !== normalizePhone(r.celular)).length;
    console.log(`password_resets: ${resetCount} números únicos, ${resetNeedNorm} necesitan normalización`);
  } catch (_) {
    console.log('password_resets: tabla no encontrada (OK si no existe aún)');
  }

  try {
    const codigos = await query('SELECT DISTINCT celular FROM codigos_verificacion');
    const codigoCount = codigos.length;
    const codigoNeedNorm = codigos.filter(c => normalizePhone(c.celular) && c.celular !== normalizePhone(c.celular)).length;
    console.log(`codigos_verificacion: ${codigoCount} números únicos, ${codigoNeedNorm} necesitan normalización`);
  } catch (_) {
    console.log('codigos_verificacion: tabla no encontrada (OK si no existe aún)');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Auditoría completada. Ningún dato fue modificado.');
  console.log('═══════════════════════════════════════════════════════');

  await pool.end();
}

audit().catch(err => {
  console.error('Error en auditoría:', err);
  process.exit(1);
});
