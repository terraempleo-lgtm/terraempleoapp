import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, Image, TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI, notificacionesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { PickerModal } from '../../components/ui';
import { AnimatedPressable, StaggeredItem, SkeletonCard } from '../../components/animated';
import { CULTIVOS } from '../../data/options';
import { DEPARTAMENTOS } from '../../data/colombia';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';

/* ── Helpers ── */

function getSalaryLabel(item) {
  const tp = (item.tipo_pago || '').toLowerCase();
  if (tp.includes('jornal')) return 'PAGO POR JORNAL';
  if (tp.includes('mensual')) return 'PAGO MENSUAL';
  if (tp.includes('semanal')) return 'PAGO SEMANAL';
  if (tp.includes('quincenal')) return 'PAGO QUINCENAL';
  if (tp.includes('destajo')) return 'PAGO POR DESTAJO';
  return 'PAGO ESTIMADO';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Publicado hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Publicado hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${days} días`;
}

/* ── Chips ── */

function CultivoChip({ label }) {
  return (
    <View style={s.tagGreen}>
      <Ionicons name="leaf" size={11} color={COLORS.primary} />
      <Text style={s.tagGreenTxt}>{label}</Text>
    </View>
  );
}

function LaborChip({ label }) {
  return (
    <View style={s.tagGray}>
      <Ionicons name="construct-outline" size={11} color={COLORS.textSecondary} />
      <Text style={s.tagGrayTxt}>{label}</Text>
    </View>
  );
}

function BenefitChip({ label }) {
  return (
    <View style={s.tagBlue}>
      <Ionicons name="checkmark-circle" size={11} color="#3B82F6" />
      <Text style={s.tagBlueTxt}>{label}</Text>
    </View>
  );
}

/* ── Animated Badge ── */
function PulsingBadge({ count }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (count > 0) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    }
  }, [count]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (count <= 0) return null;

  return (
    <Animated.View style={[s.bellBadge, animatedStyle]}>
      <Text style={s.bellBadgeTxt}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

/* ── Main ── */

export default function TrabajadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [vacantesPostuladas, setVacantesPostuladas] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [noLeidas, setNoLeidas] = useState(0);
  const [filterCultivo, setFilterCultivo] = useState('');
  const [filterDepto, setFilterDepto] = useState('');
  const [filterUrgente, setFilterUrgente] = useState(false);
  const [showCultivoModal, setShowCultivoModal] = useState(false);
  const [showDeptoModal, setShowDeptoModal] = useState(false);

  const firstName = (user?.nombre_completo || user?.nombre || 'Usuario').split(' ')[0];
  const estadoIdentidad = user?.validacion_identidad_estado || 'pendiente';
  const identidadAprobada = estadoIdentidad === 'aprobada';
  const necesitaSubirCedula = !user?.foto_cedula;
  const yaEnvioCedula = Boolean(user?.validacion_identidad_enviado_at || user?.foto_cedula || user?.foto_selfie_cedula);
  const mostrarAccionSubirCedula = estadoIdentidad === 'rechazada' || (!yaEnvioCedula && necesitaSubirCedula);
  const mostrarTarjetaVerificacion = !identidadAprobada;

  const cargarNoLeidas = useCallback(async () => {
    try {
      const res = await notificacionesAPI.contarNoLeidas();
      setNoLeidas(res.data.count || 0);
    } catch (_) {}
  }, []);

  const cargarVacantes = useCallback(async () => {
    try {
      const params = {};
      if (filterCultivo) params.cultivo = filterCultivo;
      if (filterDepto) params.departamento = filterDepto;
      if (filterUrgente) params.urgente = 'true';

      const [vacantesRes, postulacionesRes] = await Promise.all([
        vacantesAPI.listar(params),
        vacantesAPI.misPostulaciones(),
      ]);

      setVacantes(vacantesRes.data.vacantes || []);
      const idsPostuladas = new Set(
        (postulacionesRes.data.postulaciones || []).map((p) => Number(p.vacante_id))
      );
      setVacantesPostuladas(idsPostuladas);
    } catch (err) {
      console.error('Error cargando vacantes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterCultivo, filterDepto, filterUrgente]);

  useEffect(() => { cargarVacantes(); cargarNoLeidas(); }, [cargarVacantes, cargarNoLeidas]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { cargarVacantes(); cargarNoLeidas(); });
    return unsub;
  }, [navigation, cargarVacantes, cargarNoLeidas]);

  const onRefresh = () => { setRefreshing(true); cargarVacantes(); };

  const manejarPostulacionRapida = async (item) => {
    try {
      await vacantesAPI.postularse({ vacante_id: item.id });
      setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
      Alert.alert('Listo', 'Te has postulado exitosamente a esta vacante.');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
        Alert.alert('Aviso', 'Ya estás postulado a esta vacante');
        return;
      }
      Alert.alert('Error', err.response?.data?.error || 'Error al postularse');
    }
  };

  const filtered = search.trim()
    ? vacantes.filter(v =>
        v.titulo?.toLowerCase().includes(search.toLowerCase()) ||
        v.departamento?.toLowerCase().includes(search.toLowerCase()) ||
        v.nombre_empresa_finca?.toLowerCase().includes(search.toLowerCase())
      )
    : vacantes;

  /* ── Card ── */
  const renderVacante = ({ item, index }) => {
    const salaryDisplay = getVacancyPayDisplay(item);
    const cultivos = (item.cultivos || []).slice(0, 2).map(c => c.cultivo || c);
    const labores = (item.labores || []).slice(0, 1).map(l => l.labor || l);
    const yaPostulado = vacantesPostuladas.has(Number(item.id));
    const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
    const cal = parseFloat(item.calificacion_promedio || 0);
    const beneficios = [];
    if (item.incluye_alojamiento) beneficios.push('Alojamiento incl.');
    if (item.incluye_alimentacion) beneficios.push('Alimentación incl.');
    if (item.incluye_transporte) beneficios.push('Transporte incl.');
    const inicioTexto = formatVacancyStartDate(item.fecha_inicio, { fallback: '' });

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable
          style={s.card}
          onPress={() => navigation.navigate('DetalleVacante', { vacante: item })}
          scaleValue={ANIMATION.scale.pressedSubtle}
          haptic={false}
        >
          {/* Hero photo */}
          <View style={s.cardHero}>
            {item.foto_portada ? (
              <Image source={{ uri: item.foto_portada }} style={s.cardImg} resizeMode="cover" />
            ) : (
              <View style={s.cardImgFallback}>
                <Ionicons name="image-outline" size={40} color="#C8CFC8" />
              </View>
            )}

            <View style={s.cardHeroOverlay} />

            {cal > 0 && (
              <View style={s.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFB300" />
                <Text style={s.ratingBadgeTxt}>{cal.toFixed(1)}</Text>
              </View>
            )}

            {item.urgente ? (
              <View style={s.urgentOverlay}>
                <Ionicons name="flash" size={11} color="#DC2626" />
                <Text style={s.urgentOverlayTxt}>URGENTE</Text>
              </View>
            ) : null}

            <View style={s.locOverlay}>
              <Ionicons name="location" size={14} color={COLORS.white} />
              <Text style={s.locOverlayTxt} numberOfLines={1}>
                {ubicacion || 'Sin ubicación'}
              </Text>
            </View>
          </View>

          {/* Card body */}
          <View style={s.cardBody}>
            <View style={s.titleRow}>
              <Text style={s.cardTitle} numberOfLines={1}>{item.titulo}</Text>
              <Text style={s.cardTime}>{timeAgo(item.fecha_creacion)}</Text>
            </View>

            {item.nombre_empresa_finca && (
              <Text style={s.cardFarm} numberOfLines={1}>{item.nombre_empresa_finca}</Text>
            )}
            {inicioTexto ? (
              <View style={s.startDateBadge}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                <Text style={s.startDateBadgeText}>Inicio: {inicioTexto}</Text>
              </View>
            ) : null}

            <View style={s.tagsRow}>
              {cultivos.map((c, i) => <CultivoChip key={`c${i}`} label={c} />)}
              {labores.map((l, i) => <LaborChip key={`l${i}`} label={l} />)}
              {beneficios.slice(0, 1).map((b, i) => <BenefitChip key={`b${i}`} label={b} />)}
            </View>

            <View style={s.divider} />

            <View style={s.bottomRow}>
              <View>
                <Text style={s.salaryLabel}>{getSalaryLabel(item)}</Text>
                {salaryDisplay.valor !== 'A convenir' ? (
                  <Text style={s.salaryValue}>{salaryDisplay.valor}</Text>
                ) : (
                  <Text style={s.salaryNA}>A convenir</Text>
                )}
              </View>
              <AnimatedPressable
                style={[s.postBtn, yaPostulado && s.postBtnOff]}
                onPress={() => { if (!yaPostulado) manejarPostulacionRapida(item); }}
                disabled={yaPostulado}
                scaleValue={ANIMATION.scale.pressed}
                haptic={!yaPostulado}
              >
                <Ionicons
                  name={yaPostulado ? 'checkmark-circle' : 'paper-plane'}
                  size={15}
                  color={yaPostulado ? '#888' : COLORS.white}
                />
                <Text style={[s.postBtnTxt, yaPostulado && s.postBtnTxtOff]}>
                  {yaPostulado ? 'Postulado' : 'Postularme'}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  /* ── List Header ── */
  const ListHeader = (
    <View>
      {/* Header greeting */}
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
      >
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.avatarWrap}>
              {user?.foto_selfie ? (
                <Image source={{ uri: user.foto_selfie }} style={s.avatarImg} />
              ) : (
                <Ionicons name="person" size={20} color={COLORS.primary} />
              )}
              {identidadAprobada && (
                <View style={s.verificadoBadge}>
                  <Ionicons name="checkmark" size={11} color={COLORS.white} />
                </View>
              )}
            </View>
            <View>
              <Text style={s.greeting}>Hola, {firstName}</Text>
              <Text style={s.greetingSub}>Encuentra tu próximo empleo</Text>
            </View>
          </View>
          <AnimatedPressable
            style={s.bellBtn}
            onPress={() => navigation.navigate('Notificaciones')}
            scaleValue={0.9}
            haptic={true}
          >
            <View style={s.bellCircle}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
            </View>
            <PulsingBadge count={noLeidas} />
          </AnimatedPressable>
        </View>
      </MotiView>

      {mostrarTarjetaVerificacion && (
        <View style={s.verificacionCard}>
          <View style={s.verificacionHeader}>
            <Ionicons
              name={estadoIdentidad === 'rechazada' ? 'alert-circle' : 'shield-outline'}
              size={18}
              color={estadoIdentidad === 'rechazada' ? COLORS.error : COLORS.primary}
            />
            <Text style={s.verificacionTitle}>
              {estadoIdentidad === 'rechazada' ? 'Verificación rechazada' : 'Verificación de identidad'}
            </Text>
          </View>
          <Text style={s.verificacionText}>
            {estadoIdentidad === 'rechazada'
              ? 'Tu verificación fue rechazada. ¿Quieres verificarte otra vez? Sube una nueva foto de cédula.'
              : 'Tu cédula está en proceso de verificación. Te avisaremos cuando sea aprobada.'}
          </Text>
          {mostrarAccionSubirCedula && estadoIdentidad === 'rechazada' ? (
            <Text style={s.verificacionAyuda}>
              Para volver a verificarte, sube una nueva cédula desde tu perfil.
            </Text>
          ) : null}
        </View>
      )}

      {/* Search bar */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
      >
        <View style={s.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar fincas, cultivos o labores..."
            placeholderTextColor={COLORS.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} scaleValue={0.9} haptic={false}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </AnimatedPressable>
          )}
        </View>
      </MotiView>

      {/* Filtros rápidos label */}
      <Text style={s.filterLabel}>FILTROS RÁPIDOS</Text>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
      >
        <AnimatedPressable
          style={[s.filterChip, filterDepto ? s.filterChipOn : null]}
          onPress={() => setShowDeptoModal(true)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="location-outline" size={14} color={filterDepto ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[s.filterChipTxt, filterDepto && s.filterChipTxtOn]}>
            {filterDepto || 'Ubicación'}
          </Text>
          {filterDepto
            ? <AnimatedPressable onPress={() => setFilterDepto('')} scaleValue={0.9} haptic={false}><Ionicons name="close-circle" size={14} color={COLORS.primary} /></AnimatedPressable>
            : <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          }
        </AnimatedPressable>

        <AnimatedPressable
          style={[s.filterChip, filterCultivo ? s.filterChipOn : null]}
          onPress={() => setShowCultivoModal(true)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="leaf-outline" size={14} color={filterCultivo ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[s.filterChipTxt, filterCultivo && s.filterChipTxtOn]}>
            {filterCultivo || 'Cultivo'}
          </Text>
          {filterCultivo
            ? <AnimatedPressable onPress={() => setFilterCultivo('')} scaleValue={0.9} haptic={false}><Ionicons name="close-circle" size={14} color={COLORS.primary} /></AnimatedPressable>
            : <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          }
        </AnimatedPressable>

        <AnimatedPressable
          style={[s.filterChip, filterUrgente ? s.filterChipOn : null]}
          onPress={() => setFilterUrgente(v => !v)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="flash-outline" size={14} color={filterUrgente ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[s.filterChipTxt, filterUrgente && s.filterChipTxtOn]}>Urgente</Text>
          {filterUrgente && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
        </AnimatedPressable>

        {(filterCultivo || filterDepto || filterUrgente) && (
          <AnimatedPressable
            style={s.filterClear}
            onPress={() => { setFilterCultivo(''); setFilterDepto(''); setFilterUrgente(false); }}
            scaleValue={0.95}
            haptic={true}
          >
            <Ionicons name="refresh" size={14} color={COLORS.error} />
            <Text style={s.filterClearTxt}>Limpiar</Text>
          </AnimatedPressable>
        )}
      </ScrollView>

      {/* Section header */}
      <MotiView
        from={{ opacity: 0, translateX: -15 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
      >
        <View style={s.secHeader}>
          <Text style={s.secTitle}>Vacantes Disponibles</Text>
          <MotiView
            from={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 400 }}
          >
            <View style={s.secBadge}>
              <Text style={s.secBadgeTxt}>{filtered.length} {filtered.length === 1 ? 'nueva' : 'nuevas'}</Text>
            </View>
          </MotiView>
        </View>
      </MotiView>

      <PickerModal
        visible={showCultivoModal}
        onClose={() => setShowCultivoModal(false)}
        title="Filtrar por cultivo"
        options={CULTIVOS}
        selectedValue={filterCultivo}
        onSelect={(v) => { setFilterCultivo(v); setShowCultivoModal(false); }}
      />
      <PickerModal
        visible={showDeptoModal}
        onClose={() => setShowDeptoModal(false)}
        title="Filtrar por departamento"
        options={DEPARTAMENTOS}
        selectedValue={filterDepto}
        onSelect={(v) => { setFilterDepto(v); setShowDeptoModal(false); }}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <FlatList
        data={filtered}
        renderItem={renderVacante}
        keyExtractor={(item) => item.id?.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={s.empty}>
              <MotiView
                from={{ translateY: 0 }}
                animate={{ translateY: -8 }}
                transition={{ loop: true, type: 'timing', duration: 1500 }}
              >
                <View style={s.emptyIcon}>
                  <Ionicons name="briefcase-outline" size={48} color={COLORS.primary} />
                </View>
              </MotiView>
              <Text style={s.emptyTitle}>No hay vacantes disponibles</Text>
              <Text style={s.emptySub}>Desliza hacia abajo para actualizar</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAF9' },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.primary, overflow: 'hidden',
    position: 'relative',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  verificadoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  greetingSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  bellBtn: { position: 'relative' },
  bellCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white, paddingHorizontal: 3,
  },
  bellBadgeTxt: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  verificacionCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.small,
  },
  verificacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  verificacionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  verificacionText: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  verificacionAyuda: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: 12,
    gap: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0 },

  /* Filter label */
  filterLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 1,
    paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },

  /* Filter chips */
  filterScroll: { marginBottom: SPACING.md },
  filterRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full,
  },
  filterChipOn: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  filterChipTxt: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTxtOn: { color: COLORS.primary, fontWeight: '600' },
  filterClear: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.error, borderStyle: 'dashed',
  },
  filterClearTxt: { fontSize: 13, fontWeight: '600', color: COLORS.error },

  /* Section header */
  secHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, marginBottom: SPACING.md,
  },
  secTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  secBadge: {
    backgroundColor: COLORS.primarySoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  secBadgeTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* List */
  list: { paddingBottom: 24 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },

  /* Card hero */
  cardHero: { width: '100%', height: 190, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  cardImgFallback: {
    flex: 1, backgroundColor: '#EDF2EE', justifyContent: 'center', alignItems: 'center',
  },
  cardHeroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 70,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  /* Rating badge */
  ratingBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: RADIUS.full,
    paddingHorizontal: 8, paddingVertical: 4,
    ...SHADOWS.small,
  },
  ratingBadgeTxt: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

  /* Urgente overlay */
  urgentOverlay: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: RADIUS.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  urgentOverlayTxt: { fontSize: 10, fontWeight: '800', color: '#DC2626', letterSpacing: 0.3 },

  /* Location overlay */
  locOverlay: {
    position: 'absolute', bottom: 10, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  locOverlayTxt: { fontSize: 13, fontWeight: '600', color: COLORS.white },

  /* Card body */
  cardBody: { padding: SPACING.md },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginRight: 8 },
  cardTime: { fontSize: 11, color: COLORS.textLight, flexShrink: 0 },
  cardFarm: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  startDateBadge: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  startDateBadgeText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
  },

  /* Tags */
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  tagGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tagGreenTxt: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  tagGray: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tagGrayTxt: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  tagBlue: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tagBlueTxt: { fontSize: 12, fontWeight: '600', color: '#3B82F6' },

  /* Divider */
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: SPACING.sm },

  /* Bottom row */
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  salaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 2 },
  salaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  salaryNA: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic' },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 11,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  postBtnOff: { backgroundColor: '#E5E7EB', ...SHADOWS.none },
  postBtnTxt: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  postBtnTxtOff: { color: '#888' },

  /* Empty state */
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 13, color: COLORS.textLight },
});
