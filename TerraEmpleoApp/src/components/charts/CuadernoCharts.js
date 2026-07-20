import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { formatMoney } from '../../utils/fincaFormat';
import {
  CHART_COLORS, ChartCard, AnalisisCard, ChartTooltip, TooltipLine,
  ChartEmptyState, Tocable, CampoConfigurable, colorMaloBueno,
} from './ChartKit';

function fechaCorta(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }); }
  catch { return ''; }
}

// ── 1) Kilos por semana ─────────────────────────────────────────────────────
export function KilosPorSemanaChart({ semanal = [], metaKgSemanal, onGuardarMeta }) {
  const [sel, setSel] = useState(null);
  const datos = semanal.slice(-8);
  const maxVal = Math.max(1, metaKgSemanal || 0, ...datos.map((s) => Number(s.kg) || 0));

  if (datos.length === 0) {
    return (
      <ChartCard title="Kilos por semana" icon="basket-outline">
        <ChartEmptyState texto="Aún no hay jornadas con kilos registrados esta temporada." />
      </ChartCard>
    );
  }

  const ultima = datos[datos.length - 1];
  const ultimaKg = Number(ultima.kg) || 0;
  const pctMeta = metaKgSemanal > 0 ? Math.round((ultimaKg * 100) / metaKgSemanal) : null;
  let analisis, tono = 'ok';
  if (!metaKgSemanal) {
    analisis = 'Configura tu meta semanal arriba para ver qué tan cerca está cada semana.';
    tono = 'alerta';
  } else if (pctMeta >= 100) {
    analisis = 'Todo bien esta semana, siga así.';
  } else {
    const kgFaltan = metaKgSemanal - ultimaKg;
    const trabajadoresActuales = Number(ultima.trabajadores) || 1;
    const kgPorTrabajador = ultimaKg / trabajadoresActuales || 1;
    const faltanTrabajadores = kgPorTrabajador > 0 ? Math.ceil(kgFaltan / kgPorTrabajador) : null;
    analisis = `Esta semana recolectaron ${Math.round(ultimaKg).toLocaleString()} kg con ${trabajadoresActuales} trabajadores. Va al ${pctMeta}% de su meta de ${Math.round(metaKgSemanal).toLocaleString()} kg/semana.`
      + (faltanTrabajadores ? ` Necesita ${faltanTrabajadores} trabajador${faltanTrabajadores > 1 ? 'es' : ''} más para alcanzarla.` : '');
    tono = pctMeta >= 70 ? 'alerta' : 'riesgo';
  }

  return (
    <ChartCard title="Kilos por semana" icon="basket-outline">
      <CampoConfigurable
        label="Meta kg/semana"
        value={metaKgSemanal}
        placeholder="Ej: 800"
        sufijo=" kg"
        onGuardar={onGuardarMeta}
      />
      <View style={styles.barsWrap}>
        {metaKgSemanal > 0 && (
          <View style={[styles.metaLine, { bottom: `${Math.min(100, (metaKgSemanal * 100) / maxVal)}%` }]} />
        )}
        {datos.map((s, i) => {
          const h = Math.max(4, Math.round(((Number(s.kg) || 0) * 100) / maxVal));
          const activo = sel === i;
          return (
            <Tocable key={s.semana} onPress={() => setSel(activo ? null : i)} style={styles.barCol}>
              <MotiView
                from={{ height: '0%' }}
                animate={{ height: `${h}%` }}
                transition={{ type: 'timing', duration: 500, delay: i * 50 }}
                style={[styles.bar, activo && { backgroundColor: CHART_COLORS.primaryDark }]}
              />
              <Text style={styles.barLabel}>{fechaCorta(s.desde)}</Text>
            </Tocable>
          );
        })}
      </View>
      <ChartTooltip visible={sel != null}>
        {sel != null && (
          <>
            <TooltipLine label="Semana del" value={fechaCorta(datos[sel].desde)} />
            <TooltipLine label="Kilos" value={`${Math.round(Number(datos[sel].kg) || 0).toLocaleString()} kg`} />
            <TooltipLine label="Trabajadores" value={String(datos[sel].trabajadores || 0)} />
          </>
        )}
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono={tono} />
    </ChartCard>
  );
}

