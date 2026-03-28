import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { AnimatedPressable } from '../../components/animated';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return parsed.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminVerificacionCedulasScreen() {
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargarPendientes = useCallback(async () => {
    try {
      const { data } = await adminAPI.getCedulasPendientes();
      setPendientes(data?.pendientes || []);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudieron cargar las cédulas pendientes';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarPendientes();
  };

  const revisarPendiente = (item, estado) => {
    const accionLabel = estado === 'aprobada' ? 'aprobar' : 'rechazar';
    showAlert(
      estado === 'aprobada' ? 'Aprobar identidad' : 'Rechazar identidad',
      `¿Deseas ${accionLabel} la cédula de ${item.nombre_completo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: estado === 'aprobada' ? 'Aprobar' : 'Rechazar',
          style: estado === 'aprobada' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setProcesandoId(item.id);
              await adminAPI.revisarValidacionIdentidad(item.id, estado, null);
              setPendientes((prev) => prev.filter((p) => p.id !== item.id));
            } catch (err) {
              const msg = err.response?.data?.error || 'No se pudo guardar la revisión';
              showAlert('Error', msg);
            } finally {
              setProcesandoId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const enProceso = procesandoId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.nombre}>{item.nombre_completo}</Text>
            <Text style={styles.cedula}>Cédula: {item.cedula || 'Sin dato'}</Text>
            <Text style={styles.fecha}>Enviado: {formatearFecha(item.enviado_at)}</Text>
          </View>
          <View style={styles.estadoChip}>
            <Text style={styles.estadoText}>Pendiente</Text>
          </View>
        </View>

        {item.foto_cedula ? (
          <Image source={{ uri: item.foto_cedula }} style={styles.fotoCedula} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={28} color={COLORS.textLight} />
            <Text style={styles.placeholderText}>Sin foto de cédula</Text>
          </View>
        )}

        <View style={styles.actions}>
          <AnimatedPressable
            onPress={() => revisarPendiente(item, 'rechazada')}
            style={[styles.actionBtn, styles.rejectBtn, enProceso && styles.disabledBtn]}
            scaleValue={0.97}
            disabled={enProceso}
          >
            <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Rechazar'}</Text>
          </AnimatedPressable>

          <AnimatedPressable
            onPress={() => revisarPendiente(item, 'aprobada')}
            style={[styles.actionBtn, styles.approveBtn, enProceso && styles.disabledBtn]}
            scaleValue={0.97}
            disabled={enProceso}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.actionText}>{enProceso ? 'Guardando...' : 'Aprobar'}</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={pendientes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={COLORS.primary} />
              <Text style={styles.emptyTitle}>No hay cédulas pendientes</Text>
              <Text style={styles.emptySub}>Todas las verificaciones fueron atendidas</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  headerInfo: {
    flex: 1,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  cedula: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  fecha: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textLight,
  },
  estadoChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  estadoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  fotoCedula: {
    width: '100%',
    height: 230,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  placeholder: {
    height: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardHover,
  },
  placeholderText: {
    color: COLORS.textLight,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
  },
  approveBtn: {
    backgroundColor: COLORS.primary,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  actionText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
