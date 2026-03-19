import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';

function LabelValue({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || 'No registrado'}</Text>
    </View>
  );
}

export default function AdminDetalleUsuarioScreen({ route }) {
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!detalle?.user) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={44} color={COLORS.textLight} />
        <Text style={styles.emptyText}>No se pudo cargar el perfil del usuario.</Text>
      </View>
    );
  }

  const { user, perfil, vacantes, postulaciones } = detalle;

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.headerCard}>
          <Text style={styles.nombre}>{user.nombre_completo}</Text>
          <Text style={styles.rol}>{(user.rol || 'usuario').toUpperCase()}</Text>
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: Number(user.activo) === 1 ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[styles.badgeText, { color: Number(user.activo) === 1 ? '#166534' : '#B91C1C' }]}>
                {Number(user.activo) === 1 ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
              <Text style={[styles.badgeText, { color: '#4B5563' }]}>
                ID: {user.validacion_identidad_estado || 'pendiente'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Datos personales</Text>
          <LabelValue label="Celular" value={user.celular} />
          <LabelValue label="Correo" value={user.correo} />
          <LabelValue label="Cédula" value={user.cedula} />
          <LabelValue label="Departamento" value={user.departamento} />
          <LabelValue label="Municipio" value={user.municipio} />
          <LabelValue label="Vereda" value={user.vereda} />
        </View>

        {perfil ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Perfil</Text>
            {user.rol === 'trabajador' ? (
              <>
                <LabelValue label="Nivel de estudios" value={perfil.nivel_estudios} />
                <LabelValue label="Experiencia" value={perfil.anios_experiencia} />
                <LabelValue label="Disponibilidad" value={perfil.disponibilidad} />
              </>
            ) : (
              <>
                <LabelValue label="Empresa/Finca" value={perfil.nombre_empresa_finca} />
                <LabelValue label="Tipo de pago" value={perfil.tipo_pago} />
                <LabelValue label="Ofrece alojamiento" value={Number(perfil.ofrece_alojamiento) === 1 ? 'Sí' : 'No'} />
                <LabelValue label="Ofrece alimentación" value={Number(perfil.ofrece_alimentacion) === 1 ? 'Sí' : 'No'} />
              </>
            )}
          </View>
        ) : null}

        {user.rol === 'empleador' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vacantes creadas</Text>
            <Text style={styles.counter}>{(vacantes || []).length}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Postulaciones realizadas</Text>
            <Text style={styles.counter}>{(postulaciones || []).length}</Text>
          </View>
        )}
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
});
