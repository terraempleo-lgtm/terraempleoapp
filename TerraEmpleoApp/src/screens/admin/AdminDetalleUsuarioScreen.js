import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { useAppTheme } from '../../context/ThemeContext';

const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios', primaria_completa: 'Primaria completa', bachiller: 'Bachiller',
  tecnico_tecnologo: 'Técnico / Tecnólogo', universitario: 'Universitario',
};
const LABELS_EXPERIENCIA = {
  sin: 'Sin experiencia', sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años', '3_5': '3 a 5 años', '5_10': '5 a 10 años', mas_10: 'Más de 10 años',
};
const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  temporada_cosecha: 'Por temporada / cosecha', fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Inmediata',
};
const LABELS_PAGO = {
  jornal: 'Jornal (diario)', semanal: 'Semanal',
  quincenal: 'Quincenal', mensual: 'Mensual', destajo: 'Por tarea / destajo',
  por_kilo: 'Por kilo',
};

function LabelValue({ label, value, colors }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value || 'No registrado'}</Text>
    </View>
  );
}

function Stars({ value = 0 }) {
  const count = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= count ? 'star' : 'star-outline'}
          size={14}
          color={i <= count ? COLORS.star : COLORS.starEmpty}
        />
      ))}
    </View>
  );
}

export default function AdminDetalleUsuarioScreen({ route }) {
  const { colors, isDark } = useAppTheme();
  const usuarioId = route?.params?.usuarioId;
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargarDetalle = useCallback(async () => {
    if (!usuarioId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data } = await adminAPI.getUsuarioDetalle(usuarioId);
      setDetalle(data || null);
    } catch (_) {
      setDetalle(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    cargarDetalle();
  }, [cargarDetalle]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!detalle?.user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No se pudo cargar el perfil del usuario.</Text>
      </View>
    );
  }

  const { user, perfil, vacantes, postulaciones, calificacionesRecibidas } = detalle;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              cargarDetalle();
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
          <View style={styles.headerTop}>
            <View style={styles.profilePhotoWrap}>
              {user.foto_selfie ? (
                <Image source={{ uri: user.foto_selfie }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.profilePhotoFallback}>
                  <Ionicons name="person" size={32} color={COLORS.white} />
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.nombre, { color: colors.textPrimary }]}>{user.nombre_completo}</Text>
              <Text style={[styles.rol, { color: colors.textSecondary }]}>{(user.rol || 'usuario').toUpperCase()}</Text>
              <View style={styles.badgesRow}>
                <View style={[styles.badge, { backgroundColor: Number(user.activo) === 1 ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Text style={[styles.badgeText, { color: Number(user.activo) === 1 ? '#166534' : '#B91C1C' }]}>
                    {Number(user.activo) === 1 ? 'Activo' : 'Inactivo'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                    ID: {user.validacion_identidad_estado || 'pendiente'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Datos personales</Text>
          <LabelValue label="Celular" value={user.celular} colors={colors} />
          <LabelValue label="Correo" value={user.correo} colors={colors} />
          <LabelValue label="Cédula" value={user.cedula} colors={colors} />
          <LabelValue label="Departamento" value={user.departamento} colors={colors} />
          <LabelValue label="Municipio" value={user.municipio} colors={colors} />
          <LabelValue label="Vereda" value={user.vereda} colors={colors} />
        </View>

        {perfil ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Perfil</Text>
            {user.rol === 'trabajador' ? (
              <>
                <LabelValue label="Nivel de estudios" value={LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios} colors={colors} />
                <LabelValue label="Experiencia" value={LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia} colors={colors} />
                <LabelValue label="Disponibilidad" value={LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad} colors={colors} />
              </>
            ) : (
              <>
                <LabelValue label="Empresa/Finca" value={perfil.nombre_empresa_finca} colors={colors} />
                <LabelValue label="Tipo de pago" value={LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago} colors={colors} />
                <LabelValue label="Ofrece alojamiento" value={Number(perfil.ofrece_alojamiento) === 1 ? 'Sí' : 'No'} colors={colors} />
                <LabelValue label="Ofrece alimentación" value={Number(perfil.ofrece_alimentacion) === 1 ? 'Sí' : 'No'} colors={colors} />
              </>
            )}
          </View>
        ) : null}

        {user.rol === 'empleador' ? (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Vacantes creadas</Text>
            <Text style={styles.counter}>{(vacantes || []).length}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Postulaciones realizadas</Text>
            <Text style={styles.counter}>{(postulaciones || []).length}</Text>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface }]}> 
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Calificaciones recibidas (interno)</Text>
          {(calificacionesRecibidas || []).length === 0 ? (
            <Text style={[styles.emptySmall, { color: colors.textSecondary }]}>Sin calificaciones registradas.</Text>
          ) : (
            (calificacionesRecibidas || []).map((c) => (
              <View key={String(c.id)} style={[styles.ratingItem, { borderColor: colors.border }]}> 
                <View style={styles.ratingTop}>
                  <Text style={[styles.ratingBy, { color: colors.textPrimary }]} numberOfLines={1}>{c.nombre_calificador}</Text>
                  <Text style={[styles.ratingDate, { color: colors.textMuted }]}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('es-CO') : ''}
                  </Text>
                </View>
                <View style={styles.ratingMid}>
                  <Stars value={c.estrellas} />
                  <Text style={[styles.ratingScore, { color: colors.textSecondary }]}>{Number(c.estrellas || 0).toFixed(1)}</Text>
                </View>
                {c.vacante_titulo ? (
                  <Text style={[styles.ratingVacante, { color: colors.textMuted }]} numberOfLines={1}>Vacante: {c.vacante_titulo}</Text>
                ) : null}
                {c.comentario ? (
                  <Text style={[styles.ratingComment, { color: colors.textSecondary }]}>{c.comentario}</Text>
                ) : (
                  <Text style={[styles.ratingCommentEmpty, { color: colors.textMuted }]}>Sin comentario interno.</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  profilePhotoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#B0BEC5',
    flexShrink: 0,
  },
  profilePhoto: {
    width: 72,
    height: 72,
  },
  profilePhotoFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  nombre: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  rol: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  badgesRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  row: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  label: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  counter: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  emptySmall: {
    fontSize: 13,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingItem: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  ratingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingBy: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  ratingDate: {
    fontSize: 11,
  },
  ratingMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ratingScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  ratingVacante: {
    marginTop: 2,
    fontSize: 11,
  },
  ratingComment: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
  },
  ratingCommentEmpty: {
    marginTop: 6,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