// ── 2) Costo por kilo por semana ────────────────────────────────────────────
export function CostoPorKiloChart({ semanal = [], precioVentaKilo, onGuardarPrecio }) {
  const [sel, setSel] = useState(null);
  const datos = useMemo(() => semanal.slice(-8).map((s) => ({
    ...s,
    costoKg: Number(s.kg) > 0 ? Number(s.pago) / Number(s.kg) : 0,
  })), [semanal]);

  if (datos.length === 0 || datos.every((d) => !d.costoKg)) {
    return (
      <ChartCard title="Costo por kilo por semana" icon="pricetag-outline">
        <ChartEmptyState texto="Aún no hay suficientes datos de kilos y pagos para calcular el costo por kilo." />
      </ChartCard>
    );
  }

  const maxVal = Math.max(1, ...datos.map((d) => d.costoKg));
  const ultimo = datos[datos.length - 1];
  const anterior = datos[datos.length - 2];
  const flecha = anterior ? (ultimo.costoKg > anterior.costoKg ? '↑ subió' : ultimo.costoKg < anterior.costoKg ? '↓ bajó' : '— igual') : '';

  let analisis, tono = 'ok';
  if (!precioVentaKilo) {
    analisis = 'Ingresa el precio al que vendió el café este mes para ver cuánto le queda por kilo.';
    tono = 'alerta';
  } else {
    const margen = precioVentaKilo - ultimo.costoKg;
    analisis = `Esta semana cada kilo le costó ${formatMoney(Math.round(ultimo.costoKg))} en mano de obra. Como lo está vendiendo a ${formatMoney(precioVentaKilo)}, le quedan ${formatMoney(Math.round(margen))} por kilo.`;
    tono = margen > 0 ? 'ok' : 'riesgo';
  }

  return (
    <ChartCard title="Costo por kilo por semana" icon="pricetag-outline">
      <CampoConfigurable
        label="Precio de venta (mes)"
        value={precioVentaKilo}
        placeholder="Ej: 3200"
        sufijo="/kg"
        onGuardar={onGuardarPrecio}
      />
      <View style={styles.lineWrap}>
        {datos.map((d, i) => {
          const h = Math.max(4, Math.round((d.costoKg * 100) / maxVal));
          const activo = sel === i;
          return (
            <Tocable key={d.semana} onPress={() => setSel(activo ? null : i)} style={styles.lineCol}>
              <View style={styles.lineColInner}>
                <MotiView
                  from={{ opacity: 0, translateY: 8 }}
                  animate={{ opacity: 1, translateY: 0, bottom: `${h}%` }}
                  transition={{ type: 'timing', duration: 400, delay: i * 50 }}
                  style={[styles.point, activo && styles.pointActivo]}
                />
              </View>
              <Text style={styles.barLabel}>{fechaCorta(d.desde)}</Text>
            </Tocable>
          );
        })}
      </View>
      <ChartTooltip visible={sel != null}>
        {sel != null && (
          <>
            <TooltipLine label="Semana del" value={fechaCorta(datos[sel].desde)} />
            <TooltipLine label="Costo por kilo" value={formatMoney(Math.round(datos[sel].costoKg))} />
            {sel === datos.length - 1 && anterior && <TooltipLine label="Vs. semana anterior" value={flecha} />}
          </>
        )}
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono={tono} />
    </ChartCard>
  );
}

