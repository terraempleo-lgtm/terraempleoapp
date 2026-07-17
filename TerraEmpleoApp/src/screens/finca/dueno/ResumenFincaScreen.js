import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI } from '../../../services/api';
import Avatar from '../shared/Avatar';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney, formatDate } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primaryLight: '#55c53e', primarySoft: '#e5f6ec',
  accent: '#c1ff72', accentSoft: '#f3ffd9', accentDark: '#5a7d12',
  warning: '#d97706', warningSoft: '#fef3c7',
  info: '#2563eb', infoSoft: '#e0edff',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

function StatCard({ icon, label, value, accent = 'primary', hint }) {
  const palette = {
    primary: { bg: COLORS.primarySoft, fg: COLORS.primary },
    accent: { bg: COLORS.accentSoft, fg: COLORS.accentDark },
    warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
    info: { bg: COLORS.infoSoft, fg: COLORS.info },
    danger: { bg: COLORS.dangerSoft, fg: COLORS.danger },
  }[accent];
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: palette.bg }]}>
        <Ionicons name={icon} size={18} color={palette.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function BarRow({ label, value, max, color = COLORS.primary, sub }) {
  const pct = max > 0 ? Math.min(100, Math.round((value * 100) / max)) : 0;
  return (
    <View style={{ paddingVertical: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.barSub}>{sub}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={[styles.rowStart, { marginBottom: 10 }]}>
      {icon && (
        <View style={styles.sectionIcon}><Ionicons name={icon} size={16} color={COLORS.primary} /></View>
      )}
      <Text style={styles.sectionTitle}>  {title}</Text>
    </View>
  );
}

function calificacionScore(t) {
  const total = (t.calif_bien || 0) + (t.calif_regular || 0) + (t.calif_mal || 0);
  if (total === 0) return null;
  const score = ((t.calif_bien || 0) * 1 + (t.calif_regular || 0) * 0.5) / total;
  return Math.round(score * 100);
}

export default function ResumenFincaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      cuadernoAPI.dashboard()
        .then((r) => mounted && setData(r.data))
        .catch((e) => console.error('Error cuaderno dashboard:', e))
        .finally(() => mounted && setLoading(false));
      return () => { mounted = false; };
    }, [])
  );

  const resumen = data?.resumen || {};
  const maxRendimiento = useMemo(() => Math.max(1, ...((data?.rendimiento_tipo || []).map((r) => Number(r.pago) || 0))), [data]);
  const maxFinca = useMemo(() => Math.max(1, ...((data?.por_finca || []).map((r) => Number(r.pago) || 0))), [data]);
  const maxMensual = useMemo(() => Math.max(1, ...((data?.mensual || []).map((r) => Number(r.pago) || 0))), [data]);
  const maxSemanal = useMemo(() => Math.max(1, ...((data?.semanal || []).map((r) => Number(r.pago) || 0))), [data]);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <CuadernoTopNav navigation={navigation} activeKey="ResumenFincaHome" />
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const sinDatos = !resumen?.jornadas_total && !(data?.proximas_jornadas?.length) && !(data?.top_trabajadores?.length);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="ResumenFincaHome" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.rowBetween, { marginBottom: 16 }]}>
          <View style={styles.rowStart}>
            <View style={styles.headerIcon}><Ionicons name="book" size={22} color="#fff" /></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.h1}>Cuaderno</Text>
              <Text style={styles.subtitle}>Jornadas, asistencia, producción y pagos</Text>
            </View>
          </View>
        </View>
        <View style={[styles.rowStart, { gap: 8, marginBottom: 16 }]}>
          <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('JornadasHome')}>
            <Ionicons name="calendar-outline" size={16} color={COLORS.ink700} />
            <Text style={styles.btnOutlineText}>  Ver jornadas</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('CerrarJornada')}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>  Nueva jornada</Text>
          </Pressable>
        </View>

        {sinDatos && (
          <View style={styles.emptyCard}>
            <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>Empieza tu primer registro</Text>
            <Text style={styles.emptyText}>Crea una jornada para llevar control de asistencia, producción y pagos.</Text>
            <Pressable style={styles.btnPrimarySmall} onPress={() => navigation.navigate('CerrarJornada')}>
              <Text style={styles.btnPrimaryText}>Crear primera jornada</Text>
            </Pressable>
          </View>
        )}

        {/* KPIs */}
        <View style={styles.grid2}>
          <StatCard icon="people-outline" label="Trabajadores" value={resumen.trabajadores_contratados || 0} accent="primary" hint="contratados" />
          <StatCard icon="calendar-outline" label="Jornadas" value={resumen.jornadas_total || 0} accent="accent"
            hint={`${resumen.jornadas_activas || 0} activas · ${resumen.jornadas_pendientes || 0} pendientes`} />
          <StatCard icon="cash-outline" label="Pagado" value={formatMoney(resumen.total_pagado || 0)} accent="info"
            hint={`${Number(resumen.total_kg || 0).toLocaleString()} kg producidos`} />
          <StatCard icon="alert-circle-outline" label="Asistencia" value={`${resumen.promedio_asistencia || 0}%`} accent="warning" hint="promedio del periodo" />
        </View>

        {/* Tendencia mensual */}
        <View style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.heroKicker}>TENDENCIA MENSUAL</Text>
              <Text style={styles.heroTitle}>Pagos por mes</Text>
            </View>
            <View style={styles.rowStart}>
              <Ionicons name="trending-up-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroHint}>  Últimos 6 meses</Text>
            </View>
          </View>
          {(data?.mensual || []).length === 0 ? (
            <Text style={styles.heroEmpty}>Aún no hay registros mensuales</Text>
          ) : (
            <View style={styles.barsRow}>
              {[...(data?.mensual || [])].reverse().map((m) => {
                const altura = Math.max(8, Math.round((Number(m.pago) / maxMensual) * 100));
                return (
                  <View key={m.mes} style={styles.barCol}>
                    <Text style={styles.barValueLabel}>{formatMoney(m.pago)}</Text>
                    <View style={[styles.monthBar, { height: `${altura}%` }]} />
                    <Text style={styles.barMonthLabel}>
                      {new Date(m.mes + '-01').toLocaleDateString('es-CO', { month: 'short' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Próximas jornadas */}
        <SectionHeader icon="calendar-outline" title="Próximas jornadas" />
        {(data?.proximas_jornadas || []).length === 0 ? (
          <Text style={styles.emptyText}>No tienes jornadas próximas programadas.</Text>
        ) : (
          <View style={{ gap: 8, marginBottom: 20 }}>
            {data.proximas_jornadas.map((j) => (
              <Pressable key={j.id} style={styles.jornadaCard} onPress={() => navigation.navigate('DetalleJornada', { jornadaId: j.id })}>
                <View style={styles.rowBetween}>
                  <View style={[styles.estadoBadge, {
                    backgroundColor: j.estado === 'planeada' ? COLORS.infoSoft : j.estado === 'en_curso' ? COLORS.primarySoft : COLORS.lineLight,
                  }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: j.estado === 'planeada' ? COLORS.info : j.estado === 'en_curso' ? COLORS.primary : COLORS.ink500 }}>
                      {j.estado === 'planeada' ? 'Planeada' : j.estado === 'en_curso' ? 'En curso' : 'Cerrada'}
                    </Text>
                  </View>
                  <Text style={styles.fechaChica}>{formatDate(j.fecha)}</Text>
                </View>
                <Text style={styles.jornadaTitulo}>{j.titulo || 'Jornada'}</Text>
                <View style={styles.rowBetween}>
                  {j.finca ? (
                    <View style={styles.rowStart}><Ionicons name="location-outline" size={12} color={COLORS.ink400} /><Text style={styles.jornadaMeta}>  {j.finca}</Text></View>
                  ) : <View />}
                  <View style={styles.rowStart}><Ionicons name="people-outline" size={12} color={COLORS.primary} /><Text style={styles.jornadaMetaPrimary}>  {j.total_trabajadores || 0}</Text></View>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Rendimiento por tipo */}
        <View style={styles.card}>
          <SectionHeader icon="pulse-outline" title="Rendimiento por tipo de trabajo" />
          {(data?.rendimiento_tipo || []).length === 0 ? <Text style={styles.emptyText}>Aún no hay datos.</Text> : (
            data.rendimiento_tipo.map((r) => (
              <BarRow key={r.tipo} label={r.tipo} value={Number(r.pago)} max={maxRendimiento}
                sub={`${formatMoney(r.pago)} · ${Number(r.kg).toLocaleString()} kg`} />
            ))
          )}
        </View>

        {/* Top trabajadores */}
        <View style={styles.card}>
          <SectionHeader icon="ribbon-outline" title="Trabajadores mejor calificados" />
          {(data?.top_trabajadores || []).length === 0 ? (
            <Text style={styles.emptyText}>Aún no hay calificaciones. Cierra una jornada y califica para verlos aquí.</Text>
          ) : (
            data.top_trabajadores.slice(0, 6).map((t, idx) => {
              const score = calificacionScore(t);
              return (
                <Pressable
                  key={t.trabajador_id || idx}
                  style={styles.trabajadorRow}
                  onPress={() => t.trabajador_id && navigation.navigate('HistorialTrabajador', { trabajadorId: t.trabajador_id })}
                >
                  <View>
                    <Avatar src={t.foto} name={t.nombre} size={36} />
                    <View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{idx + 1}</Text></View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.trabajadorNombre}>{t.nombre || 'Trabajador'}</Text>
                    <Text style={styles.trabajadorMeta}>{t.jornadas} jornadas · {Number(t.total_kg).toLocaleString()} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {score != null && (
                      <View style={styles.rowStart}><Ionicons name="star" size={11} color={COLORS.primary} /><Text style={styles.scoreText}>  {score}</Text></View>
                    )}
                    <Text style={styles.trabajadorPago}>{formatMoney(t.total_pagado)}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* Comparativa entre fincas */}
        <View style={styles.card}>
          <SectionHeader icon="location-outline" title="Comparativa entre fincas" />
          {(data?.por_finca || []).length === 0 ? <Text style={styles.emptyText}>Sin datos.</Text> : (
            data.por_finca.map((f) => (
              <BarRow key={f.finca} label={f.finca} value={Number(f.pago)} max={maxFinca} color={COLORS.primaryLight}
                sub={`${formatMoney(f.pago)} · ${f.jornadas} jornadas`} />
            ))
          )}
        </View>

        {/* Producción semanal */}
        <View style={styles.card}>
          <SectionHeader icon="trending-up-outline" title="Producción semanal" />
          {(data?.semanal || []).length === 0 ? <Text style={styles.emptyText}>Sin datos.</Text> : (
            <View style={styles.barsRowSmall}>
              {data.semanal.map((s) => {
                const h = Math.max(6, Math.round((Number(s.pago) / maxSemanal) * 100));
                return (
                  <View key={s.semana} style={styles.barColSmall}>
                    <View style={[styles.weekBar, { height: `${h}%` }]} />
                    <Text style={styles.barWeekLabel}>
                      {new Date(s.desde).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Historial de pagos */}
        <View style={styles.card}>
          <SectionHeader icon="wallet-outline" title="Historial de pagos reciente" />
          {(data?.historial_pagos || []).length === 0 ? <Text style={styles.emptyText}>Aún no hay pagos registrados.</Text> : (
            data.historial_pagos.slice(0, 10).map((p) => (
              <View key={p.id} style={styles.pagoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pagoTrabajador}>{p.trabajador || '—'}</Text>
                  <Text style={styles.pagoJornada} numberOfLines={1}>{p.jornada_titulo || p.finca || 'Jornada'} · {formatDate(p.fecha)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.pagoMonto}>{formatMoney(p.pago_total)}</Text>
                  <View style={[styles.pagoEstado, { backgroundColor: p.pagado ? COLORS.primarySoft : COLORS.warningSoft }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: p.pagado ? COLORS.primary : COLORS.warning }}>
                      {p.pagado ? 'Pagado' : 'Pendiente'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Cards de producción total */}
        <View style={styles.grid2}>
          <StatCard icon="scale-outline" label="Kg producidos" value={Number(resumen.total_kg || 0).toLocaleString()} accent="accent" />
          <StatCard icon="wallet-outline" label="Total pagado" value={formatMoney(resumen.total_pagado || 0)} accent="primary" />
          <StatCard icon="alert-circle-outline" label="Sin cerrar" value={resumen.jornadas_activas || 0} accent="warning" hint="jornadas en curso" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 40 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 26, fontWeight: '900', color: COLORS.ink900 },
  subtitle: { fontSize: 13, color: COLORS.ink500, marginTop: 2 },
  btnOutline: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff' },
  btnOutlineText: { fontWeight: '700', color: COLORS.ink700, fontSize: 13 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  btnPrimarySmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 10 },
  btnPrimaryText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  emptyCard: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,141,73,0.3)', borderRadius: 16, padding: 16, marginBottom: 16 },
  emptyTitle: { fontWeight: '700', color: COLORS.ink900, marginTop: 6, marginBottom: 4 },
  emptyText: { fontSize: 13, color: COLORS.ink500, paddingVertical: 8 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47%', flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: COLORS.line },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 10, textTransform: 'uppercase', color: COLORS.ink500, fontWeight: '700' },
  statValue: { fontSize: 18, fontWeight: '900', color: COLORS.ink900, marginTop: 2 },
  statHint: { fontSize: 10, color: COLORS.ink400, marginTop: 2 },
  heroCard: { borderRadius: 20, padding: 18, marginBottom: 20, backgroundColor: COLORS.primaryDark },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: 'rgba(255,255,255,0.65)' },
  heroTitle: { fontSize: 18, fontWeight: '900', color: '#fff', marginTop: 2 },
  heroHint: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  heroEmpty: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 130, marginTop: 16, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barValueLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 4 },
  monthBar: { width: '100%', borderRadius: 6, backgroundColor: COLORS.accent, minHeight: 6 },
  barMonthLabel: { fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: 4 },
  sectionIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '700', color: COLORS.ink900, fontSize: 15 },
  jornadaCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line, gap: 6 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  fechaChica: { fontSize: 11, color: COLORS.ink500, fontWeight: '700' },
  jornadaTitulo: { fontWeight: '700', color: COLORS.ink900, fontSize: 14 },
  jornadaMeta: { fontSize: 11, color: COLORS.ink500 },
  jornadaMetaPrimary: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.line },
  barLabel: { fontSize: 13, fontWeight: '600', color: COLORS.ink700, flex: 1 },
  barSub: { fontSize: 12, fontWeight: '700', color: COLORS.ink900 },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: COLORS.lineLight, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 999 },
  trabajadorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.line },
  rankBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  rankBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.ink900 },
  trabajadorNombre: { fontWeight: '600', color: COLORS.ink900, fontSize: 13 },
  trabajadorMeta: { fontSize: 11, color: COLORS.ink500 },
  scoreText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  trabajadorPago: { fontSize: 11, color: COLORS.ink400, fontWeight: '700' },
  barsRowSmall: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4, marginTop: 8 },
  barColSmall: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  weekBar: { width: '100%', borderRadius: 4, backgroundColor: COLORS.primary, minHeight: 4 },
  barWeekLabel: { fontSize: 9, color: COLORS.ink400, fontWeight: '700', marginTop: 4 },
  pagoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.line },
  pagoTrabajador: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  pagoJornada: { fontSize: 11, color: COLORS.ink500 },
  pagoMonto: { fontWeight: '900', color: COLORS.ink900, fontSize: 13 },
  pagoEstado: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginTop: 2 },
});
