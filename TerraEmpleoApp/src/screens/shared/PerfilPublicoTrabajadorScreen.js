import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { StarRating } from '../../components/ui';
import { trabajadoresAPI } from '../../services/api';

const LABELS_EXPERIENCIA = {
  sin: 'Sin experiencia',
  sin_experiencia: 'Sin experiencia',
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: 'Más de 10 años',
};

const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo',
  por_dias: 'Por días',
  temporada_cosecha: 'Por temporada / cosecha',
  fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Disponibilidad Inmediata',
  inmediata: 'Disponibilidad Inmediata',
};

const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios',
  bachiller: 'Bachiller',
  tecnico_tecnologo: 'Técnico / Tecnólogo',
  universitario: 'Universitario',
};

function SectionHeader({ icon, title }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function PerfilPublicoTrabajadorScreen({ route, navigation }) {
  const { trabajador_id } = route.params;
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => { cargarPerfil(); }, []);

  const cargarPerfil = async () => {
    try {
      const res = await trabajadoresAPI.perfilPublico(trabajador_id);
      setPerfil(res.data.trabajador);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el perfil del trabajador');
    } finally {
      setCargando(false);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!perfil) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-outline" size={48} color={COLORS.textLight} />
        <Text style={styles.emptyText}>Perfil no disponible</Text>
      </View>
    );
  }

  const calificacion = parseFloat(perfil.calificacion_promedio || 0);
  const totalCal = Number(perfil.total_calificaciones || 0);
  const disponibilidad = LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad;
  const experiencia = LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia;
  const estudios = LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios;

  const especialidades = [
    ...(perfil.habilidades || []).map(h => h.habilidad),
    ...(perfil.cultivos || []).map(c => c.cultivo),
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Hero verde ── */}
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          {/* Back button */}
          <View style={styles.heroTopBar}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {perfil.foto_selfie && perfil.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: perfil.foto_selfie }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={52} color={COLORS.primary} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="briefcase" size={14} color={COLORS.white} />
            </View>
          </View>

          {/* Nombre y ubicación */}
          <Text style={styles.name}>{perfil.nombre_completo}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
            <Text style={styles.locationText}>
              {[perfil.municipio, perfil.departamento].filter(Boolean).join(', ') || 'Colombia'}
            </Text>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>COSECHAS</Text>
            <Text style={styles.statValue}>{perfil.total_cosechas || perfil.cultivos?.length || 0}</Text>
            <Text style={styles.statSub}>Finalizadas con éxito</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CALIFICACIÓN</Text>
            <View style={styles.statRating}>
              <Text style={styles.statValue}>{calificacion > 0 ? calificacion.toFixed(1) : '—'}</Text>
              {calificacion > 0 && <Ionicons name="star" size={18} color="#FFB300" />}
            </View>
            <Text style={styles.statSub}>
              {totalCal > 0 ? `${totalCal} Reseñas` : 'Sin reseñas aún'}
            </Text>
          </View>
        </View>

        {/* ── Especialidades ── */}
        {especialidades.length > 0 && (
          <View style={styles.section}>
            <SectionHeader icon="flash" title="Especialidades" />
            <View style={styles.chipsWrap}>
              {especialidades.map((e, i) => (
                <View key={i} style={styles.chipSolid}>
                  <Text style={styles.chipSolidText}>{e}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Experiencia ── */}
        {(experiencia || disponibilidad || estudios) && (
          <View style={styles.section}>
            <SectionHeader icon="briefcase" title="Experiencia" />
            <View style={styles.timelineWrap}>
              {experiencia && (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{experiencia}</Text>
                    <Text style={styles.timelineSub}>Experiencia en campo</Text>
                    {disponibilidad && (
                      <Text style={styles.timelineQuote}>"{disponibilidad}"</Text>
                    )}
                  </View>
                </View>
              )}
              {estudios && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotLight]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>{estudios}</Text>
                    <Text style={styles.timelineSub}>
                      {perfil.titulo_estudio || 'Nivel educativo'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* ── Footer sticky: Contratar ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <TouchableOpacity
          style={styles.contratarBtn}
          onPress={() => Alert.alert('Contratar', 'Acepta la postulación del trabajador para proceder con la contratación.')}
          activeOpacity={0.88}
        >
          <Text style={styles.contratarText}>Contratar Trabajador</Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F4' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, color: COLORS.textLight },

  /* Hero */
  hero: {
    backgroundColor: COLORS.primary,
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  heroTopBar: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Avatar */
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#80c9a0',
  },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#80c9a0',
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

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
    paddingVertical: SPACING.md + 4,
    paddingHorizontal: SPACING.sm,
  },
  statDivider: { width: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.md },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  statRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },

  /* Sections */
  section: { marginHorizontal: SPACING.md, marginTop: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },

  /* Chips */
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chipSolid: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  chipSolidText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  /* Timeline */
  timelineWrap: { paddingLeft: SPACING.sm },
  timelineItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: COLORS.primary, marginTop: 4, flexShrink: 0,
  },
  timelineDotLight: { backgroundColor: '#80c9a0' },
  timelineLine: {
    position: 'absolute', left: 6, top: 18,
    width: 2, height: 40, backgroundColor: '#b3dfc7',
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  timelineSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  timelineQuote: {
    fontSize: 13, color: COLORS.textSecondary,
    fontStyle: 'italic', marginTop: 6, lineHeight: 18,
  },

  /* Contacto */
  contactCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, ...SHADOWS.small,
  },
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, gap: SPACING.md,
  },
  contactDivider: { height: 1, backgroundColor: COLORS.borderLight },
  contactIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.4 },
  contactValue: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600', marginTop: 2 },
  contactAction: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  contactActionText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1, borderColor: COLORS.borderLight,
    ...SHADOWS.large,
  },
  contratarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: RADIUS.full,
  },
  contratarText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
});
