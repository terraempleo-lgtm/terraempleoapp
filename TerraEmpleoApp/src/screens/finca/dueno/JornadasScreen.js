import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { cuadernoAPI } from '../../../services/api';
import CuadernoTopNav from '../shared/CuadernoTopNav';
import { formatMoney, formatDate, asText } from '../../../utils/fincaFormat';

const COLORS = {
  primary: '#008d49', primaryDark: '#006635', primarySoft: '#e5f6ec',
  accent: '#c1ff72',
  info: '#2563eb', infoSoft: '#e0edff',
  ink900: '#171a15', ink700: '#3f4438', ink500: '#6b7060', ink400: '#8b9080',
  line: '#e4e6de', lineLight: '#f4f5f0',
  planillaBg: '#EAF3DE', planillaBorder: '#008d49', planillaText: '#1B512D',
};

const ESTADO_META = {
  planeada: { label: 'Planeada', bg: COLORS.infoSoft, fg: COLORS.info, dot: COLORS.info },
  en_curso: { label: 'En curso', bg: COLORS.primarySoft, fg: COLORS.primary, dot: COLORS.primary },
  cerrada: { label: 'Cerrada', bg: COLORS.lineLight, fg: COLORS.ink500, dot: COLORS.ink400 },
};

const FILTROS = [
  { key: 'todas', label: 'Todas', dot: COLORS.ink400 },
  { key: 'planeada', label: 'Planeadas', dot: COLORS.info },
  { key: 'en_curso', label: 'En curso', dot: COLORS.primary },
  { key: 'cerrada', label: 'Cerradas', dot: COLORS.ink400 },
];

