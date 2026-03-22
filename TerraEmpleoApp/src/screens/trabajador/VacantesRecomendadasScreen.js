import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AnimatedPressable, StaggeredItem, SkeletonCard } from '../../components/animated';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';

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
      Alert.alert('Listo', 'Te has postulado exitosamente.');
    } catch (err) {
      if (err.response?.status === 409) {
        setVacantesPostuladas((prev) => { const n = new Set(prev); n.add(Number(item.id)); return n; });
        Alert.alert('Aviso', 'Ya estás postulado a esta vacante.');
        return;
      }
      Alert.alert('Error', err.response?.data?.error || 'Error al postularse');
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
          style={styles.card}
          onPress={() => navigation.navigate('DetalleVacanteRecomendada', { vacante: item })}
          scaleValue={ANIMATION.scale.pressedSubtle}
          haptic={false}
        >
          {/* Hero */}
          <View style={styles.cardHero}>
            {item.foto_portada ? (
              <Image source={{ uri: item.foto_portada }} style={styles.heroImg} resizeMode="cover" />
            ) : (
              <View style={styles.heroFallback}>
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
            <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>

            {item.nombre_empresa_finca ? (
              <Text style={styles.cardFarm} numberOfLines={1}>{item.nombre_empresa_finca}</Text>
            ) : null}

            {/* Proximidad + time */}
            <View style={styles.metaRow}>
              {prox.label ? (
                <View style={[styles.proxBadge, { backgroundColor: prox.color + '18' }]}>
                  <Ionicons name={prox.icon} size={11} color={prox.color} />
                  <Text style={[styles.proxText, { color: prox.color }]}>{prox.label}</Text>
                </View>
              ) : null}
              <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
            </View>

            {/* Tags */}
            <View style={styles.tagsRow}>
              {cultivos.map((c, i) => (
                <View key={`c${i}`} style={styles.tagGreen}>
                  <Ionicons name="leaf" size={10} color={COLORS.primary} />
                  <Text style={styles.tagGreenTxt}>{c}</Text>
                </View>
              ))}
              {labores.map((l, i) => (
                <View key={`l${i}`} style={styles.tagGray}>
                  <Ionicons name="construct-outline" size={10} color={COLORS.textSecondary} />
                  <Text style={styles.tagGrayTxt}>{l}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Bottom: pago + postular */}
            <View style={styles.bottomRow}>
              <View>
                <Text style={styles.salaryLabel}>
                  {pago.tipoLabel ? pago.tipoLabel.toUpperCase() : 'SALARIO'}
                </Text>
                <Text style={styles.salaryValue}>
                  {pago.valor !== 'A convenir' ? pago.valor : 'A convenir'}
                </Text>
              </View>
              <AnimatedPressable
                style={[styles.postBtn, yaPostulado && styles.postBtnOff]}
                onPress={() => { if (!yaPostulado) postularse(item); }}
                disabled={yaPostulado}
                scaleValue={ANIMATION.scale.pressed}
                haptic={!yaPostulado}
              >
                <Ionicons
                  name={yaPostulado ? 'checkmark-circle' : 'paper-plane'}
                  size={14}
                  color={yaPostulado ? '#888' : COLORS.white}
                />
                <Text style={[styles.postBtnTxt, yaPostulado && styles.postBtnTxtOff]}>
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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="sparkles" size={22} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Para ti, {firstName}</Text>
              <Text style={styles.headerSub}>Vacantes que coinciden con tu perfil</Text>
            </View>
          </View>
        </View>
      </MotiView>

      {vacantes.length > 0 ? (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{vacantes.length}</Text>
            <Text style={styles.statLabel}>Recomendadas</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: COLORS.primary }]}>
              {vacantes.filter((v) => v.puntaje_match >= 60).length}
            </Text>
            <Text style={styles.statLabel}>Alto match</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: COLORS.info }]}>
              {vacantes.filter((v) => v.proximidad !== 'lejano').length}
            </Text>
            <Text style={styles.statLabel}>Cerca de ti</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
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
                <View style={styles.emptyIcon}>
                  <Ionicons name="sparkles-outline" size={48} color={COLORS.primary} />
                </View>
              </MotiView>
              <Text style={styles.emptyTitle}>Sin recomendaciones aún</Text>
              <Text style={styles.emptySub}>
                Completa tu perfil con cultivos y habilidades para recibir mejores recomendaciones.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF9' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
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

  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm, paddingHorizontal: SPACING.xl },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptySub: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});
