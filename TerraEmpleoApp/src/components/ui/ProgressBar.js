import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, ANIMATION } from '../../theme';

function StepDot({ index, currentStep, totalSteps }) {
  const isCompleted = index < currentStep;
  const isCurrent = index === currentStep - 1;
  const isPending = index >= currentStep;

  return (
    <MotiView
      from={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200, delay: index * 50 }}
      style={styles.stepDotContainer}
    >
      <View
        style={[
          styles.stepDot,
          isCompleted && styles.stepDotCompleted,
          isCurrent && styles.stepDotCurrent,
          isPending && styles.stepDotPending,
        ]}
      >
        {isCompleted ? (
          <Ionicons name="checkmark" size={10} color={COLORS.white} />
        ) : (
          <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>
            {index + 1}
          </Text>
        )}
      </View>
      {index < totalSteps - 1 && (
        <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
      )}
    </MotiView>
  );
}

export default function ProgressBar({ currentStep, totalSteps, labels = [], showSteps = false }) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  const label = labels[currentStep - 1] || '';

  const animatedProgress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.4);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    animatedProgress.value = withSpring(progress / 100, ANIMATION.spring.gentle);
    glowOpacity.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
    pulseScale.value = withSequence(
      withSpring(1.05, ANIMATION.spring.bouncy),
      withSpring(1, ANIMATION.spring.gentle)
    );
  }, [currentStep]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedProgress.value * 100}%`,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const percentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepIndicator}>
            PASO {currentStep} DE {totalSteps}
          </Text>
        </View>
        <Animated.View style={percentStyle}>
          <View style={styles.percentBadge}>
            <Text style={styles.percent}>{progress}%</Text>
          </View>
        </Animated.View>
      </View>

      {label ? (
        <MotiView
          key={label}
          from={{ opacity: 0, translateX: -10 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 300 }}
        >
          <Text style={styles.stepLabel}>{label}</Text>
        </MotiView>
      ) : null}

      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFillWrapper, barStyle]}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.barFill}
          >
            <Animated.View style={[styles.glow, glowStyle]} />
          </LinearGradient>
        </Animated.View>
      </View>

      {showSteps && totalSteps <= 6 && (
        <View style={styles.stepsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <StepDot key={i} index={i} currentStep={currentStep} totalSteps={totalSteps} />
          ))}
        </View>
      )}
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
    marginBottom: SPACING.sm,
  },
  stepBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  stepIndicator: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  percentBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  percent: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stepLabel: {
    ...FONTS.bodySmall,
    fontWeight: FONTS.weight.semibold,
    marginBottom: SPACING.sm,
    color: COLORS.textPrimary,
  },
  barContainer: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFillWrapper: {
    height: '100%',
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  glow: {
    width: 16,
    height: '100%',
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  stepDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepDotCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  stepDotCurrent: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 2.5,
  },
  stepDotPending: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  stepDotTextCurrent: {
    color: COLORS.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: COLORS.primary,
  },
});
