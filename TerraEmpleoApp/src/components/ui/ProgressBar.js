import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function ProgressBar({ currentStep, totalSteps, labels = [] }) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepText}>Paso {currentStep} de {totalSteps}</Text>
        {labels[currentStep - 1] && (
          <Text style={styles.labelText}>{labels[currentStep - 1]}</Text>
        )}
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  labelText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  barContainer: {
    height: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
});
