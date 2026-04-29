import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Image, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { showAlert } from '../../utils/alertService';

const TIMELINE_STEPS = ['Postulado', 'En revisión', 'Resultado'];

const tlStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 2,
  },
  step: { flex: 1, alignItems: 'center', gap: 4 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  label: { fontSize: 9.5, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
  line: { flex: 0.7, height: 2, marginTop: 10, borderRadius: 1, alignSelf: 'flex-start' },
});

function PostulacionTimeline({ estado, colors }) {
  let step = 0;
  let rejected = false;
  if (estado === 'rechazada') { step = 1; rejected = true; }
  else if (estado === 'aceptada') { step = 2; }
  else if (estado === 'contacto_solicitado') { step = 1; }

  return (
    <View style={tlStyles.wrap}>
      {TIMELINE_STEPS.map((label, i) => {
        const isPast = i < step;
        const isCurrentDone = i === step && step === 2 && !rejected;
        const isActive = i === step && !rejected && step < 2;
        const isRejectedHere = i === step && rejected;

        let dotBg = '#D1D5DB';
        let iconName = null;
        if (isPast || isCurrentDone) { dotBg = COLORS.primary; iconName = 'checkmark'; }
        if (isCurrentDone) dotBg = '#16a34a';
        if (isRejectedHere) { dotBg = COLORS.error; iconName = 'close'; }

        const lineColor = i < step && !rejected ? COLORS.primary : '#D1D5DB';
        const labelColor = isRejectedHere ? COLORS.error
          : (isPast || isActive || isCurrentDone) ? colors.textPrimary
          : colors.textMuted;

        return (
          <React.Fragment key={label}>
            <View style={tlStyles.step}>
              <View style={[tlStyles.dot, { backgroundColor: dotBg }]}>
                {iconName ? (
                  <Ionicons name={iconName} size={11} color="#fff" />
                ) : isActive ? (
                  <View style={tlStyles.inner} />
                ) : null}
              </View>
              <Text style={[tlStyles.label, { color: labelColor }]}>{label}</Text>
            </View>
            {i < TIMELINE_STEPS.length - 1 && (
              <View style={[tlStyles.line, { backgroundColor: lineColor }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function MisPostulacionesScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [postulaciones, setPostulaciones] = useState([]);
  const [fotosVacante, setFotosVacante] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todas');

  const cargar = useCallback(async () => {
    try {
      const res = await vacantesAPI.misPostulaciones();
      const lista = res.data?.postulaciones || [];
      setPostulaciones(lista);

      const idsVacantes = Array.from(new Set(
        lista.map((p) => Number(p.vacante_id || p.id)).filter((id) => Number.isFinite(id))
      ));

      if (idsVacantes.length === 0) {
        setFotosVacante({});
        return;
      }

      const detalles = await Promise.all(idsVacantes.map(async (id) => {
        try {
          const detalle = await vacantesAPI.detalle(id);
          return { id, foto: detalle.data?.vacante?.fotos?.[0]?.url || detalle.data?.vacante?.foto_portada || null };
        } catch (_) {
          return { id, foto: null };
        }
      }));

      const mapa = {};
      detalles.forEach((d) => { mapa[d.id] = d.foto; });
      setFotosVacante(mapa);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!navigation?.addListener) return;
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation, cargar]);

  const handlePostulacionClick = async (postulacion) => {
    try {
      const vacanteId = postulacion.vacante_id || postulacion.id;
      if (!vacanteId) return;
      const res = await vacantesAPI.detalle(vacanteId);
      const vacante = res.data?.vacante || { id: vacanteId };
      navigation.navigate('DetalleVacante', { vacante });
    } catch (err) {
      console.error('Error abriendo detalle de vacante:', err);
    }
  };

  const responderContacto = async (postulacionId, accion) => {
    try {
      await vacantesAPI.responderContacto(postulacionId, accion);
      await cargar();
      showAlert('Listo', accion === 'aceptar' ? 'Contacto aceptado. Ya puedes chatear.' : 'Solicitud rechazada.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo responder la solicitud');
    }
  };

  const formatDateRelative = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDias = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Hace 1 día';
    if (diffDias < 7) return `Hace ${diffDias} días`;
    const semanas = Math.floor(diffDias / 7);
    if (semanas === 1) return 'Hace 1 semana';
    if (semanas <= 4) return `Hace ${semanas} semanas`;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const getEstado = (estado) => {
    if (estado === 'aceptada') return { label: 'ACEPTADA', bg: '#DCEFE4', color: COLORS.primary };
    if (estado === 'contacto_solicitado') return { label: 'SOLICITUD DE CONTACTO', bg: '#E8F0FF', color: '#1D4ED8' };
    if (estado === 'rechazada') return { label: 'RECHAZADA', bg: COLORS.errorSoft, color: COLORS.error };
    return { label: 'PENDIENTE', bg: '#FEF3C7', color: '#D97706' };
  };

  const counts = useMemo(() => ({
    todas: postulaciones.length,
    pendiente: postulaciones.filter((p) => p.estado === 'pendiente' || p.estado === 'match_auto' || p.estado === 'contacto_solicitado').length,
    aceptada: postulaciones.filter((p) => p.estado === 'aceptada').length,
    rechazada: postulaciones.filter((p) => p.estado === 'rechazada').length,
  }), [postulaciones]);

  const CHIPS = [
    { key: 'todas', label: 'Todas', count: counts.todas, dotColor: COLORS.primary },
    { key: 'pendiente', label: 'Pendiente', count: counts.pendiente, dotColor: '#D97706' },
    { key: 'aceptada', label: 'Aceptadas', count: counts.aceptada, dotColor: COLORS.primary },
    { key: 'rechazada', label: 'Rechazadas', count: counts.rechazada, dotColor: COLORS.error },
  ];

  const dataFiltrada = postulaciones.filter((p) => {
    if (filtro === 'todas') return true;
    if (filtro === 'pendiente') return p.estado === 'pendiente' || p.estado === 'match_auto' || p.estado === 'contacto_solicitado';
    if (filtro === 'aceptada') return p.estado === 'aceptada';
    if (filtro === 'rechazada') return p.estado === 'rechazada';
    return true;
  });

  const ListHeader = (
    <View>
      {/* Title */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Mis Postulaciones</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>{counts.todas}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: '#D97706' }]}>{counts.pendiente}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pendiente</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: COLORS.primary }]}>{counts.aceptada}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Aceptadas</Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ flexGrow: 0, marginBottom: 8 }}
      >
        {CHIPS.map((chip, index) => {
          const activo = filtro === chip.key;
          return (
            <AnimatedPressable
              key={chip.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activo ? '#1A1A1A' : (isDark ? colors.surface : COLORS.white),
                  borderColor: activo ? '#1A1A1A' : (isDark ? colors.border : '#E5E7EB'),
                  marginLeft: index === 0 ? SPACING.md : 0,
                  marginRight: index === CHIPS.length - 1 ? SPACING.md : 0,
                },
              ]}
              onPress={() => setFiltro(chip.key)}
              scaleValue={0.95}
              haptic
              hapticStyle="light"
            >
              <View style={[styles.filterDot, { backgroundColor: activo ? chip.dotColor : (isDark ? colors.textMuted : chip.dotColor) }]} />
              <Text style={[styles.filterText, { color: activo ? COLORS.white : colors.textSecondary }]}>
                {chip.label}
              </Text>
              {chip.count > 0 && (
                <Text style={[styles.filterCount, { color: activo ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                  {chip.count}
                </Text>
              )}
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderItem = ({ item, index }) => {
    const estado = getEstado(item.estado);
    const vacanteId = Number(item.vacante_id || item.id);
    const foto = fotosVacante[vacanteId] || null;
    const esAceptada = item.estado === 'aceptada';
    const esContactoPendiente = item.estado === 'contacto_solicitado';

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => handlePostulacionClick(item)}
          scaleValue={0.98}
          haptic={false}
        >
          {/* Left status accent bar */}
          <View style={[styles.statusBar, { backgroundColor: estado.color }]} />

          <View style={styles.cardMain}>
            <View style={[styles.imageWrap, { backgroundColor: isDark ? colors.surface : '#EAF2ED' }]}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={20} color={COLORS.primaryLight} />
                </View>
              )}
            </View>

            <View style={styles.cardInfo}>
              <View style={styles.cardTopRow}>
                <MotiView
                  from={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: index * 30 }}
                >
                  <View style={[styles.estadoPill, { backgroundColor: estado.bg }]}>
                    <View style={[styles.estadoDot, { backgroundColor: estado.color }]} />
                    <Text style={[styles.estadoPillText, { color: estado.color }]}>{estado.label}</Text>
                  </View>
                </MotiView>
                <Text style={[styles.fechaText, { color: colors.textMuted }]}>{formatDateRelative(item.created_at)}</Text>
              </View>

              <Text style={[styles.vacanteTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.titulo}</Text>

              <View style={styles.empresaRow}>
                <Ionicons name="business-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.empresaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.nombre_empresa_finca || 'Finca'}
                </Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={13} color={colors.textMuted} />
                <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                  {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Ubicación por confirmar'}
                </Text>
              </View>
            </View>
          </View>

          <PostulacionTimeline estado={item.estado} colors={colors} />

          {esAceptada ? (
            <MotiView
              from={{ opacity: 0, translateY: -5 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
            >
              <View style={[styles.okBox, { borderColor: isDark ? '#2e5a48' : '#BDE2C9', backgroundColor: isDark ? '#1d3a2f' : '#ECF7F0' }]}>
                <Ionicons name="information-circle" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                <Text style={[styles.okBoxText, { color: colors.textSecondary }]}>
                  ¡Felicidades! Tu postulación fue aceptada. Espera que el empleador se comunique contigo pronto.
                </Text>
              </View>
            </MotiView>
          ) : null}

          {esContactoPendiente ? (
            <MotiView
              from={{ opacity: 0, translateY: -5 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
            >
              <View style={[styles.okBox, { borderColor: isDark ? '#2b4b86' : '#BBD3FF', backgroundColor: isDark ? '#1A2A44' : '#ECF3FF' }]}>
                <Ionicons name="chatbubble-ellipses" size={16} color={isDark ? '#9CC3FF' : '#1D4ED8'} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.okBoxText, { color: colors.textSecondary }]}>Un empleador quiere contactarte para esta vacante.</Text>
                  <View style={styles.contactActions}>
                    <AnimatedPressable
                      style={[styles.contactBtn, styles.contactBtnGhost, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      onPress={() => responderContacto(item.id, 'rechazar')}
                      scaleValue={0.96}
                      haptic
                    >
                      <Text style={[styles.contactBtnGhostText, { color: colors.textSecondary }]}>Rechazar</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={[styles.contactBtn, styles.contactBtnPrimary]}
                      onPress={() => responderContacto(item.id, 'aceptar')}
                      scaleValue={0.96}
                      haptic
                    >
                      <Text style={styles.contactBtnPrimaryText}>Aceptar y habilitar chat</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </View>
            </MotiView>
          ) : null}

          <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
            {esAceptada && Number(item.empleador_id) > 0 ? (
              <AnimatedPressable
                style={styles.rateBtn}
                onPress={() => navigation.navigate('PerfilPublicoEmpleador', {
                  vacante_id: item.vacante_id,
                  empleador_id: item.empleador_id,
                })}
                scaleValue={0.95}
                haptic
              >
                <Ionicons name="star-outline" size={15} color={COLORS.warning} />
                <Text style={[styles.detailBtnText, { color: COLORS.warning }]}>Calificar empleador</Text>
              </AnimatedPressable>
            ) : <View />}
            <AnimatedPressable style={styles.detailBtn} onPress={() => handlePostulacionClick(item)} scaleValue={0.95} haptic={false}>
              <Text style={[styles.detailBtnText, { color: colors.primary }]}>Ver detalle</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </AnimatedPressable>
          </View>
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <FlatList
        data={dataFiltrada}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MotiView
              from={{ translateY: 0 }}
              animate={{ translateY: -8 }}
              transition={{ type: 'timing', duration: 1500, loop: true, repeatReverse: true }}
            >
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={48} color={colors.primary} />
              </View>
            </MotiView>
            <FadeInView delay={200}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin postulaciones</Text>
            </FadeInView>
            <FadeInView delay={300}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay postulaciones en este filtro por ahora.</Text>
            </FadeInView>
            <FadeInView delay={400}>
              <AnimatedPressable
                style={styles.emptyBtn}
                onPress={() => navigation.getParent()?.navigate('Vacantes')}
                scaleValue={0.96}
                haptic
              >
                <Ionicons name="search-outline" size={18} color={COLORS.white} />
                <Text style={styles.emptyBtnText}>Explorar vacantes</Text>
              </AnimatedPressable>
            </FadeInView>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* App bar */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  appBarLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarLogoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarLogoLetter: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  appBarLogoText: { fontSize: 16, fontWeight: '700' },
  appBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Title */
  titleRow: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 12,
  },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.md,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    ...SHADOWS.light,
  },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Chips */
  chipsRow: {
    gap: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...SHADOWS.light,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, fontWeight: '700' },
  filterCount: { fontSize: 12, fontWeight: '600' },

  /* List */
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 88,
    paddingTop: 2,
  },

  /* Card */
  card: {
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOWS.card,
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardMain: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: 12,
    paddingLeft: 18,
    paddingTop: 11,
    paddingBottom: 9,
  },
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  image: { width: 64, height: 64, borderRadius: 14 },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  cardInfo: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  estadoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  estadoDot: { width: 6, height: 6, borderRadius: 3 },
  estadoPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fechaText: { fontSize: 11, fontWeight: '500' },

  vacanteTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
    marginBottom: 2,
  },
  empresaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  empresaText: { fontSize: 13, fontWeight: '600', flex: 1 },
  locationRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  okBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  okBoxText: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  contactActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  contactBtn: { borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
  contactBtnGhost: { borderWidth: 1 },
  contactBtnGhostText: { fontSize: 12, fontWeight: '700' },
  contactBtnPrimary: { backgroundColor: COLORS.primary },
  contactBtnPrimaryText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  cardFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  rateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailBtnText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: SPACING.xs, textAlign: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  emptyBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