// ── 3) Rendimiento por trabajador ───────────────────────────────────────────
export function RendimientoTrabajadorChart({ topTrabajadores = [] }) {
  const [sel, setSel] = useState(null);
  const datos = useMemo(() => topTrabajadores
    .map((t) => ({
      ...t,
      kgPorJornal: Number(t.jornadas) > 0 ? Number(t.total_kg) / Number(t.jornadas) : 0,
      costoKg: Number(t.total_kg) > 0 ? Number(t.total_pagado) / Number(t.total_kg) : 0,
    }))
    .filter((t) => t.kgPorJornal > 0)
    .sort((a, b) => b.kgPorJornal - a.kgPorJornal)
    .slice(0, 8), [topTrabajadores]);

  if (datos.length === 0) {
    return (
      <ChartCard title="Rendimiento por trabajador" icon="people-outline">
        <ChartEmptyState texto="Aún no hay registros de kilos por trabajador para comparar rendimiento." />
      </ChartCard>
    );
  }

  const maxVal = Math.max(1, ...datos.map((t) => t.kgPorJornal));
  const mejor = datos[0];
  const peor = datos[datos.length - 1];
  const pctMasRentable = peor.kgPorJornal > 0 ? Math.round(((mejor.kgPorJornal - peor.kgPorJornal) * 100) / peor.kgPorJornal) : 0;
  const analisis = datos.length > 1
    ? `${mejor.nombre} rinde ${pctMasRentable}% más que ${peor.nombre} (${Math.round(mejor.kgPorJornal)} vs ${Math.round(peor.kgPorJornal)} kg por jornal).`
    : 'Todo bien esta semana, siga así.';

  return (
    <ChartCard title="Rendimiento por trabajador" icon="people-outline">
      <View style={{ gap: 10 }}>
        {datos.map((t, i) => {
          const pct = Math.max(4, Math.round((t.kgPorJornal * 100) / maxVal));
          const activo = sel === i;
          return (
            <Tocable key={t.trabajador_id || i} onPress={() => setSel(activo ? null : i)} style={{ width: '100%' }}>
              <View style={styles.hRowLabel}>
                <Text style={styles.hRowNombre} numberOfLines={1}>{t.nombre || 'Trabajador'}</Text>
                <Text style={styles.hRowValor}>{Math.round(t.kgPorJornal)} kg/jornal</Text>
              </View>
              <View style={styles.hTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'timing', duration: 500, delay: i * 60 }}
                  style={[styles.hFill, activo && { backgroundColor: CHART_COLORS.primaryDark }]}
                />
              </View>
            </Tocable>
          );
        })}
      </View>
      <ChartTooltip visible={sel != null}>
        {sel != null && (
          <>
            <TooltipLine label="Trabajador" value={datos[sel].nombre || '—'} />
            <TooltipLine label="Kg por jornal" value={`${Math.round(datos[sel].kgPorJornal)} kg`} />
            <TooltipLine label="Costo por kilo" value={formatMoney(Math.round(datos[sel].costoKg))} />
            <TooltipLine label="Total pagado" value={formatMoney(datos[sel].total_pagado)} />
            <TooltipLine label="Recontratar" value={datos[sel].kgPorJornal >= 50 ? 'Sí' : 'Revisar rendimiento antes de recontratar'} />
          </>
        )}
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono="ok" />
    </ChartCard>
  );
}

// ── 4) Rendimiento por lote (mapa de calor) ─────────────────────────────────
export function RendimientoLoteChart({ lotes = [] }) {
  const [sel, setSel] = useState(null);
  const datos = useMemo(() => lotes.map((l) => ({
    ...l,
    kgPorJornal: Number(l.jornales) > 0 ? Number(l.kg_total) / Number(l.jornales) : 0,
    costoPorHa: Number(l.hectareas) > 0 ? Number(l.costo_mano_obra) / Number(l.hectareas) : null,
  })), [lotes]);

  if (datos.length === 0) {
    return (
      <ChartCard title="Rendimiento por lote" icon="map-outline">
        <ChartEmptyState texto="Agrega los lotes de tu finca en Configuración para ver su rendimiento aquí." />
      </ChartCard>
    );
  }

  const totalHa = datos.reduce((s, l) => s + (Number(l.hectareas) || 1), 0) || 1;
  const bajoRendimiento = datos.filter((l) => l.jornales > 0 && l.kgPorJornal < 50);
  const analisis = bajoRendimiento.length > 0
    ? `${bajoRendimiento.map((l) => l.nombre).join(', ')} ${bajoRendimiento.length > 1 ? 'están' : 'está'} por debajo de 50 kg/jornal — revise si el café está disperso o muy pequeño.`
    : 'Todo bien esta semana, siga así.';

  return (
    <ChartCard title="Rendimiento por lote" icon="map-outline">
      <View style={styles.heatWrap}>
        {datos.map((l, i) => {
          const flex = Math.max(0.6, (Number(l.hectareas) || 1) / totalHa * datos.length);
          const t = l.jornales > 0 ? Math.min(1, l.kgPorJornal / 100) : 0;
          const color = l.jornales > 0 ? colorMaloBueno(t) : CHART_COLORS.grid;
          const activo = sel === i;
          return (
            <Tocable key={l.id} onPress={() => setSel(activo ? null : i)} style={[styles.heatCell, { flexGrow: flex, backgroundColor: color, borderWidth: activo ? 2 : 0, borderColor: CHART_COLORS.ink900 }]}>
              <Text style={styles.heatNombre} numberOfLines={1}>{l.nombre}</Text>
              <Text style={styles.heatValor}>{l.jornales > 0 ? `${Math.round(l.kgPorJornal)} kg/j` : 'Sin datos'}</Text>
            </Tocable>
          );
        })}
      </View>
      <ChartTooltip visible={sel != null}>
        {sel != null && (
          <>
            <TooltipLine label="Lote" value={datos[sel].nombre} />
            <TooltipLine label="Kg totales" value={`${Math.round(Number(datos[sel].kg_total)).toLocaleString()} kg`} />
            <TooltipLine label="Jornales" value={String(datos[sel].jornales)} />
            <TooltipLine label="Kg por jornal" value={`${Math.round(datos[sel].kgPorJornal)} kg`} />
            <TooltipLine label="Costo por hectárea" value={datos[sel].costoPorHa != null ? formatMoney(Math.round(datos[sel].costoPorHa)) : '—'} />
          </>
        )}
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono={bajoRendimiento.length > 0 ? 'riesgo' : 'ok'} />
    </ChartCard>
  );
}

