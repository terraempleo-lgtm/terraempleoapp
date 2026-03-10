import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';

export default function Card({
  children,
  onPress,
  selected = false,
  variant = 'default', // default, elevated, outlined, soft
  style,
  padded = true,
}) {
  const cardStyle = [
    styles.base,
    padded && styles.padded,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'soft' && styles.soft,
    selected && styles.selected,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    ...SHADOWS.card,
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
