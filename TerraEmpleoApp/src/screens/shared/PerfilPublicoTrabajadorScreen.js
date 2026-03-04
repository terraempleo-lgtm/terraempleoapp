import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  disponible_inmediatamente: 'Disponible inmediatamente',
};

const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios',
  bachiller: 'Bachiller',
  tecnico_tecnologo: 'Técnico / Tecnólogo',
  universitario: 'Universitario',
};

export default function PerfilPublicoTrabajadorScreen({ route }) {
  const { trabajador_id } = route.params;
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarPerfil();
  }, []);

  const cargarPerfil = async () => {
    try {
      const res = await trabajadoresAPI.perfilPublico(trabajador_id);
      setPerfil(res.data.trabajador);
    } catch (err) {
      Alert.alert('Error', 'No se pudo cargar el perfil del trabajador');
    } finally {
      setCargando(false);
    }
  };

  const mostrarCelular = () => {
    Alert.alert('Contactar', `Celular: ${perfil.celular}`);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero header ── */}
        <View style={styles.hero}>
          <View style={styles.avatarWrapper}>
            {perfil.foto_selfie && perfil.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: perfil.foto_selfie }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={72} color={COLORS.white} />
              </View>
            )}
            {perfil.verificado_sms && (
              <View style={styles.verificadoBadge}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                <Text style={styles.verificadoText}>Verificado</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroName}>{perfil.nombre_completo}</Text>
          <Text style={styles.heroRol}>Trabajador Rural</Text>

          {calificacion > 0 && (
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(calificacion)} size={22} readonly />
              <Text style={styles.ratingText}>
                {calificacion.toFixed(1)} ({perfil.total_calificaciones} {perfil.total_calificaciones === 1 ? 'calificación' : 'calificaciones'})
              </Text>
            </View>
          )}
        </View>

        {/* ── Ubicación ── */}
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Ubicación</Text>
              <Text style={styles.infoValue}>
                {[perfil.municipio, perfil.departamento].filter(Boolean).join(', ') || 'No especificada'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Experiencia y disponibilidad ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Disponibilidad</Text>
          <View style={styles.infoRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Experiencia</Text>
              <Text style={styles.infoValue}>
                {LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia || 'No especificada'}
              </Text>
            </View>
          </View>
          <View style={[styles.infoRow, { marginTop: SPACING.sm }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.infoLabel}>Disponibilidad</Text>
              <Text style={styles.infoValue}>
                {LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad || 'No especificada'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Estudios ── */}
        {(perfil.nivel_estudios || perfil.titulo_estudio) && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Educación</Text>
            <View style={styles.infoRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="school-outline" size={18} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Nivel de estudios</Text>
                <Text style={styles.infoValue}>
                  {LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios || 'No especificado'}
                </Text>
                {perfil.titulo_estudio ? (
                  <Text style={styles.infoSubValue}>{perfil.titulo_estudio}</Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* ── Habilidades ── */}
        {perfil.habilidades && perfil.habilidades.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Habilidades</Text>
            <View style={styles.chipsRow}>
              {perfil.habilidades.map((h, i) => (
                <View key={i} style={styles.chipGreen}>
                  <Text style={styles.chipGreenText}>{h.habilidad}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Cultivos ── */}
        {perfil.cultivos && perfil.cultivos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cultivos</Text>
            <View style={styles.chipsRow}>
              {perfil.cultivos.map((c, i) => (
                <View key={i} style={styles.chipAmber}>
                  <Ionicons name="leaf-outline" size={13} color={COLORS.accent} style={{ marginRight: 3 }} />
                  <Text style={styles.chipAmberText}>{c.cultivo}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Botón Contactar ── */}
        {perfil.puede_contactar && perfil.celular && (
          <TouchableOpacity style={styles.contactarBtn} onPress={mostrarCelular} activeOpacity={0.85}>
            <Ionicons name="call" size={22} color={COLORS.white} />
            <Text style={styles.contactarText}>Contactar trabajador</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: SPACING.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: 16, color: COLORS.textLight },

  // Hero
  hero: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl + SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  avatarWrapper: { alignItems: 'center', marginBottom: SPACING.md },
  avatar: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: COLORS.white,
    ...SHADOWS.large,
  },
  avatarFallback: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: COLORS.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.large,
  },
  verificadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  verificadoText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  heroName: { fontSize: 26, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginTop: SPACING.sm },
  heroRol: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  ratingText: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  // Cards
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  infoValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600', marginTop: 1 },
  infoSubValue: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGreen: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  chipGreenText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  chipAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },
  chipAmberText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

  // Contactar
  contactarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.lg,
    ...SHADOWS.medium,
  },
  contactarText: { fontSize: 17, fontWeight: '700', color: COLORS.white },
});