// ── 5) Margen por kilo (dona armada con Views, sin SVG) ─────────────────────
const DONA_TICKS = 36;
export function MargenDonaChart({ semanal = [], precioVentaKilo }) {
  const [sel, setSel] = useState(null);
  const costoPromedio = useMemo(() => {
    const totalKg = semanal.reduce((s, w) => s + (Number(w.kg) || 0), 0);
    const totalPago = semanal.reduce((s, w) => s + (Number(w.pago) || 0), 0);
    return totalKg > 0 ? totalPago / totalKg : 0;
  }, [semanal]);

  if (!precioVentaKilo || !costoPromedio) {
    return (
      <ChartCard title="Margen por kilo" icon="pie-chart-outline">
        <ChartEmptyState texto="Configura el precio de venta en la gráfica de costo por kilo para ver su margen aquí." />
      </ChartCard>
    );
  }

  const margen = precioVentaKilo - costoPromedio;
  const pctMargen = Math.max(0, Math.round((margen * 100) / precioVentaKilo));
  const filled = Math.round((pctMargen / 100) * DONA_TICKS);
  const tono = pctMargen >= 50 && pctMargen <= 70 ? 'ok' : 'riesgo';
  const analisis = `Le están pagando ${formatMoney(precioVentaKilo)}. La mano de obra le cuesta ${formatMoney(Math.round(costoPromedio))}. Le quedan ${formatMoney(Math.round(margen))} (${pctMargen}%). Un margen saludable en café está entre 50% y 70%.`;

  return (
    <ChartCard title="Margen por kilo" icon="pie-chart-outline">
      <Tocable onPress={() => setSel(sel == null ? 0 : null)} style={styles.donaWrap}>
        {Array.from({ length: DONA_TICKS }).map((_, i) => {
          const angle = (360 / DONA_TICKS) * i;
          const activo = i < filled;
          return (
            <MotiView
              key={i}
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 300, delay: i * 10 }}
              style={[
                styles.donaTick,
                { transform: [{ rotate: `${angle}deg` }, { translateY: -54 }] },
                { backgroundColor: activo ? CHART_COLORS.primary : CHART_COLORS.terracota },
              ]}
            />
          );
        })}
        <View style={styles.donaCenter}>
          <Text style={styles.donaPct}>{pctMargen}%</Text>
          <Text style={styles.donaLabel}>margen</Text>
        </View>
      </Tocable>
      <ChartTooltip visible={sel != null}>
        <TooltipLine label="Precio de venta" value={formatMoney(precioVentaKilo)} />
        <TooltipLine label="Costo de mano de obra" value={formatMoney(Math.round(costoPromedio))} />
        <TooltipLine label="Le queda por kilo" value={formatMoney(Math.round(margen))} />
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono={tono} />
    </ChartCard>
  );
}

