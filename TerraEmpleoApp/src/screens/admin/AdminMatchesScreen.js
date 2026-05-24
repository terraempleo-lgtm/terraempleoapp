import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { adminAPI } from '../../services/api';

const ESTADO_LABELS = {
  aceptada: 'Match aceptado',
  contacto_solicitado: 'Contacto solicitado',
  match_auto: 'Match automático',
  pendiente: 'Pendiente',
  rechazada: 'Rechazada',
};
const ESTADO_COLORS = {
  aceptada: '#16a34a',
  contacto_solicitado: '#2563eb',
  match_auto: '#7C3AED',
  pendiente: '#d97706',
  rechazada: '#dc2626',
};

export default function AdminMatchesScreen({ navigation, route }) {
  const { vacante } = route.params;
  const { colors, isDark } = useAppTheme();
  const [postulaciones, setPostulaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const cargar = useCallback(async () => {
    try {
      const res = await adminAPI.getPostulantesVacante(vacante.id);
      setPostulaciones(res.data?.postulaciones || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vacante.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtros = [
    { key: 'todos', label: 'Todos' },
    { key: 'aceptada', label: 'Aceptados' },
    { key: 'contacto_solicitado', label: 'Contacto' },
    { key: 'match_auto', label: 'Auto' },
    { key: 'pendiente', label: 'Pendientes' },
    { key: 'rechazada', label: 'Rechazados' },
  ];

  const datos = filtro === 'todos' ? postulaciones : postulaciones.filter(p => p.estado === filtro);

  const renderItem = ({ item }) => {
    const color = ESTADO_COLORS[item.estado] || COLORS.textSecondary;
    const label = ESTADO_LABELS[item.estado] || item.estado;
    return (
      <View style={[s.card, { backgroundColor: colors.surface }]}>
        <View style={s.cardHeader}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{(item.nombre_completo || '?')[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.nombre, { color: colors.textPrimary }]}>{item.nombre_completo}</Text>
            <Text style={[s.sub, { color: colors.textSecondary }]}>{item.celular}</Text>
            {item.municipio ? <Text style={[s.sub, { color: colors.textMuted }]}>{item.municipio}, {item.departamento}</Text> : null}
          </View>
          <View style={[s.estadoBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[s.estadoText, { color }]}>{label}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          {item.puntaje_match != null && (
            <View style={s.stat}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={[s.statTxt, { color: colors.textSecondary }]}>Match: {Math.round(item.puntaje_match)}%</Text>
            </View>
          )}
          {item.anios_experiencia != null && (
            <View style={s.stat}>
              <Ionicons name="briefcase-outline" size={14} color={colors.textMuted} />
              <Text style={[s.statTxt, { color: colors.textSecondary }]}>{item.anios_experiencia} años exp.</Text>
            </View>
          )}
          {item.calificacion_promedio > 0 && (
            <View style={s.stat}>
              <Ionicons name="ribbon-outline" size={14} color={colors.textMuted} />
              <Text style={[s.statTxt, { color: colors.textSecondary }]}>{Number(item.calificacion_promedio).toFixed(1)} ★</Text>
            </View>
          )}
        </View>

        <View style={s.fechaRow}>
          <Text style={[s.fecha, { color: colors.textMuted }]}>
            Postulado: {new Date(item.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.celular}`)}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>Matches — {vacante.titulo}</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>{postulaciones.length} postulaciones</Text>
        </View>
      </View>

      <FlatList
        data={datos}
        keyExtractor={i => i.id?.toString()}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={s.filtrosRow}>
            {filtros.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.filtroChip, filtro === f.key && { backgroundColor: COLORS.primary }]}
                onPress={() => setFiltro(f.key)}
              >
                <Text style={[s.filtroTxt, filtro === f.key && { color: '#fff', fontWeight: '700' }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
            <Text style={[s.emptyTxt, { color: colors.textSecondary }]}>Sin postulaciones en este filtro</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { padding: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  filtrosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  filtroChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filtroTxt: { fontSize: 13, color: COLORS.textSecondary },
  card: { borderRadius: RADIUS.xl, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  nombre: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 1 },
  estadoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  estadoText: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt: { fontSize: 12 },
  fechaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fecha: { fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 14 },
});
