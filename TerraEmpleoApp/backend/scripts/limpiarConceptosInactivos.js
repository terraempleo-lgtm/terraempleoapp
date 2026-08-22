#!/usr/bin/env node
/**
 * scripts/limpiarConceptosInactivos.js
 *
 * Migración de una sola vez, retroactiva al fix de eliminarConcepto en
 * finanzasController.js: antes de ese fix, borrar un concepto en Finanzas
 * solo lo desactivaba (fin_conceptos.activo=0) sin tocar sus
 * fin_movimientos. Como ni resumenRango ni balance() filtran por ese flag
 * de activo, esos movimientos viejos siguen sumando en Balance
 * (ingresos_totales/egresos_totales/saldo_actual/historial — acumulado de
 * toda la vida de la finca) aunque el concepto ya no aparezca en ningún
 * lado de Finanzas.
 *
 * Este script busca todos los fin_conceptos con activo=0, borra en cascada
 * sus fin_movimientos (todos los períodos/semanas, no solo el mes actual)
 * y sus fotos de factura en S3 — mismo criterio que el DELETE
 * /finanzas/conceptos/:id ya arreglado. Deja auditado, por concepto,
 * cuántos movimientos y cuánto dinero se borraron.
 *
 * Es irreversible sobre datos financieros reales: siempre imprime el
 * conteo detallado (conceptos, movimientos, monto total, fotos) ANTES de
 * borrar nada, incluso en modo --apply. Dry-run por defecto.
 *
 * Uso:
 *   node scripts/limpiarConceptosInactivos.js          # dry-run (solo muestra qué haría)
 *   node scripts/limpiarConceptosInactivos.js --apply  # ejecuta el borrado real
 *
 * Contra producción: como los otros scripts de esta carpeta, este script
 * NO carga secretos de SSM (eso solo lo hace server.js al arrancar la API).
 * Corre en local con backend/.env apuntando a DB_HOST/DB_USER/DB_NAME de
 * RDS y DB_PASSWORD puesto a mano — para obtenerlo:
 *   aws ssm get-parameter --name "/terraempleo/production/DB_PASSWORD" \
 *     --with-decryption --query "Parameter.Value" --output text
 */

require('dotenv').config();
const { query, pool } = require('../config/database');
const { deleteFromS3 } = require('../config/s3');
const { registrarAuditoria } = require('../helpers/auditoria');

const DRY_RUN = !process.argv.includes('--apply');
const formatMoney = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LIMPIEZA RETROACTIVA DE CONCEPTOS INACTIVOS — TerraEmpleo');
  console.log(`  Modo: ${DRY_RUN ? 'DRY-RUN (no se modifica nada)' : '⚡ APPLY (borrado real, irreversible)'}`);
  console.log('  Fecha:', new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════════\n');

  const conceptos = await query(`
    SELECT c.id, c.nombre, c.tipo, c.finca_id, f.nombre AS finca_nombre
      FROM fin_conceptos c
      LEFT JOIN fincas f ON f.id = c.finca_id
     WHERE c.activo = 0
     ORDER BY c.finca_id, c.id
  `);

  if (!conceptos.length) {
    console.log('No hay conceptos inactivos en la base de datos. Nada que limpiar.');
    await pool.end();
    return;
  }

  // Primer paso — SIEMPRE: reunir todo lo que se borraría, sin tocar nada
  // todavía. El conteo se imprime antes de cualquier DELETE, en cualquier modo.
  let totalMovimientos = 0;
  let totalMonto = 0;
  let totalFotos = 0;
  const detalle = [];

  for (const c of conceptos) {
    const movimientos = await query('SELECT id, monto, foto_url FROM fin_movimientos WHERE concepto_id = ?', [c.id]);
    if (!movimientos.length) continue; // este concepto ya estaba limpio
    const monto = movimientos.reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const fotos = movimientos.filter((m) => m.foto_url).length;
    totalMovimientos += movimientos.length;
    totalMonto += monto;
    totalFotos += fotos;
    detalle.push({ concepto: c, movimientos, monto });
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log(`  Conceptos inactivos en la base de datos: ${conceptos.length}`);
  console.log(`  Conceptos con movimientos pendientes de limpiar: ${detalle.length}`);
  console.log(`  Movimientos a borrar: ${totalMovimientos}`);
  console.log(`  Monto total a borrar: ${formatMoney(totalMonto)}`);
  console.log(`  Fotos de factura en S3 a borrar: ${totalFotos}`);
  console.log('───────────────────────────────────────────────────────────\n');

  if (!detalle.length) {
    console.log('Todos los conceptos inactivos ya tienen sus movimientos limpios. Nada que hacer.');
    await pool.end();
    return;
  }

  console.log('Detalle por concepto:');
  for (const { concepto: c, movimientos, monto } of detalle) {
    const finca = c.finca_nombre ? `${c.finca_nombre} (finca #${c.finca_id})` : `finca #${c.finca_id}`;
    console.log(`  · ${finca} — concepto #${c.id} "${c.nombre}" (${c.tipo}): ${movimientos.length} movimiento(s), ${formatMoney(monto)}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY-RUN: no se borró nada todavía. Revisa el detalle de arriba y, si está correcto, ejecuta:');
    console.log('  node scripts/limpiarConceptosInactivos.js --apply');
    await pool.end();
    return;
  }

  console.log('⚡ Borrando movimientos y fotos de factura (irreversible)...\n');
  let conceptosLimpiados = 0;
  for (const { concepto: c, movimientos, monto } of detalle) {
    for (const m of movimientos) {
      if (m.foto_url) {
        try { await deleteFromS3(m.foto_url); }
        catch (e) { console.warn(`    ⚠ no se pudo borrar la foto del movimiento #${m.id}: ${e.message}`); }
      }
    }
    await query('DELETE FROM fin_movimientos WHERE concepto_id = ?', [c.id]);
    await registrarAuditoria({
      usuarioId: null, fincaId: c.finca_id, entidad: 'fin_concepto', registroId: c.id,
      accion: 'limpieza_retroactiva',
      anterior: { movimientos_eliminados: movimientos.length, monto_total_eliminado: monto },
      descripcion: 'Limpieza retroactiva (scripts/limpiarConceptosInactivos.js): movimientos de un concepto ya inactivo borrados de todos los períodos (irreversible)',
      ip: null,
    });
    conceptosLimpiados++;
    console.log(`  ✓ concepto #${c.id} "${c.nombre}" — ${movimientos.length} movimiento(s) borrados`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Listo. Conceptos limpiados: ${conceptosLimpiados}  |  Movimientos borrados: ${totalMovimientos}  |  Monto: ${formatMoney(totalMonto)}`);
  console.log('═══════════════════════════════════════════════════════════');

  await pool.end();
}

run().catch((err) => {
  console.error('Error en la limpieza:', err);
  process.exit(1);
});
