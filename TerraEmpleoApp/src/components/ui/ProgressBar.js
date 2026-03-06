import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function ProgressBar({ currentStep, totalSteps, labels = [] }) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const label = labels[currentStep - 1] || '';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.stepLabel}>
          Paso {currentStep}: <Text style={styles.stepLabelName}>{label}</Text>
        </Text>
        <Text style={styles.percent}>{progress}%</Text>
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.subText}>{currentStep} de {totalSteps} pasos completados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepLabelName: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  percent: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  barContainer: {
    height: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  subText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'right',
  },
});
