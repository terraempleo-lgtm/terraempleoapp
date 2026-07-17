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
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const num = (n) => Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const keyMov = (conceptoId, semanaId) => `${conceptoId}:${semanaId ?? 'mes'}`;

const NIVEL = {
  bien: { color: COLORS.primary, soft: COLORS.primarySoft, icon: 'checkmark-circle', label: 'Bien' },
  regular: { color: COLORS.warning, soft: COLORS.warningSoft, icon: 'alert-circle', label: 'Atención' },
  alerta: { color: COLORS.danger, soft: COLORS.dangerSoft, icon: 'warning', label: 'Alerta' },
  sinDatos: { color: COLORS.ink500, soft: COLORS.lineLight, icon: 'help-circle', label: 'Sin datos' },
};

function procesarMes(tableroData, jornaladas, trabajadoresAgg) {
  const semanas = tableroData?.semanas || [];
  const conceptos = tableroData?.conceptos || [];
  const resumen = tableroData?.resumen || {};
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

  const costoMedioJornal = jornaladas > 0 ? nominaTotal / jornaladas : 0;
  const roiPersonal = nominaTotal > 0 ? totalVentas / nominaTotal : 0;
  const semanasConVenta = semanas.filter((s) => totalSemanaTipo('ingreso', s.id) > 0).length;
  const relacionGastos = gastoFijo > 0 ? gastoVariable / gastoFijo : null;
  const mayorCultivo = cultivos[0] || null;
  const balance = totalVentas - (nominaTotal + gastoFijo + gastoVariable);

  return { semanas, totalVentas, nominaTotal, gastoFijo, gastoVariable, jornaladas, costoMedioJornal, roiPersonal, semanasConVenta, relacionGastos, cultivos, mayorCultivo, balance, trabajadores: trabajadoresAgg || [] };
}

function delta(actual, anterior) {
  if (!(anterior > 0)) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  return { pct, subio: pct > 0.5, bajo: pct < -0.5 };
}

