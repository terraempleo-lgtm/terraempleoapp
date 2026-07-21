import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { finanzasAPI, cuadernoAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';
import Avatar from '../shared/Avatar';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
  // Tokens del rediseño de tarjetas de Rendimiento
  surface2: '#F2F4EE', border: '#e4e6de', textPrimary: '#171a15', textSecondary: '#6b7060',
  terracota: '#C0652A',
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const num = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const keyMov = (conceptoId, semanaId) => `${conceptoId}:${semanaId ?? 'mes'}`;

// Badges: solo 3 estados posibles, colores fijos por el rediseño.
const BADGE = {
  bien: { bg: '#EAF3DE', fg: '#27500A', label: 'Bien' },
  revisar: { bg: '#FAEEDA', fg: '#633806', label: 'Revisar' },
  alerta: { bg: '#FCEBEB', fg: '#791F1F', label: 'Alerta' },
};

function procesarMes(tableroData, jornaladas, trabajadoresAgg, kgTotal) {
  const semanas = tableroData?.semanas || [];
  const conceptos = tableroData?.conceptos || [];
  const resumen = tableroData?.resumen || {};
  const periodo = tableroData?.periodo || {};
  const valores = {};
  for (const m of tableroData?.movimientos || []) valores[keyMov(m.concepto_id, m.semana_id)] = Number(m.monto) || 0;

  const totalConcepto = (c) => (c.tipo === 'factura' ? (valores[keyMov(c.id, null)] || 0) : semanas.reduce((acc, s) => acc + (valores[keyMov(c.id, s.id)] || 0), 0));
  const totalSemanaTipo = (tipo, semanaId) => conceptos.filter((c) => c.tipo === tipo).reduce((acc, c) => acc + (valores[keyMov(c.id, semanaId)] || 0), 0);
  const totalTipo = (tipo) => conceptos.filter((c) => c.tipo === tipo).reduce((acc, c) => acc + totalConcepto(c), 0);

  const ingresos = conceptos.filter((c) => c.tipo === 'ingreso');
  const totalVentas = ingresos.reduce((acc, c) => acc + totalConcepto(c), 0);
  const cultivos = ingresos.map((c) => ({ nombre: c.nombre, ventas: totalConcepto(c), pct: totalVentas > 0 ? (totalConcepto(c) / totalVentas) * 100 : 0 })).sort((a, b) => b.ventas - a.ventas);

  const nominaTotal = Number(resumen.total_nomina || 0) + totalTipo('nomina');
  const gastoFijo = Number(resumen.total_gastos_fijos || 0);
  const gastoVariable = Number(resumen.total_gastos_variables || 0);
  const totalGastos = nominaTotal + gastoFijo + gastoVariable;

  const costoMedioJornal = jornaladas > 0 ? nominaTotal / jornaladas : 0;
  const roiPersonal = nominaTotal > 0 ? totalVentas / nominaTotal : 0;
  const semanasConVenta = semanas.filter((s) => totalSemanaTipo('ingreso', s.id) > 0).length;
  const mayorCultivo = cultivos[0] || null;
  const balance = totalVentas - totalGastos;

  const costoPorKg = kgTotal > 0 ? nominaTotal / kgTotal : null;
  const precioVentaKilo = periodo.precio_venta_kilo != null ? Number(periodo.precio_venta_kilo) : null;
  const ingresoPorKilo = precioVentaKilo != null && costoPorKg != null ? precioVentaKilo - costoPorKg : null;

  const mayorGasto = [
    { nombre: 'Nómina', valor: nominaTotal },
    { nombre: 'Gastos fijos', valor: gastoFijo },
    { nombre: 'Gastos variables', valor: gastoVariable },
  ].sort((a, b) => b.valor - a.valor)[0];
  const mayorGastoPct = totalGastos > 0 && mayorGasto ? (mayorGasto.valor / totalGastos) * 100 : 0;

  return {
    semanas, totalVentas, nominaTotal, gastoFijo, gastoVariable, totalGastos, jornaladas,
    costoMedioJornal, roiPersonal, semanasConVenta, cultivos, mayorCultivo, balance,
    trabajadores: trabajadoresAgg || [], kgTotal, costoPorKg, precioVentaKilo, ingresoPorKilo,
    mayorGasto, mayorGastoPct,
  };
}

// Diferencia en pesos vs. mes anterior — los finqueros entienden pesos, no
// porcentajes. `favorableSiSube` decide el color/flecha (para nómina, que
// baje es lo bueno).
function DeltaPesos({ actual, anterior, favorableSiSube = true }) {
  if (actual == null || anterior == null || !(Math.abs(anterior) > 0)) return null;
  const diff = actual - anterior;
  if (Math.abs(diff) < 1) return null;
  const subio = diff > 0;
  const bueno = subio === favorableSiSube;
  const color = bueno ? COLORS.primary : COLORS.terracota;
  const icon = subio ? 'arrow-up' : 'arrow-down';
  return (
    <View style={[styles.rowStart, { marginTop: 6 }]}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.deltaText, { color }]}>  {subio ? 'Subió' : 'Bajó'} {formatMoney(Math.abs(diff))} frente al mes pasado</Text>
    </View>
  );
}

