import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI } from '../../services/api';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';
import AnimatedPressable from '../../components/animated/AnimatedPressable';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Publicado hoy';
  if (diff === 1) return 'Publicado hace 1 día';
  return `Publicado hace ${diff} días`;
}

function CultivoChip({ label, colors }) {
  return (
    <View style={[styles.chip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
      <Ionicons name="leaf" size={11} color={colors.primary} />
      <Text style={[styles.chipText, { color: colors.primary }]}>{label}</Text>
    </View>
  );
}

function LaborChip({ label, colors }) {
  return (
    <View style={[styles.chip, { backgroundColor: COLORS.infoSoft, borderColor: COLORS.info + '40' }]}>
      <Text style={[styles.chipText, { color: COLORS.info }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ icon, title, children, colors }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BeneficioRow({ icon, iconColor, text, colors, muted }) {
  return (
    <View style={styles.beneficioRow}>
      <View style={[styles.beneficioIconWrap, { backgroundColor: (iconColor || colors.primary) + '15' }]}>
        <Ionicons name={icon} size={15} color={iconColor || colors.primary} />
      </View>
      <Text style={[styles.beneficioText, { color: muted ? colors.textMuted : colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

export default function DetalleVacanteEmpleadorScreen({ route, navigation }) {
  const { colors } = useAppTheme();
  const { vacante: vacanteParam } = route.params;
  const [vacante, setVacante] = useState(vacanteParam);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, aceptadas: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [fotoActiva, setFotoActiva] = useState(0);

  const confirmarArchivar = () => {
    showAlert(
      'Archivar vacante',
      `¿Cerrar "${vacante.titulo}"? La vacante dejará de ser visible para los trabajadores pero quedará en tus registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Archivar',
          onPress: async () => {
            try {
              await vacantesAPI.cerrar(vacanteParam.id);
              showAlert('Listo', 'Vacante archivada correctamente');
              navigation.goBack();
            } catch (err) {
              showAlert('Error', err.response?.data?.error || 'No se pudo archivar la vacante');
            }
          },
        },
      ]
    );
  };

  const cargar = useCallback(async () => {
    try {
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
    if (!Number.isNaN(index)) setFotoActiva(index);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Hero fotos ────────────────────────────────────── */}
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
            <View style={[styles.heroPlaceholder, { backgroundColor: colors.primary + 'cc' }]}>
              <View style={styles.heroPlaceholderIcon}>
                <Ionicons name="leaf" size={48} color="rgba(255,255,255,0.85)" />
              </View>
              <Text style={styles.heroPlaceholderText}>Sin fotos cargadas</Text>
            </View>
          )}

          {/* Gradient overlay */}
          <View style={styles.heroGradient} />

          {/* Status badge */}
          <View style={[
            styles.heroBadge,
            isActiva
              ? { backgroundColor: COLORS.badgeActive }
              : { backgroundColor: COLORS.badgeInactive },
          ]}>
            <View style={[
              styles.heroBadgeDot,
              { backgroundColor: isActiva ? COLORS.badgeActiveText : COLORS.badgeInactiveText },
            ]} />
            <Text style={[
              styles.heroBadgeText,
              { color: isActiva ? COLORS.badgeActiveText : COLORS.badgeInactiveText },
            ]}>
              {isActiva ? 'Activa' : 'Inactiva'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.heroActionBtns}>
            <AnimatedPressable
              style={styles.heroActionBtn}
              onPress={() => navigation.navigate('EditarVacante', { vacante })}
              hapticStyle="Light"
            >
              <Ionicons name="pencil" size={16} color={COLORS.white} />
            </AnimatedPressable>
            {isActiva && (
              <AnimatedPressable
                style={[styles.heroActionBtn, { backgroundColor: 'rgba(245,158,11,0.8)' }]}
                onPress={confirmarArchivar}
                hapticStyle="Light"
              >
                <Ionicons name="archive" size={16} color={COLORS.white} />
              </AnimatedPressable>
            )}
          </View>

          {/* Photo counter */}
          {heroFotos.length > 0 && (
            <View style={styles.heroCounter}>
              <Ionicons name="images-outline" size={12} color={COLORS.white} />
              <Text style={styles.heroCounterText}>{fotoActiva + 1}/{heroFotos.length}</Text>
            </View>
          )}

          {/* Title block */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle} numberOfLines={2}>{vacante.titulo}</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.75)" />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {vacante.nombre_empresa_finca || 'Mi finca'}
              </Text>
              {!!(vacante.municipio || vacante.departamento) && (
                <>
                  <Text style={styles.heroMetaDot}>·</Text>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.heroMetaText}>
                    {[vacante.municipio, vacante.departamento].filter(Boolean).join(', ')}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.heroTime}>{timeAgo(vacante.created_at)}</Text>
          </View>
        </View>

        {/* ── Stats de postulaciones ────────────────────────── */}
        <View style={[styles.statsPanel, { backgroundColor: colors.surface }]}>
          <View style={styles.panelHeader}>
            <View style={[styles.panelHeaderIcon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="people-outline" size={17} color={colors.primary} />
            </View>
            <Text style={[styles.panelHeaderTitle, { color: colors.textPrimary }]}>
              Resumen de postulaciones
            </Text>
          </View>

          <View style={styles.statsGrid}>
            {/* Total */}
            <AnimatedPressable
              style={[styles.statCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '25' }]}
              onPress={() => navigation.navigate('VerPostulaciones', { vacante })}
              scaleValue={0.97}
            >
              <Text style={[styles.statNum, { color: colors.primary }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>POSTULANTES</Text>
            </AnimatedPressable>

            {/* Nuevos */}
            <View style={[styles.statCard, { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warning + '35' }]}>
              <Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.pendientes}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>NUEVOS</Text>
            </View>

            {/* Aceptados */}
            <View style={[styles.statCard, { backgroundColor: COLORS.badgeActive, borderColor: COLORS.badgeActiveText + '35' }]}>
              <Text style={[styles.statNum, { color: COLORS.badgeActiveText }]}>{stats.aceptadas}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>ACEPTADOS</Text>
            </View>
          </View>

          {/* CTA row */}
          <View style={styles.ctaRow}>
            <AnimatedPressable
              style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('VerPostulaciones', { vacante })}
            >
              <Ionicons name="people" size={18} color={COLORS.white} />
              <Text style={styles.ctaBtnText}>Ver postulaciones</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.ctaEditBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}
              onPress={() => navigation.navigate('EditarVacante', { vacante })}
              scaleValue={0.95}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </AnimatedPressable>
          </View>
        </View>

        {/* ── Descripción ───────────────────────────────────── */}
        {!!vacante.descripcion && (
          <SectionCard icon="document-text-outline" title="Descripción" colors={colors}>
            <Text style={[styles.descText, { color: colors.textSecondary }]}>
              {vacante.descripcion}
            </Text>
          </SectionCard>
        )}

        {/* ── Sections ──────────────────────────────────────── */}
        <View style={styles.sections}>

          {/* Cultivos */}
          {vacante.cultivos?.length > 0 && (
            <SectionCard icon="leaf-outline" title="Cultivos" colors={colors}>
              <View style={styles.chipsWrap}>
                {vacante.cultivos.map((c, i) => (
                  <CultivoChip
                    key={i}
                    label={c.cultivo || c.nombre || String(c)}
                    colors={colors}
                  />
                ))}
              </View>
            </SectionCard>
          )}

          {/* Labores */}
          {vacante.labores?.length > 0 && (
            <SectionCard icon="construct-outline" title="Labores requeridas" colors={colors}>
              <View style={styles.chipsWrap}>
                {vacante.labores.map((l, i) => (
                  <LaborChip
                    key={i}
                    label={l.labor || l.nombre || String(l)}
                    colors={colors}
                  />
                ))}
              </View>
            </SectionCard>
          )}

          {/* Pago y beneficios */}
          <SectionCard icon="cash-outline" title="Pago y beneficios" colors={colors}>
            <View style={styles.beneficiosList}>
              {!!vacante.tipo_pago && (
                <BeneficioRow
                  icon="card-outline"
                  text={`Tipo de pago: ${pago.tipoLabel || vacante.tipo_pago}`}
                  colors={colors}
                />
              )}
              <BeneficioRow
                icon="cash"
                text={`Salario: ${pago.valor}`}
                colors={colors}
              />
              {!!vacante.duracion && (
                <BeneficioRow
                  icon="time-outline"
                  text={`Duración: ${vacante.duracion}`}
                  colors={colors}
                />
              )}
              <BeneficioRow
                icon={vacante.ofrece_alojamiento ? 'checkmark-circle' : 'close-circle-outline'}
                iconColor={vacante.ofrece_alojamiento ? COLORS.success : COLORS.textLight}
                text={`Alojamiento ${vacante.ofrece_alojamiento ? 'incluido' : 'no incluido'}`}
                colors={colors}
                muted={!vacante.ofrece_alojamiento}
              />
              <BeneficioRow
                icon={vacante.ofrece_alimentacion ? 'checkmark-circle' : 'close-circle-outline'}
                iconColor={vacante.ofrece_alimentacion ? COLORS.success : COLORS.textLight}
                text={`Alimentación ${vacante.ofrece_alimentacion ? 'incluida' : 'no incluida'}`}
                colors={colors}
                muted={!vacante.ofrece_alimentacion}
              />
              {!!vacante.otros_beneficios && (
                <BeneficioRow
                  icon="gift-outline"
                  iconColor={COLORS.accent}
                  text={vacante.otros_beneficios}
                  colors={colors}
                />
              )}
            </View>
          </SectionCard>

          {/* Fechas */}
          <SectionCard icon="calendar-clear-outline" title="Fechas" colors={colors}>
            <View style={styles.beneficiosList}>
              <BeneficioRow
                icon="play-circle-outline"
                text={`Inicio: ${fechaInicioTexto}`}
                colors={colors}
              />
              <BeneficioRow
                icon="stop-circle-outline"
                iconColor={vacante.fecha_fin ? COLORS.warning : COLORS.textLight}
                text={`Finalización: ${
                  vacante.fecha_fin
                    ? formatVacancyStartDate(vacante.fecha_fin, { long: true, fallback: 'Por definir' })
                    : 'Sin fecha límite'
                }`}
                colors={colors}
                muted={!vacante.fecha_fin}
              />
            </View>
          </SectionCard>

          {/* Requisitos */}
          {!!vacante.requisitos && (
            <SectionCard icon="checkmark-done-outline" title="Requisitos" colors={colors}>
              <Text style={[styles.descText, { color: colors.textSecondary }]}>
                {vacante.requisitos}
              </Text>
            </SectionCard>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },

  /* ── Hero ─────────────────────────────────────────────── */
  hero: { height: 260, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
  },
  heroPlaceholderIcon: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroPlaceholderText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  heroDotsWrap: {
    position: 'absolute', bottom: 58, left: 0, right: 0, alignItems: 'center',
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
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  heroBadgeDot: { width: 7, height: 7, borderRadius: 4 },
  heroBadgeText: { fontSize: 12, fontWeight: '700' },
  heroActionBtns: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    flexDirection: 'row', gap: 8,
  },
  heroActionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroCounter: {
    position: 'absolute', bottom: 14, right: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  heroCounterText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  heroContent: {
    position: 'absolute', bottom: SPACING.md, left: SPACING.md, right: SPACING.md,
  },
  heroTitle: {
    fontSize: 22, fontWeight: '800', color: COLORS.white,
    marginBottom: 5, letterSpacing: -0.2,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 3 },
  heroMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  heroMetaDot: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginHorizontal: 1 },
  heroTime: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  /* ── Stats panel ─────────────────────────────────────── */
  statsPanel: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: SPACING.md,
  },
  panelHeaderIcon: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  panelHeaderTitle: { fontSize: 15, fontWeight: '700' },
  statsGrid: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg, borderWidth: 1.5,
  },
  statNum: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginTop: 3 },

  /* CTA */
  ctaRow: { flexDirection: 'row', gap: SPACING.sm },
  ctaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  ctaEditBtn: {
    width: 48, height: 48, borderRadius: RADIUS.full,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },

  /* ── Description ─────────────────────────────────────── */
  descText: { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary },

  /* ── Sections ────────────────────────────────────────── */
  sections: { padding: SPACING.md, paddingTop: SPACING.sm, gap: SPACING.sm },
  sectionCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.small,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  sectionIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  /* Chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  /* Beneficios */
  beneficiosList: { gap: 10 },
  beneficioRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  beneficioIconWrap: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  beneficioText: { flex: 1, fontSize: 13, lineHeight: 20 },
});
