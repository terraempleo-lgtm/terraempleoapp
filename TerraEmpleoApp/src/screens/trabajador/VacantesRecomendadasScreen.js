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
  const high = puntaje >= 70;
  const mid = puntaje >= 40;
  const bg = high ? COLORS.primary : mid ? COLORS.warning : '#6B7280';
  return (
    <View style={[styles.matchBadge, { backgroundColor: bg }]}>
      <Text style={styles.matchEmoji}>⚡</Text>
      <Text style={styles.matchText}>{puntaje}% match</Text>
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
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.titulo}</Text>

            <View style={styles.farmLocRow}>
              {item.nombre_empresa_finca ? (
                <View style={styles.farmInline}>
                  <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.cardFarm, { color: colors.textSecondary, marginBottom: 0 }]} numberOfLines={1}>{item.nombre_empresa_finca}</Text>
                </View>
              ) : null}
              {ubicacion ? (
                <View style={styles.locInline}>
                  <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.cardFarm, { color: colors.textSecondary, marginBottom: 0 }]} numberOfLines={1}>{ubicacion}</Text>
                </View>
              ) : null}
            </View>

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

            {/* Bottom: pago */}
            <View style={styles.bottomRow}>
              <View style={styles.salaryBlock}>
                <Text style={[styles.salaryLabel, { color: colors.textMuted }]}>
                  {pago.tipoLabel ? pago.tipoLabel.toUpperCase() : 'SALARIO'}
                </Text>
                {pago.valor !== 'A convenir' ? (
                  <View style={styles.salaryInlineRow}>
                    <Ionicons name="cash-outline" size={15} color={COLORS.primary} />
                    <Text style={[styles.salaryValue, { color: colors.textPrimary }]}>{pago.valor}</Text>
                  </View>
                ) : (
                  <Text style={[styles.salaryValue, { color: colors.textSecondary, fontStyle: 'italic' }]}>A convenir</Text>
                )}
              </View>
            </View>
            {/* Full-width apply button */}
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
                size={16}
                color={yaPostulado ? (isDark ? '#d7e7df' : '#6b7280') : COLORS.white}
              />
              <Text
                style={[
                  styles.postBtnTxt,
                  yaPostulado && styles.postBtnTxtOff,
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
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
  container: { flex: 1 },

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
    borderRadius: RADIUS.xl,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    ...SHADOWS.card,
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
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
    ...SHADOWS.small,
  },
  matchEmoji: { fontSize: 12 },
  matchText: { fontSize: 13, fontWeight: '800', color: COLORS.white },

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
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  cardFarm: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  
  farmLocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm, flexWrap: 'wrap' },
  farmInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locInline: { flexDirection: 'row', alignItems: 'center', gap: 4 },

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
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tagGreenTxt: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  tagGray: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  tagGrayTxt: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },

  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },

  bottomRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: SPACING.sm },
  salaryBlock: {},
  salaryInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  salaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 2 },
  salaryValue: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },

  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 13,
    borderRadius: RADIUS.full,
    width: '100%',
    ...SHADOWS.small,
  },
  postBtnOff: { backgroundColor: '#E5E7EB', ...SHADOWS.none },
  postBtnTxt: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  postBtnTxtOff: { color: '#888' },

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md, paddingHorizontal: SPACING.xl, overflow: 'hidden', minHeight: 420 },
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
