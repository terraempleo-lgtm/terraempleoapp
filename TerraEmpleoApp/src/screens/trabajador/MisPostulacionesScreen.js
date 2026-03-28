import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import DecorativeBackground from '../../components/ui/DecorativeBackground';
import { showAlert } from '../../utils/alertService';

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
          return { id, foto: detalle.data?.vacante?.foto_portada || null };
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

      navigation.navigate('Vacantes', {
        screen: 'DetalleVacante',
        params: { vacante },
      });
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
    if (estado === 'aceptada') {
      return { label: 'ACEPTADA', bg: '#DCEFE4', color: COLORS.primary };
    }
    if (estado === 'contacto_solicitado') {
      return { label: 'SOLICITUD DE CONTACTO', bg: '#E8F0FF', color: '#1D4ED8' };
    }
    if (estado === 'rechazada') {
      return { label: 'RECHAZADA', bg: COLORS.errorSoft, color: COLORS.error };
    }
    return { label: 'PENDIENTE', bg: '#FEF3C7', color: '#D97706' };
  };

  const counts = useMemo(() => ({
    todas: postulaciones.length,
    pendiente: postulaciones.filter((p) => p.estado === 'pendiente' || p.estado === 'match_auto' || p.estado === 'contacto_solicitado').length,
    aceptada: postulaciones.filter((p) => p.estado === 'aceptada').length,
    rechazada: postulaciones.filter((p) => p.estado === 'rechazada').length,
  }), [postulaciones]);

  const chips = [
    { key: 'todas', label: `Todas (${counts.todas})` },
    { key: 'pendiente', label: `Pendiente (${counts.pendiente})` },
    { key: 'aceptada', label: `Aceptadas (${counts.aceptada})` },
    { key: 'rechazada', label: `Rechazadas (${counts.rechazada})` },
  ];

  const dataFiltrada = postulaciones.filter((p) => {
    if (filtro === 'todas') return true;
    if (filtro === 'pendiente') return p.estado === 'pendiente' || p.estado === 'match_auto' || p.estado === 'contacto_solicitado';
    if (filtro === 'aceptada') return p.estado === 'aceptada';
    if (filtro === 'rechazada') return p.estado === 'rechazada';
    return true;
  });

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
                    <Text style={[styles.estadoPillText, { color: estado.color }]}>{estado.label}</Text>
                  </View>
                </MotiView>
                <Text style={[styles.fechaText, { color: colors.textMuted }]}>{formatDateRelative(item.created_at)}</Text>
              </View>

              <Text style={[styles.vacanteTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.titulo}</Text>

              <Text style={[styles.empresaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.nombre_empresa_finca || 'Finca sin nombre'}
              </Text>

              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={13} color={colors.textMuted} />
                <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={2}>
                  {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Ubicación por confirmar'}
                </Text>
              </View>
            </View>
          </View>

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <DecorativeBackground intensity="strong" />
      <FadeInView delay={0}>
        <View style={styles.headerRow}>
          <AnimatedPressable
            style={[styles.backBtn, { backgroundColor: isDark ? '#1f332b' : '#EEF4EF', borderColor: colors.border }]}
            onPress={() => navigation?.canGoBack?.() ? navigation.goBack() : navigation?.navigate?.('Vacantes')}
            scaleValue={0.9}
            haptic
          >
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </AnimatedPressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mis Postulaciones</Text>
          <View style={styles.headerSpacer} />
        </View>
      </FadeInView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ flexGrow: 0 }}
      >
        {chips.map((chip, i) => {
          const activo = filtro === chip.key;
          return (
            <AnimatedPressable
              key={chip.key}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                activo && [styles.filterChipActive, { backgroundColor: colors.primary, borderColor: colors.primary }],
              ]}
              onPress={() => setFiltro(chip.key)}
              scaleValue={0.93}
              haptic
              hapticStyle="light"
            >
              <View style={[styles.filterDot, activo && styles.filterDotActive]} />
              <Text style={[styles.filterText, { color: colors.textSecondary }, activo && [styles.filterTextActive, { color: COLORS.white }]]}>{chip.label}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={dataFiltrada}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
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
              transition={{
                type: 'timing',
                duration: 1500,
                loop: true,
                repeatReverse: true,
              }}
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
                onPress={() => navigation.navigate('Vacantes')}
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

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 6,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },

  chipsRow: {
    paddingHorizontal: SPACING.lg,
    gap: 6,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EAB308',
  },
  filterDotActive: { backgroundColor: COLORS.white },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: { color: COLORS.white },

  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 88,
    paddingTop: 2,
  },
  card: {
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  cardMain: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: 12,
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
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardInfo: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  estadoPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  estadoPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fechaText: {
    fontSize: 11,
    fontWeight: '500',
  },

  vacanteTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 21,
    marginBottom: 1,
  },
  empresaText: {
    fontSize: 13,
    fontWeight: '600',
  },
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
  okBoxText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  contactActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  contactBtn: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactBtnGhost: {
    borderWidth: 1,
  },
  contactBtnGhostText: {
    fontSize: 12,
    fontWeight: '700',
  },
  contactBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  contactBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },

  cardFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  detailBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
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
  emptyBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