// ── 7) Comparativa entre fincas ─────────────────────────────────────────────
export function ComparativaFincasChart({ porFinca = [] }) {
  const [sel, setSel] = useState(null);
  if (porFinca.length <= 1) return null;

  const maxVal = Math.max(1, ...porFinca.map((f) => Number(f.pago) || 0));
  const [a, b] = porFinca;
  const diffPct = Number(b?.pago) > 0 ? Math.round(((Number(a.pago) - Number(b.pago)) * 100) / Number(b.pago)) : 0;
  const analisis = `${a.finca} ${diffPct >= 0 ? 'pagó' : 'pagó'} ${Math.abs(diffPct)}% ${diffPct >= 0 ? 'más' : 'menos'} que ${b.finca} este periodo.`;

  return (
    <ChartCard title="Comparativa entre fincas" icon="location-outline">
      <View style={{ gap: 10 }}>
        {porFinca.map((f, i) => {
          const pct = Math.max(4, Math.round((Number(f.pago) * 100) / maxVal));
          const activo = sel === i;
          return (
            <Tocable key={f.finca} onPress={() => setSel(activo ? null : i)} style={{ width: '100%' }}>
              <View style={styles.hRowLabel}>
                <Text style={styles.hRowNombre} numberOfLines={1}>{f.finca}</Text>
                <Text style={styles.hRowValor}>{formatMoney(f.pago)}</Text>
              </View>
              <View style={styles.hTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'timing', duration: 500, delay: i * 60 }}
                  style={[styles.hFill, activo && { backgroundColor: CHART_COLORS.primaryDark }]}
                />
              </View>
            </Tocable>
          );
        })}
      </View>
      <ChartTooltip visible={sel != null}>
        {sel != null && (
          <>
            <TooltipLine label="Finca" value={porFinca[sel].finca} />
            <TooltipLine label="Pagado" value={formatMoney(porFinca[sel].pago)} />
            <TooltipLine label="Jornadas" value={String(porFinca[sel].jornadas)} />
          </>
        )}
      </ChartTooltip>
      <AnalisisCard texto={analisis} tono="ok" />
    </ChartCard>
  );
}

// ── Rendimiento por cultivo ──────────────────────────────────────────────
const TONOS = { bien: CHART_COLORS.primary, alerta: CHART_COLORS.terracota, critico: '#C0392B' };
// Colores relativos al promedio del propio grupo de cultivos — no hay
// benchmark absoluto de costo/kg (varía demasiado entre café, plátano, etc).
function tonoRelativo(valor, promedio, invertido) {
  if (!promedio) return 'bien';
  const ratio = valor / promedio;
  const malo = invertido ? ratio < 0.85 : ratio > 1.15;
  const medio = invertido ? ratio < 1 : ratio > 1;
  if (malo) return 'critico';
  if (medio) return 'alerta';
  return 'bien';
}

