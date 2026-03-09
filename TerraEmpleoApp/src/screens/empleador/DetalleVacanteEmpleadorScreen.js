import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
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

const PAGO_MAP = {
  jornal: 'Por jornal',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  destajo: 'Por destajo',
};

export default function DetalleVacanteEmpleadorScreen({ route, navigation }) {
  const { vacante: vacanteParam } = route.params;
  const [vacante, setVacante] = useState(vacanteParam);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, aceptadas: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(async () => {
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]} tintColor={COLORS.primary} />
        }
      >
        {/* Hero */}
        <View style={styles.hero}>
          {vacante.foto_portada ? (
            <Image source={{ uri: vacante.foto_portada }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="leaf" size={64} color="rgba(255,255,255,0.4)" />
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
          {/* Edit button */}
          <TouchableOpacity
            style={styles.heroEditBtn}
            onPress={() => navigation.navigate('EditarVacante', { vacante })}
          >
            <Ionicons name="pencil" size={16} color={COLORS.white} />
          </TouchableOpacity>
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

        {/* Stats row */}
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

        {/* CTA button */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('VerPostulaciones', { vacante })}
            activeOpacity={0.88}
          >
            <Ionicons name="people" size={20} color={COLORS.white} />
            <Text style={styles.ctaBtnText}>Ver Postulaciones</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ctaEditBtn}
            onPress={() => navigation.navigate('EditarVacante', { vacante })}
          >
            <Ionicons name="pencil-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
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
                    Tipo de pago: {PAGO_MAP[vacante.tipo_pago] || vacante.tipo_pago}
                  </Text>
                </View>
              )}
              {vacante.salario_ofrecido && (
                <View style={styles.beneficioRow}>
                  <Ionicons name="cash" size={16} color={COLORS.primary} />
                  <Text style={styles.beneficioText}>Salario: ${vacante.salario_ofrecido}</Text>
                </View>
              )}
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

          {/* Descripción */}
          {vacante.descripcion ? (
            <SectionCard icon="document-text-outline" title="Descripción">
              <Text style={styles.descText}>{vacante.descripcion}</Text>
            </SectionCard>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Hero */
  hero: { height: 260, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center',
  },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
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
  heroEditBtn: {
    position: 'absolute', top: SPACING.md, right: SPACING.md,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroContent: {
    position: 'absolute', bottom: SPACING.md, left: SPACING.md, right: SPACING.md,
  },
  heroTitle: {
    fontSize: 24, fontWeight: '800', color: COLORS.white, marginBottom: 6,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  heroMetaText: { fontSize: 13, color: 'rgba(255,255,255,0.82)' },
  heroMetaDot: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginHorizontal: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginTop: -20,
    borderRadius: RADIUS.lg,
    ...SHADOWS.medium,
    overflow: 'hidden',
  },
  statCard: {
    flex: 1, alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  statDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  statNum: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginTop: 2 },

  /* CTA */
  ctaWrap: {
    flexDirection: 'row', gap: SPACING.sm,
    marginHorizontal: SPACING.md, marginTop: SPACING.md,
  },
  ctaBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: COLORS.primary,
    paddingVertical: 14, borderRadius: RADIUS.lg,
    ...SHADOWS.small,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  ctaEditBtn: {
    width: 50, height: 50, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Details */
  details: { padding: SPACING.md, gap: SPACING.md },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  /* Chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: COLORS.primary + '33',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Beneficios */
  beneficiosList: { gap: 10 },
  beneficioRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  beneficioText: { fontSize: 14, color: COLORS.textPrimary },
  textMuted: { color: COLORS.textLight },

  /* Descripción */
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
});
