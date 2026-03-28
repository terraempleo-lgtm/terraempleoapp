import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { AnimatedPressable, StaggeredItem, SkeletonCard } from '../../components/animated';
import DecorativeBackground from '../../components/ui/DecorativeBackground';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { showAlert } from '../../utils/alertService';

const PROXIMIDAD_CONFIG = {
  mismo_municipio: { label: 'Mismo municipio', color: COLORS.primary, icon: 'location' },
  mismo_departamento: { label: 'Mismo dpto.', color: COLORS.info, icon: 'map' },
  lejano: { label: null },
};

function MatchBadge({ puntaje }) {
  if (!puntaje) return null;
  const color = puntaje >= 70 ? COLORS.primary : puntaje >= 40 ? COLORS.warning : COLORS.textLight;
  const bg = puntaje >= 70 ? COLORS.primarySoft : puntaje >= 40 ? COLORS.warningSoft : '#F3F4F6';
  return (
    <View style={[styles.matchBadge, { backgroundColor: bg }]}>
      <Ionicons name="flash" size={12} color={color} />
      <Text style={[styles.matchText, { color }]}>{puntaje}% match</Text>
    </View>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

export default function VacantesRecomendadasScreen({ navigation }) {
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [vacantes, setVacantes] = useState([]);
  const [vacantesPostuladas, setVacantesPostuladas] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = (user?.nombre_completo || 'Usuario').split(' ')[0];

  const cargar = useCallback(async () => {
    try {
      const [recomRes, postRes] = await Promise.all([
        vacantesAPI.recomendadas(),
        vacantesAPI.misPostulaciones(),
      ]);
      setVacantes(recomRes.data?.vacantes || []);
      const ids = new Set(
        (postRes.data?.postulaciones || []).map((p) => Number(p.vacante_id))
      );
      setVacantesPostuladas(ids);
    } catch (err) {
      console.error('Error cargando recomendaciones:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation, cargar]);

  const postularse = async (item) => {
    try {
      await vacantesAPI.postularse({ vacante_id: item.id });
      setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
      showAlert('Listo', 'Te has postulado exitosamente.');
    } catch (err) {
      if (err.response?.status === 409) {
        setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
        showAlert('Aviso', 'Ya estás postulado a esta vacante.');
        return;
      }
      showAlert('Error', err.response?.data?.error || 'Error al postularse');
    }
  };

  const renderVacante = ({ item, index }) => {
    const pago = getVacancyPayDisplay(item);
    const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
    const cultivos = (item.cultivos || []).slice(0, 2).map((c) => c.cultivo || c);
    const labores = (item.labores || []).slice(0, 1).map((l) => l.labor || l);
    const yaPostulado = vacantesPostuladas.has(Number(item.id));
    const prox = PROXIMIDAD_CONFIG[item.proximidad] || {};

    return (
      <StaggeredItem index={index}>
        <AnimatedPressable
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: isDark ? '#000000' : '#0f3d2d',
            },
          ]}
          onPress={() => navigation.navigate('DetalleVacanteRecomendada', { vacante: item })}
          scaleValue={ANIMATION.scale.pressedSubtle}
          haptic={false}
        >
          {/* Hero */}
          <View style={styles.cardHero}>
            {item.foto_portada ? (
              <Image source={{ uri: item.foto_portada }} style={styles.heroImg} resizeMode="cover" />
            ) : (
              <View style={[styles.heroFallback, { backgroundColor: isDark ? colors.surface : '#EDF2EE' }]}>
                <Ionicons name="image-outline" size={36} color="#C8CFC8" />
              </View>
            )}
            <View style={styles.heroOverlay} />

            {/* Match badge top-left */}
            <View style={styles.heroBadgeWrap}>
              <MatchBadge puntaje={item.puntaje_match} />
            </View>

            {/* Urgente */}
            {item.urgente ? (
              <View style={styles.urgentBadge}>
                <Ionicons name="flash" size={11} color="#DC2626" />
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            ) : null}

            {/* Ubicación */}
            <View style={styles.locRow}>
              <Ionicons name="location" size={13} color={COLORS.white} />
              <Text style={styles.locText} numberOfLines={1}>{ubicacion || 'Colombia'}</Text>
            </View>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.titulo}</Text>

            {item.nombre_empresa_finca ? (
              <Text style={[styles.cardFarm, { color: colors.textSecondary }]} numberOfLines={1}>{item.nombre_empresa_finca}</Text>
            ) : null}

            {/* Proximidad + time */}
            <View style={styles.metaRow}>
              {prox.label ? (
                <View style={[styles.proxBadge, { backgroundColor: prox.color + '18' }]}>
                  <Ionicons name={prox.icon} size={11} color={prox.color} />
                  <Text style={[styles.proxText, { color: prox.color }]}>{prox.label}</Text>
                </View>
              ) : null}
              <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo(item.created_at)}</Text>
            </View>

            {/* Tags */}
            <View style={styles.tagsRow}>
              {cultivos.map((c, i) => (
                <View key={`c${i}`} style={[styles.tagGreen, { backgroundColor: isDark ? '#1e3a31' : COLORS.primarySoft }]}>
                  <Ionicons name="leaf" size={10} color={COLORS.primary} />
                  <Text style={styles.tagGreenTxt}>{c}</Text>
                </View>
              ))}
              {labores.map((l, i) => (
                <View key={`l${i}`} style={[styles.tagGray, { backgroundColor: isDark ? '#223a32' : '#F3F4F6' }]}>
                  <Ionicons name="construct-outline" size={10} color={isDark ? colors.textSecondary : COLORS.textSecondary} />
                  <Text style={[styles.tagGrayTxt, { color: isDark ? colors.textSecondary : COLORS.textSecondary }]}>{l}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Bottom: pago + postular */}
            <View style={styles.bottomRow}>
              <View>
                <Text style={[styles.salaryLabel, { color: colors.textMuted }]}>
                  {pago.tipoLabel ? pago.tipoLabel.toUpperCase() : 'SALARIO'}
                </Text>
                <Text style={[styles.salaryValue, { color: colors.textPrimary }]}>
                  {pago.valor !== 'A convenir' ? pago.valor : 'A convenir'}
                </Text>
              </View>
              <AnimatedPressable
                style={[
                  styles.postBtn,
                  { backgroundColor: colors.primary },
                  yaPostulado && styles.postBtnOff,
                  yaPostulado && { backgroundColor: isDark ? '#31423c' : '#E5E7EB' },
                ]}
                onPress={() => { if (!yaPostulado) postularse(item); }}
                disabled={yaPostulado}
                scaleValue={ANIMATION.scale.pressed}
                haptic={!yaPostulado}
              >
                <Ionicons
                  name={yaPostulado ? 'checkmark-circle' : 'paper-plane'}
                  size={14}
                  color={yaPostulado ? (isDark ? '#d7e7df' : '#6b7280') : COLORS.white}
                />
                <Text
                  style={[
                    styles.postBtnTxt,
                    yaPostulado && styles.postBtnTxtOff,
                    yaPostulado && { color: isDark ? '#d7e7df' : '#6b7280' },
                  ]}
                >
                  {yaPostulado ? 'Postulado' : 'Postularme'}
                </Text>
              </AnimatedPressable>
            </View>
          </View>
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  const ListHeader = (
    <View>
      <MotiView
        from={{ opacity: 0, translateY: -10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
      >
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.headerLeft}>
            <View style={[styles.headerIconWrap, { backgroundColor: isDark ? '#1f332b' : COLORS.primarySoft }]}>
              <Ionicons name="sparkles" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Para ti, {firstName}</Text>
              <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Vacantes que coinciden con tu perfil</Text>
            </View>
          </View>
        </View>
      </MotiView>

      {vacantes.length > 0 ? (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{vacantes.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Recomendadas</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: COLORS.primary }]}>
              {vacantes.filter((v) => v.puntaje_match >= 60).length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Alto match</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statNum, { color: COLORS.info }]}>
              {vacantes.filter((v) => v.proximidad !== 'lejano').length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cerca de ti</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <DecorativeBackground intensity="strong" />
      <FlatList
        data={vacantes}
        renderItem={renderVacante}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingHorizontal: SPACING.lg }}>
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <View style={styles.empty}>
              <MotiView
                from={{ translateY: 0 }}
                animate={{ translateY: -8 }}
                transition={{ loop: true, type: 'timing', duration: 1500 }}
              >
                <LinearGradient
                  colors={isDark ? ['#d6f4e4', '#b9ebd1'] : ['#e9fff3', '#dff8eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyIcon}
                >
                  <Ionicons name="sparkles-outline" size={48} color={COLORS.primary} />
                </LinearGradient>
              </MotiView>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin recomendaciones aún</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Completa tu perfil con cultivos y habilidades para recibir mejores recomendaciones.
              </Text>
            </View>
          )
        }
      />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF9' },

  headerDecorWrap: { position: 'absolute', top: -20, left: 0, right: 0, height: 170 },
  headerBlobA: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    left: -55,
    top: -10,
  },
  headerBlobB: {
    position: 'absolute',
    width: 185,
    height: 185,
    borderRadius: 92,
    right: -70,
    top: -70,
  },
  headerBlobC: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    right: 56,
    top: 46,
  },
  headerRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 16,
    left: -34,
    top: 68,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    marginBottom: SPACING.xs,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    ...SHADOWS.small,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  list: { paddingBottom: 24 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    ...SHADOWS.card,
  },

  cardHero: { width: '100%', height: 170, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroFallback: {
    flex: 1, backgroundColor: '#EDF2EE',
    justifyContent: 'center', alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroBadgeWrap: {
    position: 'absolute', top: 10, left: 10,
  },
  matchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  matchText: { fontSize: 12, fontWeight: '700' },

  urgentBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  urgentText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },

  locRow: {
    position: 'absolute', bottom: 8, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  locText: { fontSize: 13, fontWeight: '600', color: COLORS.white },

  cardBody: { padding: SPACING.md },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  cardFarm: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.xs },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  proxBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  proxText: { fontSize: 11, fontWeight: '600' },
  timeText: { fontSize: 12, color: COLORS.textLight },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  tagGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagGreenTxt: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  tagGray: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagGrayTxt: { fontSize: 11, fontWeight: '500', color: COLORS.textSecondary },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: SPACING.sm },

  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  salaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 2 },
  salaryValue: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },

  postBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  postBtnOff: { backgroundColor: '#E5E7EB', ...SHADOWS.none },
  postBtnTxt: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  postBtnTxtOff: { color: '#888' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm, paddingHorizontal: SPACING.xl, overflow: 'hidden', minHeight: 420 },
  emptyGraphics: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyBlobA: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    top: -50,
    left: -92,
  },
  emptyBlobB: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: -110,
    right: -90,
  },
  emptyBlobC: {
    position: 'absolute',
    width: 118,
    height: 118,
    borderRadius: 59,
    top: 124,
    right: 28,
  },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});
