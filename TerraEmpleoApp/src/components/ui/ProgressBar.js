import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, FONTS, ANIMATION } from '../../theme';

export default function ProgressBar({ currentStep, totalSteps, labels = [] }) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const label = labels[currentStep - 1] || '';

  const animatedProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    animatedProgress.value = withSpring(progress / 100, ANIMATION.spring.gentle);
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  }, [currentStep]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

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
        <Animated.View style={[styles.barFill, barStyle]}>
          <Animated.View style={[styles.glow, glowStyle]} />
        </Animated.View>
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  glow: {
    width: 12,
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
});