export default function RendimientoScreen({ navigation }) {
  const { activeFinca, activeFincaId } = useFinca();
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [actual, setActual] = useState(null);
  const [anterior, setAnterior] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarMes = useCallback(async (a, m) => {
    const r = await finanzasAPI.tablero({ finca_id: activeFincaId, anio: a, mes: m });
    const semanas = r.data?.semanas || [];
    let jornaladas = 0;
    let kgTotal = 0;
    const porTrabajador = new Map();
    try {
      const porSemana = await Promise.all(semanas.map((s) => cuadernoAPI.nomina({ desde: s.fecha_inicio, hasta: s.fecha_fin }).catch(() => null)));
      for (const resp of porSemana) {
        for (const f of (resp?.data?.filas || [])) {
          jornaladas += Number(f.dias) || 0;
          kgTotal += Number(f.total_kg) || 0;
          const key = f.key || f.nombre;
          const prev = porTrabajador.get(key) || { nombre: f.nombre, foto: f.foto, dias: 0, kg: 0, neto: 0 };
          prev.dias += Number(f.dias) || 0; prev.kg += Number(f.total_kg) || 0; prev.neto += Number(f.neto) || 0;
          porTrabajador.set(key, prev);
        }
      }
    } catch { /* usa lo que se alcanzó a sumar */ }
    return { tableroData: r.data, jornaladas, kgTotal, trabajadoresAgg: Array.from(porTrabajador.values()) };
  }, [activeFincaId]);

  const cargar = useCallback(() => {
    if (!activeFincaId) return;
    setLoading(true);
    let mesAnt = mes - 1, anioAnt = anio;
    if (mesAnt < 1) { mesAnt = 12; anioAnt -= 1; }
    Promise.all([cargarMes(anio, mes), cargarMes(anioAnt, mesAnt)])
      .then(([act, ant]) => {
        setActual(procesarMes(act.tableroData, act.jornaladas, act.trabajadoresAgg, act.kgTotal));
        setAnterior(procesarMes(ant.tableroData, ant.jornaladas, ant.trabajadoresAgg, ant.kgTotal));
      })
      .catch((e) => console.error('rendimiento:', e))
      .finally(() => setLoading(false));
  }, [activeFincaId, anio, mes, cargarMes]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const cambiarMes = (d) => {
    let m = mes + d, a = anio;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setMes(m); setAnio(a);
  };

  // Tarjeta 1 — Ingreso por kilo: solo si hay precio configurado y más de
  // un cultivo activo con ventas.
  const mostrarIngresoKilo = (actual?.cultivos?.length || 0) > 1;

  // Tarjeta 3 — Por cada $1.000 en jornales
  const nivelRoi = useMemo(() => (actual?.roiPersonal >= 2 ? 'bien' : 'revisar'), [actual]);

  // Tarjeta 4 — Semanas que vendió: bien 4-5, revisar 2-3, alerta 0-1
  const nivelConsistencia = useMemo(() => {
    if (!actual?.semanas?.length) return null;
    const n = actual.semanasConVenta;
    if (n >= 4) return 'bien';
    if (n >= 2) return 'revisar';
    return 'alerta';
  }, [actual]);

  // Tarjeta 6 — Balance del mes
  const nivelBalance = useMemo(() => (!actual ? null : actual.balance >= 0 ? 'bien' : 'alerta'), [actual]);

  const ranking = useMemo(() => {
    if (!actual?.trabajadores) return [];
    return [...actual.trabajadores].map((t) => ({ ...t, costoKg: t.kg > 0 ? t.neto / t.kg : null }))
      .sort((a, b) => {
        if (a.costoKg == null && b.costoKg == null) return b.neto - a.neto;
        if (a.costoKg == null) return 1;
        if (b.costoKg == null) return -1;
        return a.costoKg - b.costoKg;
      });
  }, [actual]);

  if (loading && !actual) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <CuadernoTopNav navigation={navigation} activeKey="RendimientoHome" />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="RendimientoHome" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.rowBetween}>
          <View style={styles.rowStart}>
            <View style={styles.headerIcon}><Ionicons name="pulse" size={20} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.h1}>Rendimiento</Text>
              <Text style={styles.subtitle}>{activeFinca?.nombre || 'Finca'} · salud del negocio</Text>
            </View>
          </View>
          <View style={styles.monthNav}>
            <Pressable onPress={() => cambiarMes(-1)} style={{ padding: 6 }}><Ionicons name="chevron-back" size={16} color={COLORS.ink700} /></Pressable>
            <Text style={styles.monthLabel}>{MESES[mes - 1]} {anio}</Text>
            <Pressable onPress={() => cambiarMes(1)} style={{ padding: 6 }}><Ionicons name="chevron-forward" size={16} color={COLORS.ink700} /></Pressable>
          </View>
        </View>

        <View style={styles.grid2}>
          {/* Tarjeta 1 — Ingreso por kilo este mes */}
          {mostrarIngresoKilo && actual?.precioVentaKilo == null ? (
            <MetricaCard icon="pricetag-outline" titulo="Ingreso por kilo este mes">
              <Text style={styles.avisoText}>Configure el precio de venta para ver esta métrica.</Text>
            </MetricaCard>
          ) : mostrarIngresoKilo && actual?.ingresoPorKilo != null ? (
            <MetricaCard icon="pricetag-outline" titulo="Ingreso por kilo este mes"
              valor={formatMoney(actual.ingresoPorKilo)}
              detalle={`Por cada kilo que vende le quedan ${formatMoney(actual.ingresoPorKilo)} después de pagar jornales.`}
            />
          ) : null}

          {/* Tarjeta 2 — Cuánto le cuesta cada jornal */}
          <MetricaCard icon="wallet-outline" titulo="Cuánto le cuesta cada jornal"
            valor={actual?.jornaladas > 0 ? formatMoney(actual.costoMedioJornal) : '—'}
            detalle={actual?.jornaladas > 0 ? `Este mes pagó ${num(actual.jornaladas)} jornales con un costo promedio de ${formatMoney(actual.costoMedioJornal)} cada uno.` : 'Aún no hay jornales pagados este mes.'}
          >
            <DeltaPesos actual={actual?.costoMedioJornal} anterior={anterior?.costoMedioJornal} favorableSiSube={false} />
          </MetricaCard>

          {/* Tarjeta 3 — Por cada $1.000 en jornales */}
          <MetricaCard icon="trending-up-outline" titulo="Por cada $1.000 invertido en personal"
            badge={actual?.nominaTotal > 0 ? BADGE[nivelRoi] : null}
            valor={actual?.nominaTotal > 0 ? formatMoney(Math.round(actual.roiPersonal * 1000)) : '—'}
            detalle={actual?.nominaTotal > 0 ? `Este mes la nómina generó ${num(actual.roiPersonal)} veces su valor en ventas.` : 'Aún no hay ventas o nómina este mes.'}
          />

          {/* Tarjeta 4 — Semanas que vendió este mes */}
          <MetricaCard icon="calendar-outline" titulo="Semanas que vendió este mes"
            badge={nivelConsistencia ? BADGE[nivelConsistencia] : null}
            valor={actual?.semanas?.length ? `${actual.semanasConVenta} de ${actual.semanas.length} semanas` : '—'}
            detalle={
              !actual?.semanas?.length ? 'Aún no hay semanas registradas este mes.'
              : actual.semanasConVenta >= 4
                ? 'Vendió todas las semanas del mes — buen flujo de caja.'
                : `Tuvo ${actual.semanas.length - actual.semanasConVenta} semana(s) sin registrar ventas. Si tiene café listo para vender, puede estar dejando dinero sin cobrar.`
            }
          />

          {/* Tarjeta 5 — Su mayor gasto este mes */}
          {actual?.mayorGasto && actual.mayorGasto.valor > 0 && (
            <MetricaCard icon="bar-chart-outline" titulo={actual.mayorGasto.nombre.toUpperCase()}
              valor={formatMoney(actual.mayorGasto.valor)}
              detalle={
                `${actual.mayorGasto.nombre} representó el ${num(actual.mayorGastoPct)}% de sus gastos totales este mes.`
                + (actual.mayorGastoPct > 60 ? ' Eso es alto para un mes de cosecha — normal. En meses sin cosecha debería bajar.' : '')
              }
            />
          )}

          {/* Tarjeta 6 — Lo que le sobró este mes */}
          <MetricaCard icon="shield-checkmark-outline" titulo="Lo que le sobró este mes"
            badge={nivelBalance ? BADGE[nivelBalance] : null}
            valor={actual ? formatMoney(actual.balance) : '—'}
            detalle={
              !actual ? ''
              : actual.balance >= 0
                ? `Después de pagar jornales y gastos le sobraron ${formatMoney(actual.balance)}.`
                : `Este mes los gastos superaron las ventas por ${formatMoney(Math.abs(actual.balance))}.`
            }
          >
            <DeltaPesos actual={actual?.balance} anterior={anterior?.balance} favorableSiSube />
          </MetricaCard>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Ventas por cultivo</Text>
          {!actual?.cultivos?.length ? <Text style={styles.emptyText}>Aún no hay ventas registradas este mes en Finanzas.</Text> : (
            actual.cultivos.map((c) => (
              <View key={c.nombre} style={{ marginTop: 8 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.barLabel}>{c.nombre}</Text>
                  <Text style={styles.barValue}>{formatMoney(c.ventas)} · {num(c.pct)}%</Text>
                </View>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${c.pct}%`, backgroundColor: c.pct >= 60 ? COLORS.warning : COLORS.primary }]} /></View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Trabajadores más rentables</Text>
          <Text style={styles.cardHint}>Menor costo por kilo producido primero.</Text>
          {ranking.length === 0 ? <Text style={styles.emptyText}>Aún no hay jornadas registradas este mes.</Text> : (
            ranking.map((t, i) => (
              <View key={t.nombre + i} style={styles.rankRow}>
                <Avatar src={t.foto} name={t.nombre} size={26} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.rankNombre}>{t.nombre}{i < 3 && t.costoKg != null ? ' 🏅' : ''}</Text>
                  <Text style={styles.rankMeta}>{t.dias} días · {num(t.kg)} kg</Text>
                </View>
                <Text style={styles.rankCosto}>{t.costoKg != null ? formatMoney(t.costoKg) : '—'}</Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footNote}>
          Estos indicadores se calculan con lo que ya registras en Finanzas y en el Cuaderno — no necesitas anotar nada extra.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Tarjeta de métrica rediseñada: ícono en círculo 36px (bg tenue del color
// del badge), label uppercase, número 26px/500, descripción, badge opcional
// y children para la comparación en pesos vs. mes anterior.
function MetricaCard({ icon, titulo, valor, detalle, badge, children }) {
  const iconBg = badge ? badge.bg : COLORS.lineLight;
  const iconFg = badge ? badge.fg : COLORS.ink500;
  return (
    <View style={styles.metricaCard}>
      <View style={styles.rowBetween}>
        <View style={[styles.metricaIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={16} color={iconFg} /></View>
        {badge && (
          <View style={[styles.nivelBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.nivelBadgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <Text style={styles.metricaTitulo}>{titulo}</Text>
      {valor != null && <Text style={styles.metricaValor}>{valor}</Text>}
      {!!detalle && <Text style={styles.metricaDetalle}>{detalle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 12, color: COLORS.ink500 },
  monthNav: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12 },
  monthLabel: { fontWeight: '700', color: COLORS.ink900, fontSize: 12, minWidth: 90, textAlign: 'center' },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  metricaCard: {
    width: '47%', backgroundColor: COLORS.surface2, borderWidth: 0.5, borderColor: COLORS.border,
    borderRadius: 12, padding: 14,
  },
  metricaIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  metricaTitulo: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 10 },
  metricaValor: { fontSize: 26, fontWeight: '500', color: COLORS.textPrimary, marginTop: 4 },
  metricaDetalle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 18 },
  avisoText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 10, lineHeight: 18, fontStyle: 'italic' },
  nivelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  nivelBadgeText: { fontSize: 10, fontWeight: '800' },
  deltaText: { fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { fontWeight: '800', fontSize: 14, color: COLORS.ink900 },
  cardHint: { fontSize: 11, color: COLORS.ink500, marginTop: 2, marginBottom: 4 },
  emptyText: { fontSize: 12, color: COLORS.ink400, marginTop: 6 },
  barLabel: { fontSize: 12, fontWeight: '600', color: COLORS.ink700 },
  barValue: { fontSize: 12, fontWeight: '700', color: COLORS.ink900 },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: COLORS.lineLight, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 999 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.lineLight },
  rankNombre: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  rankMeta: { fontSize: 11, color: COLORS.ink500 },
  rankCosto: { fontWeight: '900', color: COLORS.ink900, fontSize: 13 },
  footNote: { fontSize: 11, color: COLORS.ink400, marginTop: 16 },
});