function JornadaCard({ j, onAbrir }) {
  const meta = ESTADO_META[j.estado] || ESTADO_META.planeada;
  const total = Number(j.total_trabajadores || 0);
  const asistieron = Number(j.asistieron || 0);
  const pagado = Number(j.total_pagado || 0);
  const kg = Number(j.total_kg || 0);

  return (
    <Pressable style={styles.card} onPress={onAbrir}>
      <View style={styles.rowBetween}>
        <View style={styles.rowStart}>
          <View style={styles.cardIcon}><Ionicons name="book-outline" size={18} color={COLORS.primary} /></View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.cardTitulo}>{j.titulo || 'Jornada sin título'}</Text>
            <View style={styles.rowStart}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.ink500} />
              <Text style={styles.cardFecha}>  {formatDate(j.fecha)}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.estadoBadge, { backgroundColor: meta.bg }]}>
          <View style={[styles.dot, { backgroundColor: meta.dot }]} />
          <Text style={[styles.estadoText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </View>

      {(j.finca || j.vacante_titulo) && (
        <View style={[styles.rowStart, { marginTop: 6 }]}>
          {j.finca && <><Ionicons name="location-outline" size={12} color={COLORS.ink400} /><Text style={styles.metaText}>  {j.finca}</Text></>}
          {j.vacante_titulo && (
            <>
              {j.finca && <Text style={styles.metaText}>  ·  </Text>}
              <Ionicons name="briefcase-outline" size={12} color={COLORS.ink400} />
              <Text style={styles.metaText}>  {asText(j.vacante_titulo)}</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Asistieron</Text>
          <View style={styles.rowStart}><Ionicons name="people-outline" size={12} color={COLORS.primary} /><Text style={styles.statValue}>  {asistieron}/{total}</Text></View>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Producción</Text>
          <View style={styles.rowStart}><Ionicons name="scale-outline" size={12} color={COLORS.primary} /><Text style={styles.statValue}>  {kg.toLocaleString()} kg</Text></View>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Pagado</Text>
          <Text style={styles.statValuePrimary}>{formatMoney(pagado)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function JornadasScreen({ navigation }) {
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  const cargar = () => {
    cuadernoAPI.listarJornadas()
      .then((r) => setJornadas(r.data?.jornadas || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useFocusEffect(React.useCallback(() => { cargar(); }, []));

  const lista = useMemo(() => (filtro === 'todas' ? jornadas : jornadas.filter((j) => j.estado === filtro)), [jornadas, filtro]);

  const counts = useMemo(() => ({
    todas: jornadas.length,
    planeada: jornadas.filter((j) => j.estado === 'planeada').length,
    en_curso: jornadas.filter((j) => j.estado === 'en_curso').length,
    cerrada: jornadas.filter((j) => j.estado === 'cerrada').length,
  }), [jornadas]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <CuadernoTopNav navigation={navigation} activeKey="JornadasHome" />
      <View style={styles.header}>
        <View style={styles.rowBetween}>
          <View style={styles.rowStart}>
            <Text style={styles.h1}>Jornadas</Text>
            {jornadas.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{jornadas.length}</Text></View>
            )}
          </View>
          <View style={styles.rowStart}>
            <Pressable style={styles.planillaBtn} onPress={() => navigation.navigate('LeerPlanilla')}>
              <Ionicons name="camera-outline" size={16} color={COLORS.planillaText} />
              <Text style={styles.planillaBtnText}>  Subir planilla</Text>
            </Pressable>
            <Pressable style={styles.fab} onPress={() => navigation.navigate('CerrarJornada')}>
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.subtitle}>Lleva control de cada día de trabajo en tus fincas</Text>

        <View style={styles.filtrosRow}>
          {FILTROS.map((t) => {
            const active = filtro === t.key;
            return (
              <Pressable key={t.key} onPress={() => setFiltro(t.key)} style={[styles.filtroChip, active && styles.filtroChipActivo]}>
                <View style={[styles.dot, { backgroundColor: t.dot }]} />
                <Text style={styles.filtroLabel}>  {t.label}</Text>
                <Text style={styles.filtroCount}>  {counts[t.key] || 0}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color={COLORS.primary} /> : lista.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="calendar-outline" size={44} color={COLORS.primary} />
          <Text style={styles.emptyTitle}>{filtro === 'todas' ? 'Aún no hay jornadas' : 'Sin jornadas en este filtro'}</Text>
          <Text style={styles.emptyText}>Crea una jornada para registrar asistencia, producción y pagos del día.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate('CerrarJornada')}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.emptyBtnText}>  Crear jornada</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(j) => String(j.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <JornadaCard j={item} onAbrir={() => navigation.navigate('DetalleJornada', { jornadaId: item.id })} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingBottom: 8 },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 24, fontWeight: '900', color: COLORS.ink900 },
  countBadge: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  fab: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  planillaBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 0.5, borderColor: COLORS.planillaBorder, backgroundColor: COLORS.planillaBg,
  },
  planillaBtnText: { color: COLORS.planillaText, fontWeight: '700', fontSize: 12 },
  subtitle: { fontSize: 13, color: COLORS.ink500, marginTop: 4, marginBottom: 12 },
  filtrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff' },
  filtroChipActivo: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  dot: { width: 7, height: 7, borderRadius: 4 },
  filtroLabel: { fontSize: 12, fontWeight: '700', color: COLORS.ink700 },
  filtroCount: { fontSize: 11, fontWeight: '600', color: COLORS.ink400 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink900, marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: COLORS.ink500, textAlign: 'center', marginBottom: 16 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.line },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cardTitulo: { fontWeight: '700', color: COLORS.ink900, fontSize: 14 },
  cardFecha: { fontSize: 11, color: COLORS.ink500 },
  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  metaText: { fontSize: 12, color: COLORS.ink500 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.line },
  statCol: { flex: 1 },
  statLabel: { fontSize: 10, textTransform: 'uppercase', color: COLORS.ink400, fontWeight: '700' },
  statValue: { fontSize: 13, fontWeight: '700', color: COLORS.ink900 },
  statValuePrimary: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
