import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../../theme';

export default function ProgressBar({ currentStep, totalSteps, labels = [] }) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const label = labels[currentStep - 1] || '';

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.stepIndicator}>
          PASO {currentStep} DE {totalSteps}
        </Text>
        <Text style={styles.percent}>{progress}%</Text>
      </View>

      {label ? (
        <Text style={styles.stepLabel}>{label}</Text>
      ) : null}

      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  stepIndicator: {
    ...FONTS.caption,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  percent: {
    ...FONTS.caption,
    fontWeight: FONTS.weight.semibold,
  },
  stepLabel: {
    ...FONTS.bodySmall,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.sm,
  },
  barContainer: {
    height: 6,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
});
