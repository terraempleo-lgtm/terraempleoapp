import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI } from '../../services/api';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hace 1 dia';
  return `Hace ${days} dias`;
}

export default function ExplorarVacantesScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [listadoRes, misVacantesRes] = await Promise.all([
        vacantesAPI.listar(),
        vacantesAPI.misVacantes(),
      ]);

      const idsMias = new Set((misVacantesRes.data?.vacantes || []).map((v) => Number(v.id)));
      const externas = (listadoRes.data?.vacantes || []).filter((v) => !idsMias.has(Number(v.id)));

      setVacantes(externas);
    } catch (err) {
      console.error('Error cargando vacantes de referencia:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const renderItem = ({ item }) => {
    const pago = getVacancyPayDisplay(item);
    const fechaInicio = formatVacancyStartDate(item.fecha_inicio, { fallback: '' });
    const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ') || 'Colombia';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DetalleVacanteReferencia', { vacante: item })}
      >
        <View style={styles.imageWrap}>
          {item.foto_portada ? (
            <Image source={{ uri: item.foto_portada }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="leaf" size={24} color={COLORS.primaryLight} />
            </View>
          )}
          {item.urgente ? (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>URGENTE</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{item.titulo}</Text>
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
          </View>

          <Text style={[styles.finca, { color: colors.textSecondary }]} numberOfLines={1}>{item.nombre_empresa_finca || 'Finca'}</Text>

          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>{ubicacion}</Text>
          </View>

          {fechaInicio ? (
            <View style={styles.startBadge}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
              <Text style={[styles.startBadgeText, { color: colors.textPrimary }]}>Inicio: {fechaInicio}</Text>
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <View style={styles.salaryRow}>
              <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.salaryText, { color: colors.textPrimary }]}>{pago.valor}</Text>
            </View>
            <View style={styles.readOnlyPill}>
              <Ionicons name="eye-outline" size={12} color={COLORS.primary} />
              <Text style={styles.readOnlyText}>Solo lectura</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.headerInfo, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Explorar ofertas</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Referencia de otras fincas (sin acciones de trabajador)</Text>
      </View>

      <FlatList
        data={vacantes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={COLORS.primaryLight} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin ofertas para explorar</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cuando haya vacantes de otras fincas apareceran aqui.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerInfo: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  list: { padding: SPACING.md, paddingBottom: SPACING.xl },
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  imageWrap: { height: 150, position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urgentBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.urgentBg,
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  urgentText: { fontSize: 10, fontWeight: '700', color: COLORS.error },
  body: { padding: SPACING.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  timeText: { fontSize: 11 },
  finca: { fontSize: 13, marginTop: 2, marginBottom: SPACING.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: SPACING.xs },
  metaText: { flex: 1, fontSize: 13 },
  startBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  startBadgeText: { fontSize: 12, fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  salaryText: { fontSize: 14, fontWeight: '700' },
  readOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  readOnlyText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl * 2, paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