function DeltaTag({ d, favorableSiSube = true }) {
  if (!d) return null;
  const neutro = !d.subio && !d.bajo;
  const bueno = neutro ? null : (d.subio === favorableSiSube);
  const icon = neutro ? 'remove' : d.subio ? 'trending-up' : 'trending-down';
  const color = neutro ? COLORS.ink400 : bueno ? COLORS.primary : COLORS.danger;
  return (
    <View style={styles.rowStart}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[styles.deltaText, { color }]}>  {num(Math.abs(d.pct))}% vs. mes pasado</Text>
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
    const porTrabajador = new Map();
    try {
      const porSemana = await Promise.all(semanas.map((s) => cuadernoAPI.nomina({ desde: s.fecha_inicio, hasta: s.fecha_fin }).catch(() => null)));
      for (const resp of porSemana) {
        for (const f of (resp?.data?.filas || [])) {
          jornaladas += Number(f.dias) || 0;
          const key = f.key || f.nombre;
          const prev = porTrabajador.get(key) || { nombre: f.nombre, foto: f.foto, dias: 0, kg: 0, neto: 0 };
          prev.dias += Number(f.dias) || 0; prev.kg += Number(f.total_kg) || 0; prev.neto += Number(f.neto) || 0;
          porTrabajador.set(key, prev);
        }
      }
    } catch { /* usa lo que se alcanzó a sumar */ }
    return { tableroData: r.data, jornaladas, trabajadoresAgg: Array.from(porTrabajador.values()) };
  }, [activeFincaId]);

  const cargar = useCallback(() => {
    if (!activeFincaId) return;
    setLoading(true);
    let mesAnt = mes - 1, anioAnt = anio;
    if (mesAnt < 1) { mesAnt = 12; anioAnt -= 1; }
    Promise.all([cargarMes(anio, mes), cargarMes(anioAnt, mesAnt)])
      .then(([act, ant]) => {
        setActual(procesarMes(act.tableroData, act.jornaladas, act.trabajadoresAgg));
        setAnterior(procesarMes(ant.tableroData, ant.jornaladas, ant.trabajadoresAgg));
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

  const nivelDependencia = useMemo(() => {
    if (!actual?.mayorCultivo) return 'sinDatos';
    const pct = actual.mayorCultivo.pct;
    return pct >= 60 ? 'alerta' : pct >= 40 ? 'regular' : 'bien';
  }, [actual]);
  const nivelRoi = useMemo(() => {
    if (!actual?.nominaTotal) return 'sinDatos';
    if (actual.roiPersonal >= 2) return 'bien';
    if (actual.roiPersonal >= 1) return 'regular';
    return 'alerta';
  }, [actual]);
  const nivelConsistencia = useMemo(() => {
    if (!actual?.semanas?.length) return 'sinDatos';
    const pct = actual.semanasConVenta / actual.semanas.length;
    return pct === 1 ? 'bien' : pct >= 0.5 ? 'regular' : 'alerta';
  }, [actual]);
  const deltaCostoJornal = useMemo(() => delta(actual?.costoMedioJornal, anterior?.costoMedioJornal), [actual, anterior]);
  const nivelCostoJornal = useMemo(() => {
    if (!actual?.jornaladas) return 'sinDatos';
    if (!deltaCostoJornal) return 'bien';
    if (deltaCostoJornal.pct > 15) return 'alerta';
    if (deltaCostoJornal.pct > 5) return 'regular';
    return 'bien';
  }, [actual, deltaCostoJornal]);
  const nivelBalance = useMemo(() => (!actual ? 'sinDatos' : actual.balance >= 0 ? 'bien' : 'alerta'), [actual]);

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

  const recomendaciones = useMemo(() => {
    if (!actual) return [];
    const r = [];
    if (nivelDependencia === 'alerta') r.push({ color: COLORS.warning, texto: `Dependes en ${num(actual.mayorCultivo.pct)}% de un solo cultivo (${actual.mayorCultivo.nombre}). Considera diversificar.` });
    if (nivelRoi === 'alerta') r.push({ color: COLORS.danger, texto: 'Estás generando menos de lo que gastas en nómina. Revisa precios de venta o el costo del jornal/kilo.' });
    else if (nivelRoi === 'regular') r.push({ color: COLORS.warning, texto: 'El retorno por peso invertido en personal es apenas positivo.' });
    if (nivelCostoJornal === 'alerta') r.push({ color: COLORS.danger, texto: `El costo por jornal subió ${num(deltaCostoJornal.pct)}% respecto al mes pasado.` });
    if (nivelConsistencia === 'alerta') r.push({ color: COLORS.warning, texto: 'Solo vendiste en algunas semanas del mes. Vender más seguido ayuda al flujo de caja.' });
    if (nivelBalance === 'alerta') r.push({ color: COLORS.danger, texto: 'Este mes gastaste más de lo que vendiste. Revisa el detalle de gastos en Finanzas.' });
    if (r.length === 0) r.push({ color: COLORS.primary, texto: 'Este mes los indicadores principales están en buen rango. Sigue así.' });
    return r;
  }, [actual, nivelDependencia, nivelRoi, nivelCostoJornal, nivelConsistencia, nivelBalance, deltaCostoJornal]);

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

        <View style={{ marginTop: 14, gap: 6 }}>
          {recomendaciones.map((r, i) => (
            <View key={i} style={styles.recoBox}>
              <View style={[styles.recoDot, { backgroundColor: r.color }]} />
              <Text style={styles.recoText}>{r.texto}</Text>
            </View>
          ))}
        </View>

        <View style={styles.grid2}>
          <IndicadorCard icon="pie-chart-outline" nivel={nivelDependencia} titulo="Dependencia de cultivo"
            valor={actual?.mayorCultivo ? `${num(actual.mayorCultivo.pct)}%` : '—'}
            detalle={actual?.mayorCultivo ? `${actual.mayorCultivo.nombre} es el mayor generador de ventas` : 'Sin ventas registradas aún'} />
          <IndicadorCard icon="wallet-outline" nivel={nivelCostoJornal} titulo="Costo medio por jornal"
            valor={actual?.jornaladas > 0 ? formatMoney(actual.costoMedioJornal) : '—'}
            detalle={`${num(actual?.jornaladas || 0)} jornal(es) pagado(s) este mes`}
            deltaEl={<DeltaTag d={deltaCostoJornal} favorableSiSube={false} />} />
          <IndicadorCard icon="trending-up-outline" nivel={nivelRoi} titulo="ROI-N (retorno por peso en personal)"
            valor={actual?.roiPersonal > 0 ? `${num(actual.roiPersonal)}x` : '—'}
            detalle={actual?.roiPersonal > 0 ? `Cada peso de nómina generó ${num(actual.roiPersonal)} en ventas` : 'Aún no hay ventas o nómina este mes'}
            deltaEl={<DeltaTag d={delta(actual?.roiPersonal, anterior?.roiPersonal)} />} />
          <IndicadorCard icon="calendar-outline" nivel={nivelConsistencia} titulo="Consistencia de flujo"
            valor={actual?.semanas?.length ? `${actual.semanasConVenta} de ${actual.semanas.length}` : '—'}
            detalle="Semanas del mes con alguna venta registrada" />
          <IndicadorCard icon="scale-outline" nivel={actual?.relacionGastos != null ? 'bien' : 'sinDatos'} titulo="Gasto variable vs. fijo"
            valor={actual?.relacionGastos != null ? `${num(actual.relacionGastos)}x` : '—'}
            detalle={actual?.relacionGastos != null ? (actual.relacionGastos > 1.5 ? 'Estructura de costos flexible' : 'Estructura de costos balanceada') : 'Registra gastos fijos para calcularlo'} />
          <IndicadorCard icon="shield-checkmark-outline" nivel={nivelBalance} titulo="Balance del mes"
            valor={actual ? formatMoney(actual.balance) : '—'} detalle="Ventas menos nómina y gastos"
            deltaEl={<DeltaTag d={delta(actual?.balance, anterior?.balance)} />} />
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

function IndicadorCard({ icon, nivel, titulo, valor, detalle, deltaEl }) {
  const info = NIVEL[nivel] || NIVEL.sinDatos;
  return (
    <View style={styles.indicadorCard}>
      <View style={styles.rowStart}>
        <View style={[styles.indicadorIcon, { backgroundColor: info.soft }]}><Ionicons name={icon} size={16} color={info.color} /></View>
        <Text style={styles.indicadorTitulo}>  {titulo}</Text>
      </View>
      <View style={[styles.rowStart, { marginTop: 6 }]}>
        <Text style={styles.indicadorValor}>{valor}</Text>
        <View style={[styles.nivelBadge, { backgroundColor: info.soft }]}>
          <Ionicons name={info.icon} size={11} color={info.color} /><Text style={[styles.nivelBadgeText, { color: info.color }]}>  {info.label}</Text>
        </View>
      </View>
      <Text style={styles.indicadorDetalle}>{detalle}</Text>
      {deltaEl}
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
  recoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: COLORS.lineLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  recoDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  recoText: { flex: 1, fontSize: 12, fontWeight: '500', color: COLORS.ink700, lineHeight: 17 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  indicadorCard: { width: '47%', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 12 },
  indicadorIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  indicadorTitulo: { fontSize: 10, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', flex: 1 },
  indicadorValor: { fontSize: 18, fontWeight: '900', color: COLORS.ink900 },
  nivelBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 8 },
  nivelBadgeText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  indicadorDetalle: { fontSize: 11, color: COLORS.ink500, marginTop: 4 },
  deltaText: { fontSize: 10, fontWeight: '700' },
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
