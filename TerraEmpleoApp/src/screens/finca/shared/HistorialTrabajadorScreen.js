import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI } from '../../../services/api';
import Avatar from './Avatar';
import { useToast } from './useFincaToast';
import { formatMoney, formatDate, formatLabor } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  warning: '#d97706', warningSoft: '#fef3c7',
  danger: '#dc2626', dangerSoft: '#fee2e2',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const ESTADOS = {
  llego: { label: 'Llegó', color: COLORS.primary, soft: COLORS.primarySoft },
  llego_tarde: { label: 'Tarde', color: COLORS.warning, soft: COLORS.warningSoft },
  no_llego: { label: 'No llegó', color: COLORS.danger, soft: COLORS.dangerSoft },
  cancelo: { label: 'Canceló', color: COLORS.ink500, soft: COLORS.lineLight },
  pendiente: { label: 'Pendiente', color: COLORS.info, soft: COLORS.infoSoft },
};

const TIPO_NOTA = [
  { key: 'observacion', label: 'Observación', icon: 'chatbubble-outline', soft: COLORS.infoSoft, color: COLORS.info },
  { key: 'incidencia', label: 'Incidencia', icon: 'warning-outline', soft: COLORS.dangerSoft, color: COLORS.danger },
  { key: 'recordatorio', label: 'Recordatorio', icon: 'notifications-outline', soft: COLORS.warningSoft, color: COLORS.warning },
];

const NIVELES = {
  bien: { label: 'Bien', icon: 'happy', color: COLORS.primary, grado: 'A' },
  regular: { label: 'Regular', icon: 'remove-circle', color: COLORS.warning, grado: 'B' },
  mal: { label: 'Mal', icon: 'sad', color: COLORS.danger, grado: 'C' },
};

