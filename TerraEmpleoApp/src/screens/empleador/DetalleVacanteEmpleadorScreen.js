import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, RefreshControl, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { Ionicons } from '@expo/vector-icons';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Publicado hoy';
  if (diff === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${diff} días`;
}

function Chip({ label }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function DetalleVacanteEmpleadorScreen({ route, navigation }) {
  const { vacante: vacanteParam } = route.params;
  const [vacante, setVacante] = useState(vacanteParam);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, aceptadas: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [fotoActiva, setFotoActiva] = useState(0);

  const confirmarArchivar = () => {
    Alert.alert(
      'Archivar vacante',
      `¿Cerrar "${vacante.titulo}"? La vacante dejará de ser visible para los trabajadores pero quedará en tus registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          onPress: async () => {
            try {
              await vacantesAPI.cerrar(vacanteParam.id);
              Alert.alert('Listo', 'Vacante archivada correctamente');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo archivar la vacante');
            }
          },
        },
      ]
    );
  };

  const cargar = useCallback(async () => {
    try {
      // Cargar vacante completa con fotos firmadas
      const vacanteRes = await vacantesAPI.detalle(vacanteParam.id);
      if (vacanteRes.data?.vacante) {
        setVacante(vacanteRes.data.vacante);
      }
    } catch (_) {
      // Si falla el detalle, mantener datos del param
    }
    try {
      const res = await vacantesAPI.verPostulaciones(vacanteParam.id);
      const posts = res.data.postulaciones || [];
      setStats({
        total: posts.length,
        pendientes: posts.filter(p => p.estado === 'pendiente').length,
        aceptadas: posts.filter(p => p.estado === 'aceptada').length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, [vacanteParam.id]);

  useEffect(() => { cargar(); }, []);

  const isActiva = vacante.estado === 'activa';
  const pago = getVacancyPayDisplay(vacante);
  const fechaInicioTexto = formatVacancyStartDate(vacante.fecha_inicio, {
    long: true,
    fallback: 'Por definir',
  });
  const fotos = (vacante.fotos || []).map((f) => f?.url).filter(Boolean);
  const heroFotos = fotos.length > 0
    ? fotos
    : vacante.foto_portada
      ? [vacante.foto_portada]
      : [];

  const onScrollFotos = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / e.nativeEvent.layoutMeasurement.width);
    if (!Number.isNaN(index)) {
      setFotoActiva(index);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* Hero fotos */}
        <View style={styles.hero}>
          {heroFotos.length > 1 ? (
            <>
              <FlatList
                data={heroFotos}
                keyExtractor={(_, idx) => `foto-${idx}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollFotos}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.heroImg} resizeMode="cover" />
                )}
              />
              <View style={styles.heroDotsWrap}>
                <View style={styles.heroDotsInner}>
                  {heroFotos.map((_, idx) => (
                    <View key={idx} style={[styles.heroDot, idx === fotoActiva && styles.heroDotActive]} />
                  ))}
                </View>
              </View>
            </>
          ) : heroFotos.length === 1 ? (
            <Image source={{ uri: heroFotos[0] }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <View style={styles.heroPlaceholderIcon}>
                <Ionicons name="image-outline" size={48} color={COLORS.primaryLight} />
              </View>
              <Text style={styles.heroPlaceholderText}>Sin fotos cargadas</Text>
            </View>
          )}
          <View style={styles.heroGradient} />
          {/* Badge */}
          <View style={[styles.heroBadge, !isActiva && styles.heroBadgeInactiva]}>
            <View style={[styles.heroBadgeDot, !isActiva && styles.heroBadgeDotInactiva]} />
            <Text style={[styles.heroBadgeText, !isActiva && styles.heroBadgeTextInactiva]}>
              {isActiva ? 'Activa' : 'Inactiva'}
            </Text>
          </View>
          {/* Action buttons */}
          <View style={styles.heroActionBtns}>
            <TouchableOpacity
              style={styles.heroEditBtn}
              onPress={() => navigation.navigate('EditarVacante', { vacante })}
            >
              <Ionicons name="pencil" size={16} color={COLORS.white} />
            </TouchableOpacity>
            {isActiva && (
              <TouchableOpacity
                style={[styles.heroEditBtn, { backgroundColor: 'rgba(255,143,0,0.7)' }]}
                onPress={confirmarArchivar}
              >
                <Ionicons name="archive" size={16} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
          {heroFotos.length > 0 ? (
            <View style={styles.heroCounter}>
              <Ionicons name="images-outline" size={13} color={COLORS.white} />
              <Text style={styles.heroCounterText}>{fotoActiva + 1}/{heroFotos.length}</Text>
            </View>
          ) : null}
          {/* Title block */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{vacante.titulo}</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroMetaText}>
                {[vacante.municipio, vacante.departamento].filter(Boolean).join(', ')}, Colombia
              </Text>
              <Text style={styles.heroMetaDot}>·</Text>
              <Text style={styles.heroMetaText}>{timeAgo(vacante.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Descripción debajo de fotos */}
        {vacante.descripcion ? (
          <View style={styles.descripcionCard}>
            <View style={styles.descripcionHeader}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.descripcionTitle}>Descripción</Text>
            </View>
            <Text style={styles.descTextStrong}>{vacante.descripcion}</Text>
          </View>
        ) : null}

        {/* Panel postulaciones */}
        <View style={styles.postulacionesPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderIcon}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.panelHeaderTitle}>Resumen de postulaciones</Text>
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => navigation.navigate('VerPostulaciones', { vacante })}
              activeOpacity={0.75}
            >
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLabel}>POSTULANTES</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats.pendientes}</Text>
              <Text style={styles.statLabel}>NUEVOS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statNum}>{stats.aceptadas}</Text>
              <Text style={styles.statLabel}>ACEPTADOS</Text>
            </View>
          </View>

          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => navigation.navigate('VerPostulaciones', { vacante })}
              activeOpacity={0.88}
            >
              <Ionicons name="people" size={18} color={COLORS.white} />
              <Text style={styles.ctaBtnText}>Ver postulaciones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaEditBtn}
              onPress={() => navigation.navigate('EditarVacante', { vacante })}
              activeOpacity={0.88}
            >
              <Ionicons name="pencil-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Details */}
        <View style={styles.details}>
          {/* Cultivos */}
          {vacante.cultivos?.length > 0 && (
            <SectionCard icon="leaf-outline" title="Cultivos">
              <View style={styles.chipsWrap}>
                {vacante.cultivos.map((c, i) => <Chip key={i} label={c.cultivo || c.nombre || String(c)} />)}
              </View>
            </SectionCard>
          )}

          {/* Labores */}
          {vacante.labores?.length > 0 && (
            <SectionCard icon="construct-outline" title="Labores requeridas">
              <View style={styles.chipsWrap}>
                {vacante.labores.map((l, i) => <Chip key={i} label={l.labor || l.nombre || String(l)} />)}
              </View>
            </SectionCard>
          )}

          {/* Pago y beneficios */}
          <SectionCard icon="cash-outline" title="Pago y beneficios">
            <View style={styles.beneficiosList}>
              {vacante.tipo_pago && (
                <View style={styles.beneficioRow}>
                  <Ionicons name="card-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.beneficioText}>
                    Tipo de pago: {pago.tipoLabel || vacante.tipo_pago}
                  </Text>
                </View>
              )}
              <View style={styles.beneficioRow}>
                <Ionicons name="cash" size={16} color={COLORS.primary} />
                <Text style={styles.beneficioText}>Salario: {pago.valor}</Text>
              </View>
              {vacante.duracion ? (
                <View style={styles.beneficioRow}>
                  <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.beneficioText}>Duración: {vacante.duracion}</Text>
                </View>
              ) : null}
              <View style={styles.beneficioRow}>
                <Ionicons
                  name={vacante.ofrece_alojamiento ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={vacante.ofrece_alojamiento ? COLORS.primary : COLORS.textLight}
                />
                <Text style={[styles.beneficioText, !vacante.ofrece_alojamiento && styles.textMuted]}>
                  Alojamiento {vacante.ofrece_alojamiento ? 'incluido' : 'no incluido'}
                </Text>
              </View>
              <View style={styles.beneficioRow}>
                <Ionicons
                  name={vacante.ofrece_alimentacion ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={vacante.ofrece_alimentacion ? COLORS.primary : COLORS.textLight}
                />
                <Text style={[styles.beneficioText, !vacante.ofrece_alimentacion && styles.textMuted]}>
                  Alimentación {vacante.ofrece_alimentacion ? 'incluida' : 'no incluida'}
                </Text>
              </View>
              {vacante.otros_beneficios ? (
                <View style={styles.beneficioRow}>
                  <Ionicons name="gift-outline" size={16} color={COLORS.accent} />
                  <Text style={styles.beneficioText}>{vacante.otros_beneficios}</Text>
                </View>
              ) : null}
            </View>
          </SectionCard>

          <SectionCard icon="calendar-clear-outline" title="Fechas">
            <View style={styles.beneficiosList}>
              <View style={styles.beneficioRow}>
                <Ionicons name="play-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.beneficioText}>Inicio: {fechaInicioTexto}</Text>
              </View>
              <View style={styles.beneficioRow}>
                <Ionicons name="stop-circle-outline" size={16} color={vacante.fecha_fin ? COLORS.accent : COLORS.textLight} />
                <Text style={styles.beneficioText}>
                  Finalización: {vacante.fecha_fin
                    ? formatVacancyStartDate(vacante.fecha_fin, { long: true, fallback: 'Por definir' })
                    : 'Sin fecha límite'}
                </Text>
              </View>
            </View>
          </SectionCard>

          {vacante.requisitos ? (
            <SectionCard icon="checkmark-done-outline" title="Requisitos">
              <Text style={styles.descText}>{vacante.requisitos}</Text>
            </SectionCard>
          ) : null}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: SPACING.lg },

  /* Hero */
  hero: { height: 230, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
  },
  heroPlaceholderIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroPlaceholderText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroDotsWrap: {
    position: 'absolute', bottom: 50, left: 0, right: 0,
    alignItems: 'center',
  },
  heroDotsInner: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
  heroDotActive: { backgroundColor: COLORS.white, width: 20 },
  heroBadge: {
    position: 'absolute', top: SPACING.md, left: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  heroBadgeInactiva: { backgroundColor: 'rgba(240,240,240,0.9)' },
  heroBadgeDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  heroBadgeDotInactiva: { backgroundColor: COLORS.textLight },
  heroBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  heroBadgeTextInactiva: { color: COLORS.textSecondary },
  heroActionBtns: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    flexDirection: 'row', gap: 8,
  },
  heroEditBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroCounter: {
    position: 'absolute', bottom: 14, right: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  heroCounterText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  heroContent: {
    position: 'absolute', bottom: SPACING.md, left: SPACING.md, right: SPACING.md,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  heroMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  heroMetaDot: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginHorizontal: 2 },

  descripcionCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    ...SHADOWS.card,
  },
  descripcionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 6 },
  descripcionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  descTextStrong: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 21 },

  /* Stats */
  postulacionesPanel: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
    paddingBottom: SPACING.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
  },
  panelHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelHeaderTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    marginHorizontal: SPACING.sm,
    marginTop: 6,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  statCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  statDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.sm },
  statNum: { fontSize: 23, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.5, marginTop: 2 },

  /* CTA */
  ctaWrap: {
    flexDirection: 'row', gap: SPACING.sm,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
  },
  ctaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    ...SHADOWS.button,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  ctaEditBtn: {
    width: 46, height: 46, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Details */
  details: { padding: SPACING.md, gap: SPACING.sm },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    ...SHADOWS.small,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  /* Chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.primary + '33',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  /* Beneficios */
  beneficiosList: { gap: 8 },
  beneficioRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  beneficioText: { fontSize: 13, color: COLORS.textPrimary },
  textMuted: { color: COLORS.textSecondary },

  /* Descripción */
  fechaInicioValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
});