export function RendimientoCultivoSection({ cultivos = [], jornadasSinCultivo = 0, onGuardarPrecioCultivo }) {
  const [filtro, setFiltro] = useState('todos');
  const [sel, setSel] = useState(null);

  const datos = useMemo(() => cultivos.map((c) => ({
    ...c,
    costoManoObraKg: Number(c.kg_total) > 0 ? Number(c.pago_recoleccion_total) / Number(c.kg_total) : 0,
    kgPorHora: Number(c.horas_total) > 0 ? Number(c.kg_total) / Number(c.horas_total) : 0,
    margenKg: c.precio_venta_kilo != null && Number(c.kg_total) > 0
      ? Number(c.precio_venta_kilo) - (Number(c.pago_recoleccion_total) / Number(c.kg_total)) : null,
  })), [cultivos]);

  if (datos.length === 0) {
    return (
      <ChartCard title="Rendimiento por cultivo" icon="leaf-outline">
        <ChartEmptyState texto="Aún no hay registros de recolección con cultivo asignado en este periodo." />
      </ChartCard>
    );
  }

  const promedioCosto = datos.reduce((s, c) => s + c.costoManoObraKg, 0) / datos.length;
  const visibles = filtro === 'todos' ? datos : datos.filter((c) => c.cultivo === filtro);
  const cultivoSel = sel != null ? visibles[sel] : null;
  const maxCosto = Math.max(1, ...datos.map((c) => c.costoManoObraKg));
  const maxCosecha = Math.max(1, ...datos.map((c) => Number(c.costo_cosecha_total) || 0));

  return (
    <ChartCard title="Rendimiento por cultivo" icon="leaf-outline">
      <View style={[styles.wrapRow, { marginBottom: 12 }]}>
        <Tocable onPress={() => setFiltro('todos')} style={[styles.filtroChip, filtro === 'todos' && styles.filtroChipActivo]}>
          <Text style={[styles.filtroChipText, filtro === 'todos' && styles.filtroChipTextActivo]}>Todos</Text>
        </Tocable>
        {datos.map((c) => (
          <Tocable key={c.cultivo} onPress={() => setFiltro(c.cultivo)} style={[styles.filtroChip, filtro === c.cultivo && styles.filtroChipActivo]}>
            <Text style={[styles.filtroChipText, filtro === c.cultivo && styles.filtroChipTextActivo]}>{c.cultivo}</Text>
          </Tocable>
        ))}
      </View>

      {jornadasSinCultivo > 0 && (
        <AnalisisCard
          texto={`${jornadasSinCultivo} registro${jornadasSinCultivo > 1 ? 's' : ''} de recolección sin cultivo asignado en este periodo — no se cuentan en estas cifras.`}
          tono="alerta"
        />
      )}

      {/* Comparativa de costo por kg entre cultivos */}
      <Text style={styles.cultivoSubtitulo}>Costo de mano de obra por kg</Text>
      <View style={{ gap: 10, marginTop: 6 }}>
        {visibles.map((c, i) => {
          const pct = Math.max(4, Math.round((c.costoManoObraKg * 100) / maxCosto));
          const tono = tonoRelativo(c.costoManoObraKg, promedioCosto, false);
          const activo = sel === i;
          return (
            <Tocable key={c.cultivo} onPress={() => setSel(activo ? null : i)} style={{ width: '100%' }}>
              <View style={styles.hRowLabel}>
                <Text style={styles.hRowNombre} numberOfLines={1}>{c.cultivo}</Text>
                <Text style={styles.hRowValor}>{formatMoney(Math.round(c.costoManoObraKg))}/kg</Text>
              </View>
              <View style={styles.hTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'timing', duration: 500, delay: i * 60 }}
                  style={[styles.hFill, { backgroundColor: TONOS[tono] }]}
                />
              </View>
            </Tocable>
          );
        })}
      </View>

      {/* Costo total de cosecha por cultivo */}
      <Text style={[styles.cultivoSubtitulo, { marginTop: 16 }]}>Costo total de cosecha</Text>
      <View style={{ gap: 10, marginTop: 6 }}>
        {visibles.map((c) => {
          const pct = Math.max(4, Math.round(((Number(c.costo_cosecha_total) || 0) * 100) / maxCosecha));
          return (
            <View key={c.cultivo}>
              <View style={styles.hRowLabel}>
                <Text style={styles.hRowNombre} numberOfLines={1}>{c.cultivo}</Text>
                <Text style={styles.hRowValor}>{formatMoney(c.costo_cosecha_total)}</Text>
              </View>
              <View style={styles.hTrack}>
                <MotiView
                  from={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'timing', duration: 500 }}
                  style={[styles.hFill, { backgroundColor: CHART_COLORS.primaryDark }]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {cultivoSel && (
        <>
          <Text style={[styles.cultivoSubtitulo, { marginTop: 16 }]}>{cultivoSel.cultivo} — detalle</Text>
          <CampoConfigurable
            label={`Precio de venta — ${cultivoSel.cultivo}`}
            value={cultivoSel.precio_venta_kilo}
            placeholder="Ej: 2600"
            sufijo="/kg"
            onGuardar={(v) => onGuardarPrecioCultivo?.(cultivoSel.cultivo, v)}
          />
          <View style={styles.grid3}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Costo/kg</Text>
              <Text style={styles.miniStatValor}>{formatMoney(Math.round(cultivoSel.costoManoObraKg))}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Kg/hora</Text>
              <Text style={styles.miniStatValor}>{cultivoSel.kgPorHora.toFixed(1)}</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatLabel}>Margen/kg</Text>
              <Text style={[styles.miniStatValor, cultivoSel.margenKg != null && { color: cultivoSel.margenKg > 0 ? CHART_COLORS.primary : '#C0392B' }]}>
                {cultivoSel.margenKg != null ? formatMoney(Math.round(cultivoSel.margenKg)) : '—'}
              </Text>
            </View>
          </View>

          <Text style={[styles.cultivoSubtitulo, { marginTop: 14 }]}>Ranking de trabajadores</Text>
          {(cultivoSel.trabajadores || []).length === 0 ? (
            <Text style={styles.rankingVacio}>Sin trabajadores registrados en este cultivo.</Text>
          ) : (
            <View style={{ marginTop: 6 }}>
              {[...cultivoSel.trabajadores].sort((a, b) => Number(b.kg) - Number(a.kg)).map((t, i) => (
                <View key={t.trabajador_id || i} style={styles.rankingRow}>
                  <Text style={styles.rankingPos}>{i + 1}</Text>
                  <Text style={styles.rankingNombre} numberOfLines={1}>{t.nombre}</Text>
                  <Text style={styles.rankingKg}>{Math.round(Number(t.kg)).toLocaleString()} kg</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6, marginTop: 4, position: 'relative' },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: CHART_COLORS.primary, minHeight: 4 },
  barLabel: { fontSize: 9, color: CHART_COLORS.axis, fontWeight: '700', marginTop: 4 },
  metaLine: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: CHART_COLORS.terracota, zIndex: 2 },
  lineWrap: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6, marginTop: 4 },
  lineCol: { flex: 1, alignItems: 'center', height: '100%' },
  lineColInner: { flex: 1, width: '100%', position: 'relative' },
  point: { position: 'absolute', left: '50%', marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: CHART_COLORS.primary },
  pointActivo: { backgroundColor: CHART_COLORS.primaryDark, width: 13, height: 13, borderRadius: 7, marginLeft: -6.5 },
  hRowLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  hRowNombre: { fontSize: 12, fontWeight: '600', color: CHART_COLORS.ink700, flex: 1 },
  hRowValor: { fontSize: 12, fontWeight: '700', color: CHART_COLORS.ink900 },
  hTrack: { height: 10, borderRadius: 999, backgroundColor: CHART_COLORS.grid, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 999, backgroundColor: CHART_COLORS.primary },
  heatWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 90 },
  heatCell: { minWidth: 90, minHeight: 80, borderRadius: 10, padding: 8, justifyContent: 'flex-end' },
  heatNombre: { fontSize: 11, fontWeight: '800', color: '#fff' },
  heatValor: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  donaWrap: { width: 160, height: 160, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  donaTick: { position: 'absolute', width: 8, height: 16, borderRadius: 3 },
  donaCenter: { alignItems: 'center' },
  donaPct: { fontSize: 24, fontWeight: '900', color: CHART_COLORS.ink900 },
  donaLabel: { fontSize: 11, color: CHART_COLORS.ink500, fontWeight: '600' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: CHART_COLORS.grid },
  filtroChipActivo: { backgroundColor: CHART_COLORS.primary },
  filtroChipText: { fontSize: 12, fontWeight: '700', color: CHART_COLORS.ink700 },
  filtroChipTextActivo: { color: '#fff' },
  cultivoSubtitulo: { fontSize: 12, fontWeight: '800', color: CHART_COLORS.ink500, textTransform: 'uppercase' },
  grid3: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniStat: { flex: 1, backgroundColor: CHART_COLORS.grid, borderRadius: 10, padding: 10, alignItems: 'center' },
  miniStatLabel: { fontSize: 10, color: CHART_COLORS.ink500, fontWeight: '700' },
  miniStatValor: { fontSize: 13, color: CHART_COLORS.ink900, fontWeight: '900', marginTop: 2 },
  rankingVacio: { fontSize: 12, color: CHART_COLORS.ink400, marginTop: 6 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: CHART_COLORS.line },
  rankingPos: { width: 20, fontSize: 12, fontWeight: '900', color: CHART_COLORS.ink400 },
  rankingNombre: { flex: 1, fontSize: 13, fontWeight: '600', color: CHART_COLORS.ink700 },
  rankingKg: { fontSize: 12, fontWeight: '700', color: CHART_COLORS.ink900 },
});
