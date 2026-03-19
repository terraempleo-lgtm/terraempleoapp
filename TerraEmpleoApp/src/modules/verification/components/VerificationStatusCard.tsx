import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';

type EstadoVisual = 'pendiente' | 'valido' | 'rechazado';

interface VerificationStatusCardProps {
  titulo: string;
  descripcion: string;
  estado: EstadoVisual;
  mensajeError?: string;
}

function getEstiloEstado(estado: EstadoVisual) {
  if (estado === 'valido') {
    return {
      fondo: COLORS.badgeActive,
      texto: COLORS.badgeActiveText,
      etiqueta: 'Validado',
    };
  }

  if (estado === 'rechazado') {
    return {
      fondo: COLORS.badgeUrgent,
      texto: COLORS.badgeUrgentText,
      etiqueta: 'Repetir foto',
    };
  }

  return {
    fondo: COLORS.badgeInactive,
    texto: COLORS.badgeInactiveText,
    etiqueta: 'Pendiente',
  };
}

export default function VerificationStatusCard({
  titulo,
  descripcion,
  estado,
  mensajeError,
}: VerificationStatusCardProps) {
  const estadoVisual = getEstiloEstado(estado);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={[styles.badge, { backgroundColor: estadoVisual.fondo }]}>
          <Text style={[styles.badgeTexto, { color: estadoVisual.texto }]}>{estadoVisual.etiqueta}</Text>
        </View>
      </View>
      <Text style={styles.descripcion}>{descripcion}</Text>
      {!!mensajeError && <Text style={styles.error}>{mensajeError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  titulo: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  badgeTexto: {
    fontWeight: '700',
    fontSize: 12,
  },
  descripcion: {
    color: COLORS.textLight,
  },
  error: {
    marginTop: SPACING.xs,
    color: COLORS.error,
    fontWeight: '600',
  },
});
