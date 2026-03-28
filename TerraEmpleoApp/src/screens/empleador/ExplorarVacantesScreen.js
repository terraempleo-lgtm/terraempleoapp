import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI } from '../../services/api';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import AnimatedPressable from '../../components/animated/AnimatedPressable';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

const FILTROS = [
  { key: 'todos', label: 'Todos', icon: 'apps-outline' },
  { key: 'recientes', label: 'Recientes', icon: 'time-outline' },
  { key: 'con_alojamiento', label: 'Con alojamiento', icon: 'home-outline' },
  { key: 'con_alimentacion', label: 'Con alimentación', icon: 'restaurant-outline' },
  { key: 'urgente', label: 'Urgentes', icon: 'flash-outline' },
];

function FilterPill({ item, active, onPress, colors }) {
  return (
    <AnimatedPressable
      style={[
        styles.filterPill,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => onPress(item.key)}
      scaleValue={0.95}
      haptic
    >
      <Ionicons
        name={item.icon}
        size={13}
        color={active ? COLORS.white : colors.textMuted}
      />
      <Text style={[
        styles.filterPillText,
        { color: active ? COLORS.white : colors.textSecondary },
        active && { fontWeight: '700' },
      ]}>
        {item.label}
      </Text>
    </AnimatedPressable>
  );
}

function VacanteCard({ item, colors, onPress }) {
  const pago = getVacancyPayDisplay(item);
  const fechaInicio = formatVacancyStartDate(item.fecha_inicio, { fallback: '' });
  const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ') || 'Colombia';
  const cultivos = item.cultivos || [];

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 280, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <AnimatedPressable
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={onPress}
        scaleValue={0.98}
        haptic
      >
        {/* Image section */}
        <View style={styles.imageWrap}>
          {item.foto_portada ? (
            <Image source={{ uri: item.foto_portada }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: colors.primary + '22' }]}>
              <Ionicons name="leaf" size={36} color={colors.primary + '88'} />
            </View>
          )}
          {/* Dark overlay for readability if has image */}
          {!!item.foto_portada && <View style={styles.imageOverlay} />}

          {/* Badges on image */}
          <View style={styles.imageBadges}>
            {item.urgente ? (
              <View style={[styles.urgentBadge, { backgroundColor: COLORS.urgentBg, borderColor: COLORS.error + '55' }]}>
                <Ionicons name="flash" size={10} color={COLORS.error} />
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            ) : null}
          </View>

          {/* Time badge on image top-right */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>

        {/* Card body */}
        <View style={styles.body}>
          {/* Title row */}
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.titulo}
          </Text>

          {/* Company */}
          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.nombre_empresa_finca || 'Finca'}
            </Text>
          </View>

          {/* Location */}
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {ubicacion}
            </Text>
          </View>

          {/* Cultivo chips */}
          {cultivos.length > 0 && (
            <View style={styles.chipsRow}>
              {cultivos.slice(0, 3).map((c, i) => (
                <View
                  key={i}
                  style={[styles.chip, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '35' }]}
                >
                  <Ionicons name="leaf" size={10} color={colors.primary} />
                  <Text style={[styles.chipText, { color: colors.primary }]}>
                    {c.cultivo || c.nombre || String(c)}
                  </Text>
                </View>
              ))}
              {cultivos.length > 3 && (
                <View style={[styles.chip, { backgroundColor: colors.border, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.textMuted }]}>+{cultivos.length - 3}</Text>
                </View>
              )}
            </View>
          )}

          {/* Footer row: salary + date + CTA */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <View style={styles.salaryRow}>
                <Ionicons name="cash-outline" size={15} color={colors.primary} />
                <Text style={[styles.salaryText, { color: colors.primary }]}>{pago.valor}</Text>
              </View>
              {!!fechaInicio && (
                <View style={styles.dateRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                  <Text style={[styles.dateText, { color: colors.textMuted }]}>Inicio: {fechaInicio}</Text>
                </View>
              )}
            </View>

            {/* Ver detalle CTA */}
            <AnimatedPressable
              style={[styles.detailBtn, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '10' }]}
              onPress={onPress}
              scaleValue={0.93}
              haptic
            >
              <Text style={[styles.detailBtnText, { color: colors.primary }]}>Ver detalle</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primary} />
            </AnimatedPressable>
          </View>

          {/* Benefits pills row */}
          {(item.ofrece_alojamiento || item.ofrece_alimentacion) && (
            <View style={styles.benefitPills}>
              {item.ofrece_alojamiento && (
                <View style={[styles.benefitPill, { backgroundColor: COLORS.infoSoft }]}>
                  <Ionicons name="home-outline" size={11} color={COLORS.info} />
                  <Text style={[styles.benefitPillText, { color: COLORS.info }]}>Alojamiento</Text>
                </View>
              )}
              {item.ofrece_alimentacion && (
                <View style={[styles.benefitPill, { backgroundColor: COLORS.warningSoft }]}>
                  <Ionicons name="restaurant-outline" size={11} color={COLORS.warning} />
                  <Text style={[styles.benefitPillText, { color: COLORS.warning }]}>Alimentación</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function ExplorarVacantesScreen({ navigation }) {
  const { colors } = useAppTheme();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('todos');

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

  const vacantesFiltered = useMemo(() => {
    switch (filtroActivo) {
      case 'recientes': {
        const hace48h = Date.now() - 48 * 60 * 60 * 1000;
        return vacantes.filter(v => new Date(v.created_at).getTime() > hace48h);
      }
      case 'con_alojamiento':
        return vacantes.filter(v => v.ofrece_alojamiento);
      case 'con_alimentacion':
        return vacantes.filter(v => v.ofrece_alimentacion);
      case 'urgente':
        return vacantes.filter(v => v.urgente);
      default:
        return vacantes;
    }
  }, [vacantes, filtroActivo]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Explorar ofertas</Text>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>
              {vacantesFiltered.length} vacante{vacantesFiltered.length !== 1 ? 's' : ''} disponible{vacantesFiltered.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.headerBadge, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={[styles.headerBadgeText, { color: colors.primary }]}>Solo referencia</Text>
          </View>
        </View>

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterBar}
        >
          {FILTROS.map(f => (
            <FilterPill
              key={f.key}
              item={f}
              active={filtroActivo === f.key}
              onPress={setFiltroActivo}
              colors={colors}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── List ────────────────────────────────────────────── */}
      <FlatList
        data={vacantesFiltered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <VacanteCard
            item={item}
            colors={colors}
            onPress={() => navigation.navigate('DetalleVacanteReferencia', { vacante: item })}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="briefcase-outline" size={40} color={colors.primary + '99'} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {filtroActivo === 'todos' ? 'Sin ofertas para explorar' : 'Sin resultados para este filtro'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {filtroActivo === 'todos'
                ? 'Cuando haya vacantes de otras fincas aparecerán aquí.'
                : 'Prueba seleccionando otro filtro.'}
            </Text>
            {filtroActivo !== 'todos' && (
              <AnimatedPressable
                style={[styles.emptyBtn, { borderColor: colors.primary + '60', backgroundColor: colors.primary + '10' }]}
                onPress={() => setFiltroActivo('todos')}
                scaleValue={0.95}
              >
                <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Ver todos</Text>
              </AnimatedPressable>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Header ─────────────────────────────────────────── */
  header: {
    borderBottomWidth: 1,
    paddingTop: SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700' },
  filterBar: { marginBottom: SPACING.sm },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },

  /* ── List ────────────────────────────────────────────── */
  list: { padding: SPACING.md, paddingBottom: SPACING.xl * 2 },

  /* ── Card ────────────────────────────────────────────── */
  card: {
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  imageWrap: { height: 160, position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  imageBadges: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', gap: 6,
  },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  urgentText: { fontSize: 10, fontWeight: '800', color: COLORS.error },
  timeBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.white },

  /* Body */
  body: { padding: SPACING.md },
  title: { fontSize: 17, fontWeight: '800', marginBottom: SPACING.xs, letterSpacing: -0.1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  metaText: { flex: 1, fontSize: 13 },

  /* Chips */
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '600' },

  /* Footer */
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginTop: SPACING.sm,
  },
  footerLeft: { flex: 1, gap: 3 },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  salaryText: { fontSize: 15, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12 },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1.5,
  },
  detailBtnText: { fontSize: 13, fontWeight: '700' },

  /* Benefit pills */
  benefitPills: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm,
  },
  benefitPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  benefitPillText: { fontSize: 11, fontWeight: '600' },

  /* ── Empty ────────────────────────────────────────────── */
  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl + SPACING.xl,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: SPACING.xs,
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: RADIUS.full, borderWidth: 1.5,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700' },
});
