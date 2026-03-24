import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { AnimatedPressable } from '../animated';

export default function Card({
  children,
  onPress,
  selected = false,
  variant = 'default', // default, elevated, outlined, soft
  style,
  padded = true,
}) {
  const { colors, gradients, isDark } = useAppTheme();
  const cardStyle = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderColor: isDark ? colors.border : COLORS.borderLight,
    },
    padded && styles.padded,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'soft' && styles.soft,
    selected && styles.selected,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        style={cardStyle}
        onPress={onPress}
        scaleValue={ANIMATION.scale.pressedSubtle}
        haptic={false}
      >
        <LinearGradient
          colors={gradients.card}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={cardStyle}>
      <LinearGradient
        colors={gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    ...SHADOWS.card,
    overflow: 'hidden',
  },
  padded: {
    padding: SPACING.lg,
  },
  elevated: {
    borderWidth: 0,
    ...SHADOWS.medium,
  },
  outlined: {
    borderColor: COLORS.border,
    ...SHADOWS.none,
  },
  soft: {
    backgroundColor: COLORS.primaryMuted,
    borderColor: '#D1FAE5',
    ...SHADOWS.none,
  },
  selected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primaryMuted,
  },
});
