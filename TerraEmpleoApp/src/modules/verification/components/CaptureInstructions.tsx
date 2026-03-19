import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';

interface CaptureInstructionsProps {
  titulo: string;
  subtitulo: string;
  pasos: string[];
}

export default function CaptureInstructions({ titulo, subtitulo, pasos }: CaptureInstructionsProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.subtitulo}>{subtitulo}</Text>
      {pasos.map((paso) => (
        <Text key={paso} style={styles.paso}>
          • {paso}
        </Text>
      ))}
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
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  subtitulo: {
    color: COLORS.textLight,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  paso: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    lineHeight: 20,
  },
});