function StatBox({ icon, label, value, accent = 'primary' }) {
  const palette = { primary: COLORS.primarySoft, warning: COLORS.warningSoft, danger: COLORS.dangerSoft, info: COLORS.infoSoft };
  const fg = { primary: COLORS.primary, warning: COLORS.warning, danger: COLORS.danger, info: COLORS.info };
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIcon, { backgroundColor: palette[accent] }]}><Ionicons name={icon} size={16} color={fg[accent]} /></View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HistorialTrabajadorScreen({ route, navigation }) {
  const { trabajadorId } = route.params;
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notaTexto, setNotaTexto] = useState('');
  const [notaTipo, setNotaTipo] = useState('observacion');
  const [notaAbierta, setNotaAbierta] = useState(false);
  const [guardandoNota, setGuardandoNota] = useState(false);

  const cargar = () => {
    cuadernoAPI.historialTrabajador(trabajadorId).then((r) => setData(r.data)).catch(() => toast.error('No se pudo cargar el historial')).finally(() => setLoading(false));
  };
  useFocusEffect(React.useCallback(() => { cargar(); }, [trabajadorId]));

  const guardarNota = async () => {
    if (!notaTexto.trim()) return;
    setGuardandoNota(true);
    try {
      await cuadernoAPI.crearNota({ trabajador_id: trabajadorId, nota: notaTexto.trim(), tipo: notaTipo });
      toast.success('Nota guardada');
      setNotaTexto(''); setNotaAbierta(false);
      cargar();
    } catch { toast.error('No se pudo guardar la nota'); } finally { setGuardandoNota(false); }
  };

  const eliminarNota = (n) => {
    Alert.alert('¿Eliminar nota?', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await cuadernoAPI.eliminarNota(n.id); toast.success('Nota eliminada'); cargar(); } catch { toast.error('No se pudo eliminar'); } } },
    ]);
  };

  const calificarAhora = async (asistenciaId, nivel) => {
    try { await cuadernoAPI.calificarAsistencia(asistenciaId, { nivel }); toast.success('Calificación guardada'); cargar(); }
    catch { toast.error('No se pudo calificar'); }
  };

  const tiposTrabajo = useMemo(() => {
    if (!data?.jornadas) return [];
    const m = new Map();
    for (const j of data.jornadas) { const k = formatLabor(j.tipo_trabajo) || 'Sin especificar'; m.set(k, (m.get(k) || 0) + 1); }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

  if (loading) return <SafeAreaView style={styles.screen}><ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /></SafeAreaView>;
  if (!data?.usuario) return <SafeAreaView style={styles.screen}><Text style={styles.emptyText}>Trabajador no encontrado</Text></SafeAreaView>;

  const u = data.usuario;
  const m = data.metricas || {};
  // El backend devuelve SUM() como string (bigNumberStrings) — Number() evita
  // que "0"+"0"+"0" concatene en vez de sumar.
  const totalCalif = (Number(m.calif_bien) || 0) + (Number(m.calif_regular) || 0) + (Number(m.calif_mal) || 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ marginRight: 10 }}><Ionicons name="chevron-back" size={22} color={COLORS.ink900} /></Pressable>
        <Text style={styles.headerTitle}>Historial de trabajador</Text>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          <Avatar src={u.foto_selfie} name={u.nombre_completo} size={64} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.nombre}>{u.nombre_completo}</Text>
            <View style={styles.wrapRow}>
              {u.celular && (
                <Pressable onPress={() => Linking.openURL(`tel:${u.celular}`)} style={styles.rowStart}>
                  <Ionicons name="call-outline" size={12} color={COLORS.ink500} /><Text style={styles.metaText}>  {u.celular}</Text>
                </Pressable>
              )}
              {(u.municipio || u.departamento) && <Text style={styles.metaText}>{[u.municipio, u.departamento].filter(Boolean).join(', ')}</Text>}
              {Number(u.calificacion_promedio) > 0 && (
                <View style={styles.rowStart}>
                  <Ionicons name="star" size={12} color={COLORS.warning} />
                  <Text style={styles.metaTextBold}>  {Number(u.calificacion_promedio).toFixed(1)} ({u.total_calificaciones || 0})</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatBox icon="calendar-outline" label="Jornadas" value={m.total_jornadas || 0} accent="primary" />
          <StatBox icon="checkmark-circle-outline" label="Asistencia" value={`${m.promedio_asistencia || 0}%`} accent="primary" />
          <StatBox icon="close-circle-outline" label="Faltas" value={m.faltas || 0} accent="danger" />
          <StatBox icon="time-outline" label="Tardes" value={m.tarde || 0} accent="warning" />
          <StatBox icon="scale-outline" label="Kg total" value={(m.total_kg || 0).toLocaleString()} accent="info" />
          <StatBox icon="wallet-outline" label="Pagado" value={formatMoney(m.total_pagado || 0)} accent="primary" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⭐ Calificaciones internas</Text>
          {data.jornadas?.[0]?.asistencia_id && (
            <View style={styles.calificarAhoraBox}>
              <Text style={styles.calificarAhoraLabel}>Calificar ahora:</Text>
              <View style={styles.rowStart}>
                {Object.entries(NIVELES).map(([key, n]) => {
                  const active = data.jornadas[0].calif_nivel === key;
                  return (
                    <Pressable key={key} onPress={() => calificarAhora(data.jornadas[0].asistencia_id, key)} style={[styles.califBtn, { backgroundColor: active ? n.color : '#fff', borderColor: n.color }]}>
                      <Text style={[styles.califBtnText, { color: active ? '#fff' : n.color }]}>{n.grado}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
          {totalCalif === 0 ? (
            <Text style={styles.emptyText}>Aún no has calificado a este trabajador.</Text>
          ) : (
            [
              { key: 'bien', label: 'Bien', value: m.calif_bien, color: COLORS.primary },
              { key: 'regular', label: 'Regular', value: m.calif_regular, color: COLORS.warning },
              { key: 'mal', label: 'Mal', value: m.calif_mal, color: COLORS.danger },
            ].map((c) => {
              const pct = totalCalif > 0 ? Math.round(((c.value || 0) * 100) / totalCalif) : 0;
              return (
                <View key={c.key} style={{ marginTop: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.barLabel}>{c.label}</Text>
                    <Text style={styles.barValue}>{c.value || 0} · {pct}%</Text>
                  </View>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.color }]} /></View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>💼 Tipos de trabajo realizados</Text>
          {tiposTrabajo.length === 0 ? <Text style={styles.emptyText}>Sin datos.</Text> : (
            tiposTrabajo.map(([tipo, count]) => (
              <View key={tipo} style={styles.rowBetween}>
                <Text style={styles.tipoText}>{tipo}</Text>
                <Text style={styles.tipoCount}>{count} {count === 1 ? 'vez' : 'veces'}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>💬 Notas internas</Text>
            {!notaAbierta && (
              <Pressable onPress={() => setNotaAbierta(true)} style={styles.addNotaBtn}><Ionicons name="add" size={12} color={COLORS.ink700} /><Text style={styles.addNotaBtnText}>  Agregar nota</Text></Pressable>
            )}
          </View>
          {notaAbierta && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.wrapRow}>
                {TIPO_NOTA.map((t) => (
                  <Pressable key={t.key} onPress={() => setNotaTipo(t.key)} style={[styles.notaTipoChip, { backgroundColor: notaTipo === t.key ? t.color : t.soft }]}>
                    <Ionicons name={t.icon} size={11} color={notaTipo === t.key ? '#fff' : t.color} />
                    <Text style={[styles.notaTipoChipText, { color: notaTipo === t.key ? '#fff' : t.color }]}>  {t.label}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput placeholderTextColor={COLORS.ink400} style={[styles.input, { minHeight: 60, marginTop: 8 }]} multiline placeholder="Escribe una nota interna…" value={notaTexto} onChangeText={setNotaTexto} />
              <View style={[styles.rowStart, { justifyContent: 'flex-end', gap: 8, marginTop: 8 }]}>
                <Pressable onPress={() => setNotaAbierta(false)} style={styles.btnGhostSmall}><Text style={styles.btnGhostSmallText}>Cancelar</Text></Pressable>
                <Pressable onPress={guardarNota} disabled={guardandoNota} style={styles.btnPrimarySmall}>
                  {guardandoNota ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnPrimarySmallText}>Guardar</Text>}
                </Pressable>
              </View>
            </View>
          )}
          {(data.notas || []).length === 0 ? (
            <Text style={[styles.emptyText, { marginTop: 8 }]}>Aún no hay notas.</Text>
          ) : (
            data.notas.map((n) => {
              const meta = TIPO_NOTA.find((t) => t.key === n.tipo) || TIPO_NOTA[0];
              return (
                <View key={n.id} style={styles.notaRow}>
                  <View style={[styles.notaIcon, { backgroundColor: meta.soft }]}><Ionicons name={meta.icon} size={13} color={meta.color} /></View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.notaTexto}>{n.nota}</Text>
                    <Text style={styles.notaFecha}>{formatDate(n.created_at)}</Text>
                  </View>
                  <Pressable onPress={() => eliminarNota(n)} style={{ padding: 6 }}><Ionicons name="trash-outline" size={14} color={COLORS.ink400} /></Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Historial de jornadas</Text>
          {(data.jornadas || []).length === 0 ? <Text style={styles.emptyText}>Este trabajador aún no ha estado en ninguna jornada tuya.</Text> : (
            data.jornadas.map((j) => {
              const e = ESTADOS[j.asistencia_estado] || ESTADOS.pendiente;
              const N = j.calif_nivel ? NIVELES[j.calif_nivel] : null;
              return (
                <Pressable key={j.asistencia_id} style={styles.jornadaRow} onPress={() => navigation.navigate('DetalleJornada', { jornadaId: j.id })}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.jornadaTitulo}>{j.titulo || 'Jornada'}</Text>
                    <Text style={styles.jornadaFecha}>{formatDate(j.fecha)}{j.finca ? ` · ${j.finca}` : ''}</Text>
                  </View>
                  <View style={[styles.estadoBadge, { backgroundColor: e.soft }]}><Text style={[styles.estadoBadgeText, { color: e.color }]}>{e.label}</Text></View>
                  <Text style={styles.jornadaKg}>{j.cantidad_kg ? Number(j.cantidad_kg).toLocaleString() : '—'}</Text>
                  <Text style={styles.jornadaPago}>{j.pago_total ? formatMoney(j.pago_total) : '—'}</Text>
                  {N && <Text style={[styles.califGrado, { color: N.color }]}>{N.grado}</Text>}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink900 },
  container: { padding: 16, paddingBottom: 120 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, marginBottom: 16 },
  nombre: { fontSize: 20, fontWeight: '900', color: COLORS.ink900 },
  metaText: { fontSize: 12, color: COLORS.ink500 },
  metaTextBold: { fontSize: 12, color: COLORS.ink700, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statBox: { width: '31%', backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 10, alignItems: 'center' },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 15, fontWeight: '900', color: COLORS.ink900 },
  statLabel: { fontSize: 9, fontWeight: '700', color: COLORS.ink500, textTransform: 'uppercase', marginTop: 2, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.line, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontWeight: '800', color: COLORS.ink900, fontSize: 14, marginBottom: 8 },
  emptyText: { fontSize: 13, color: COLORS.ink500 },
  calificarAhoraBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.lineLight, borderRadius: 12, padding: 10, marginBottom: 10 },
  calificarAhoraLabel: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  califBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  califBtnText: { fontWeight: '900', fontSize: 13 },
  barLabel: { fontSize: 12, fontWeight: '600', color: COLORS.ink700 },
  barValue: { fontSize: 12, fontWeight: '700', color: COLORS.ink900 },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: COLORS.lineLight, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 999 },
  tipoText: { fontSize: 13, color: COLORS.ink700 },
  tipoCount: { fontSize: 11, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  addNotaBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  addNotaBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.ink700 },
  notaTipoChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  notaTipoChipText: { fontSize: 11, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.ink900, backgroundColor: '#fff' },
  btnGhostSmall: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  btnGhostSmallText: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  btnPrimarySmall: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimarySmallText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  notaRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.lineLight, borderRadius: 10, padding: 10, marginTop: 8 },
  notaIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notaTexto: { fontSize: 13, color: COLORS.ink900 },
  notaFecha: { fontSize: 10, color: COLORS.ink400, marginTop: 4 },
  jornadaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.lineLight, gap: 6 },
  jornadaTitulo: { fontWeight: '700', color: COLORS.ink900, fontSize: 13 },
  jornadaFecha: { fontSize: 11, color: COLORS.ink500 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  estadoBadgeText: { fontSize: 10, fontWeight: '700' },
  jornadaKg: { fontSize: 11, color: COLORS.ink700, width: 44, textAlign: 'right' },
  jornadaPago: { fontSize: 12, fontWeight: '700', color: COLORS.ink900, width: 70, textAlign: 'right' },
  califGrado: { fontWeight: '900', fontSize: 13, width: 20, textAlign: 'right' },
});
