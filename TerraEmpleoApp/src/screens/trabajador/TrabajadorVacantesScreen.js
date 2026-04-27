import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
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
import { useAppTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useDisenoResponsive } from '../../hooks/useDisenoResponsive';
import { PickerModal } from '../../components/ui';
import DecorativeBackground from '../../components/ui/DecorativeBackground';
import { AnimatedPressable, StaggeredItem, SkeletonCard } from '../../components/animated';
import { CULTIVOS } from '../../data/options';
import { DEPARTAMENTOS } from '../../data/colombia';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { showAlert } from '../../utils/alertService';
import { guardarVacantesCache, leerVacantesCache } from '../../utils/offlineCache';
import CamaraFoto from '../../components/CamaraFoto';
import { encolarPostulacion, estaEnCola } from '../../utils/postulacionesQueue';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

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
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[s.tagGray, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]}>
      <Ionicons name="construct-outline" size={11} color={colors.textSecondary} />
      <Text style={[s.tagGrayTxt, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function BenefitChip({ label }) {
  const { colors, isDark } = useAppTheme();
  return (
    <View style={[s.tagBlue, { backgroundColor: isDark ? colors.surface : '#EFF6FF' }]}>
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
  const { user, updateUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { contenedorMaxAncho } = useDisenoResponsive();
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
  const [modalReVerif, setModalReVerif] = useState(false);
  const [fotosReVerif, setFotosReVerif] = useState({ selfie: false, selfie_cedula: false });
  const { isOnline } = useNetworkStatus();

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
    // Mostrar cache inmediatamente mientras carga
    const cache = await leerVacantesCache();
    if (cache && vacantes.length === 0) setVacantes(cache);

    try {
      const params = {};
      if (filterCultivo) params.cultivo = filterCultivo;
      if (filterDepto) params.departamento = filterDepto;
      if (filterUrgente) params.urgente = 'true';

      const [vacantesRes, postulacionesRes] = await Promise.all([
        vacantesAPI.listar(params),
        vacantesAPI.misPostulaciones(),
      ]);

      const nuevasVacantes = vacantesRes.data.vacantes || [];
      setVacantes(nuevasVacantes);
      guardarVacantesCache(nuevasVacantes);

      const idsPostuladas = new Set(
        (postulacionesRes.data.postulaciones || []).map((p) => Number(p.vacante_id))
      );
      setVacantesPostuladas(idsPostuladas);
    } catch (err) {
      // Sin internet: usar cache si existe
      if (cache) setVacantes(cache);
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
    if (!isOnline) {
      await encolarPostulacion(item.id);
      setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
      showAlert('Guardado', 'Sin conexión. Tu postulación se enviará automáticamente cuando vuelva el internet.');
      return;
    }
    try {
      await vacantesAPI.postularse({ vacante_id: item.id });
      setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
      showAlert('Listo', 'Te has postulado exitosamente a esta vacante.');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
        showAlert('Aviso', 'Ya estás postulado a esta vacante');
        return;
      }
      showAlert('Error', err.response?.data?.error || 'Error al postularse');
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
          style={[
            s.card,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? colors.border : COLORS.borderLight,
              borderWidth: 1,
            },
          ]}
          onPress={() => navigation.navigate('DetalleVacante', { vacante: item })}
          scaleValue={ANIMATION.scale.pressedSubtle}
          haptic={false}
        >
          {/* Hero photo */}
          <View style={s.cardHero}>
            {item.foto_portada ? (
              <Image source={{ uri: item.foto_portada }} style={s.cardImg} resizeMode="cover" />
            ) : (
              <View style={[s.cardImgFallback, { backgroundColor: isDark ? colors.surface : '#EDF2EE' }]}>
                <Ionicons name="image-outline" size={40} color={isDark ? colors.border : '#C8CFC8'} />
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
              <Text style={[s.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.titulo}</Text>
              <Text style={[s.cardTime, { color: colors.textMuted }]}>{timeAgo(item.fecha_creacion)}</Text>
            </View>

            {Boolean(item.nombre_empresa_finca) ? (
              <View style={s.cardFarmRow}>
                <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                <Text style={[s.cardFarm, { color: colors.textSecondary }]} numberOfLines={1}>{item.nombre_empresa_finca}</Text>
              </View>
            ) : null}
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
              <View style={s.salaryBlock}>
                <Text style={[s.salaryLabel, { color: colors.textMuted }]}>{getSalaryLabel(item)}</Text>
                {salaryDisplay.valor !== 'A convenir' ? (
                  <View style={s.salaryInlineRow}>
                    <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
                    <Text style={[s.salaryValue, { color: colors.textPrimary }]}>{salaryDisplay.valor}</Text>
                  </View>
                ) : (
                  <Text style={[s.salaryNA, { color: colors.textSecondary }]}>A convenir</Text>
                )}
              </View>
            </View>
            <AnimatedPressable
              style={[
                s.postBtn,
                { backgroundColor: colors.primary },
                yaPostulado && s.postBtnOff,
                yaPostulado && { backgroundColor: isDark ? '#31423c' : '#E5E7EB' },
              ]}
              onPress={() => { if (!yaPostulado) manejarPostulacionRapida(item); }}
              disabled={yaPostulado}
              scaleValue={ANIMATION.scale.pressed}
              haptic={!yaPostulado}
            >
              <Ionicons
                name={yaPostulado ? 'checkmark-circle' : 'paper-plane'}
                size={16}
                color={yaPostulado ? (isDark ? '#d7e7df' : '#6b7280') : COLORS.white}
              />
              <Text
                style={[
                  s.postBtnTxt,
                  yaPostulado && s.postBtnTxtOff,
                  yaPostulado && { color: isDark ? '#d7e7df' : '#6b7280' },
                ]}
              >
                {yaPostulado ? 'Ya postulado' : 'Postularme'}
              </Text>
            </AnimatedPressable>
          </View>
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  /* ── List Header ── */
  const ListHeader = (
    <View style={s.headerBlock}>
      {/* Header greeting */}
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
      >
        <View style={[s.header, { backgroundColor: colors.surface }]}> 
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
              <Text style={[s.greeting, { color: colors.textPrimary }]}>Hola, {firstName}</Text>
              <Text style={[s.greetingSub, { color: colors.textSecondary }]}>Encuentra tu próximo empleo</Text>
            </View>
          </View>
          <AnimatedPressable
            style={s.bellBtn}
            onPress={() => navigation.navigate('Notificaciones')}
            scaleValue={0.9}
            haptic={true}
          >
            <View style={[s.bellCircle, { backgroundColor: isDark ? '#1f332b' : '#F3F4F6' }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            </View>
            <PulsingBadge count={noLeidas} />
          </AnimatedPressable>
        </View>
      </MotiView>

      {mostrarTarjetaVerificacion && (
        <View style={[s.verificacionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.verificacionHeader}>
            <Ionicons
              name={estadoIdentidad === 'rechazada' ? 'alert-circle' : 'shield-outline'}
              size={18}
              color={estadoIdentidad === 'rechazada' ? COLORS.error : COLORS.primary}
            />
            <Text style={[s.verificacionTitle, { color: colors.textPrimary }]}>
              {estadoIdentidad === 'rechazada' ? 'Verificación rechazada' : 'Verificación de identidad'}
            </Text>
          </View>
          <Text style={[s.verificacionText, { color: colors.textSecondary }]}>
            {estadoIdentidad === 'rechazada'
              ? 'Tu verificación fue rechazada. Vuelve a tomarte la selfie y la foto con cédula para reenviar.'
              : 'Tu cédula está en proceso de verificación. Te avisaremos cuando sea aprobada.'}
          </Text>
          {estadoIdentidad === 'rechazada' ? (
            <TouchableOpacity
              style={s.reVerifBtn}
              onPress={() => { setFotosReVerif({ selfie: false, selfie_cedula: false }); setModalReVerif(true); }}
            >
              <Ionicons name="camera" size={16} color={COLORS.white} />
              <Text style={s.reVerifBtnText}>Volver a verificarme</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Search bar */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
      >
        <View style={[s.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[s.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar fincas, cultivos o labores..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} scaleValue={0.9} haptic={false}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          )}
        </View>
      </MotiView>

      {/* Filtros rápidos label */}
      <Text style={[s.filterLabel, { color: colors.primary }]}>FILTROS RÁPIDOS</Text>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
      >
        <AnimatedPressable
          style={[s.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, filterDepto ? s.filterChipOn : null]}
          onPress={() => setShowDeptoModal(true)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="location-outline" size={14} color={filterDepto ? COLORS.white : colors.textSecondary} />
          <Text style={[s.filterChipTxt, { color: colors.textSecondary }, filterDepto && s.filterChipTxtOn]}>
            {filterDepto || 'Ubicación'}
          </Text>
          {filterDepto
            ? <AnimatedPressable onPress={() => setFilterDepto('')} scaleValue={0.9} haptic={false}><Ionicons name="close-circle" size={14} color={COLORS.white} /></AnimatedPressable>
            : <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
          }
        </AnimatedPressable>

        <AnimatedPressable
          style={[s.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, filterCultivo ? s.filterChipOn : null]}
          onPress={() => setShowCultivoModal(true)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="leaf-outline" size={14} color={filterCultivo ? COLORS.white : colors.textSecondary} />
          <Text style={[s.filterChipTxt, { color: colors.textSecondary }, filterCultivo && s.filterChipTxtOn]}>
            {filterCultivo || 'Cultivo'}
          </Text>
          {filterCultivo
            ? <AnimatedPressable onPress={() => setFilterCultivo('')} scaleValue={0.9} haptic={false}><Ionicons name="close-circle" size={14} color={COLORS.white} /></AnimatedPressable>
            : <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
          }
        </AnimatedPressable>

        <AnimatedPressable
          style={[s.filterChip, { backgroundColor: colors.surface, borderColor: colors.border }, filterUrgente ? s.filterChipOn : null]}
          onPress={() => setFilterUrgente(v => !v)}
          scaleValue={0.95}
          haptic={true}
        >
          <Ionicons name="flash-outline" size={14} color={filterUrgente ? COLORS.white : colors.textSecondary} />
          <Text style={[s.filterChipTxt, { color: colors.textSecondary }, filterUrgente && s.filterChipTxtOn]}>Urgente</Text>
          {filterUrgente && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
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
          <Text style={[s.secTitle, { color: colors.textPrimary }]}>Vacantes Disponibles</Text>
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

    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <DecorativeBackground intensity="strong" />
      <FlatList
        data={filtered}
        renderItem={renderVacante}
        keyExtractor={(item) => item.id?.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          s.list,
          { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
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
                  <Ionicons name="search-outline" size={48} color={COLORS.primary} />
                </View>
              </MotiView>
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No hay vacantes disponibles</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>Desliza hacia abajo o limpia los filtros</Text>
              {(filterCultivo || filterDepto || filterUrgente || search) ? (
                <AnimatedPressable
                  style={s.emptyBtn}
                  onPress={() => {
                    setFilterCultivo('');
                    setFilterDepto('');
                    setFilterUrgente(false);
                    setSearch('');
                  }}
                  scaleValue={0.95}
                >
                  <Text style={s.emptyBtnTxt}>Limpiar filtros</Text>
                </AnimatedPressable>
              ) : null}
            </View>
          )
        }
      />

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
      <Modal
        visible={modalReVerif}
        animationType="slide"
        onRequestClose={() => setModalReVerif(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={s.reVerifHeader}>
            <TouchableOpacity onPress={() => setModalReVerif(false)}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[s.reVerifTitle, { color: colors.textPrimary }]}>Nueva verificación</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView contentContainerStyle={s.reVerifContent}>
            <Text style={[s.reVerifDesc, { color: colors.textSecondary }]}>
              Toma las dos fotos para reenviar tu verificación de identidad. Solo se permite cámara.
            </Text>

            <Text style={[s.reVerifSeccion, { color: colors.textPrimary }]}>1. Selfie (tu rostro)</Text>
            {fotosReVerif.selfie ? (
              <View style={s.reVerifCheck}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Selfie enviada</Text>
              </View>
            ) : (
              <CamaraFoto
                tipo="selfie"
                label="Tomar selfie"
                modoLocal={false}
                permitirGaleria={false}
                onFotoGuardada={() => setFotosReVerif(prev => ({ ...prev, selfie: true }))}
              />
            )}

            <Text style={[s.reVerifSeccion, { color: colors.textPrimary }]}>2. Selfie con cédula</Text>
            {fotosReVerif.selfie_cedula ? (
              <View style={s.reVerifCheck}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Foto con cédula enviada</Text>
              </View>
            ) : (
              <CamaraFoto
                tipo="selfie_cedula"
                label="Tomar foto con cédula"
                modoLocal={false}
                permitirGaleria={false}
                onFotoGuardada={() => setFotosReVerif(prev => ({ ...prev, selfie_cedula: true }))}
              />
            )}

            {fotosReVerif.selfie && fotosReVerif.selfie_cedula && (
              <TouchableOpacity
                style={s.reVerifEnviarBtn}
                onPress={() => {
                  updateUser({ validacion_identidad_estado: 'pendiente' });
                  setModalReVerif(false);
                }}
              >
                <Ionicons name="shield-checkmark" size={18} color={COLORS.white} />
                <Text style={s.reVerifEnviarText}>Listo, enviar a revisión</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      </SafeAreaView>
    </View>
  );
}

/* ── Styles ── */

const s = StyleSheet.create({
  root: { flex: 1 },
  headerBlock: {
    position: 'relative',
  },
  heroBlobA: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    left: -60,
    top: -30,
  },
  heroBlobB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -70,
    top: -70,
  },
  heroBlobC: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 64,
    top: 62,
  },
  heroRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 17,
    left: -42,
    top: 84,
  },
  heroLeaf: {
    position: 'absolute',
    width: 120,
    height: 54,
    borderRadius: 38,
    right: 18,
    top: 28,
    transform: [{ rotate: '-18deg' }],
  },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md,
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
  greeting: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
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
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    ...SHADOWS.card,
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
  reVerifBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.error, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start',
    marginTop: 4,
  },
  reVerifBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  reVerifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  reVerifTitle: { fontSize: 17, fontWeight: '700' },
  reVerifContent: { padding: SPACING.lg, gap: SPACING.sm },
  reVerifDesc: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.md },
  reVerifSeccion: { fontSize: 15, fontWeight: '700', marginTop: SPACING.md, marginBottom: 4 },
  reVerifCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  reVerifEnviarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 14, marginTop: SPACING.xl,
  },
  reVerifEnviarText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

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
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full,
  },
  filterChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipTxt: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  filterChipTxtOn: { color: COLORS.white, fontWeight: '600' },
  filterClear: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.error, borderStyle: 'dashed',
  },
  filterClearTxt: { fontSize: 13, fontWeight: '600', color: COLORS.error },

  /* Section header */
  secHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, marginBottom: SPACING.md,
  },
  secTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.3 },
  secBadge: {
    backgroundColor: COLORS.primarySoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  secBadgeTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  /* List */
  list: { paddingBottom: 24, paddingTop: 4 },

  /* Card */
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },

  /* Card hero */
  cardHero: { width: '100%', height: 200, position: 'relative' },
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

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginRight: 8, letterSpacing: -0.2 },
  cardTime: { fontSize: 11, color: COLORS.textLight, flexShrink: 0, marginTop: 3 },
  cardFarmRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  cardFarm: { fontSize: 14, fontWeight: '500', color: COLORS.textSecondary, flexShrink: 1 },
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
    color: COLORS.primaryDark,
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
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  /* Bottom row */
  bottomRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: SPACING.sm },
  salaryBlock: {},
  salaryInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  salaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5 },
  salaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  salaryNA: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 2 },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary, paddingVertical: 13,
    borderRadius: RADIUS.full,
    width: '100%',
    ...SHADOWS.small,
  },
  postBtnOff: { backgroundColor: '#E5E7EB', ...SHADOWS.none },
  postBtnTxt: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  postBtnTxtOff: { color: '#888' },

  /* Empty state */
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  emptyBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.full },
  emptyBtnTxt: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
});
