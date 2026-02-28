import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, danger
  size = 'large', // large, medium, small
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) {
  const getButtonStyle = () => {
    const base = [styles.base];
    if (size === 'large') base.push(styles.large);
    else if (size === 'medium') base.push(styles.medium);
    else base.push(styles.small);

    if (variant === 'primary') base.push(styles.primary);
    else if (variant === 'secondary') base.push(styles.secondary);
    else if (variant === 'outline') base.push(styles.outline);
    else if (variant === 'danger') base.push(styles.danger);

    if (disabled || loading) base.push(styles.disabled);
    return base;
  };

  const getTextStyle = () => {
    const base = [styles.text];
    if (size === 'large') base.push(styles.textLarge);
    else if (size === 'medium') base.push(styles.textMedium);
    else base.push(styles.textSmall);

    if (variant === 'outline') base.push({ color: COLORS.primary });
    else if (variant === 'secondary') base.push({ color: COLORS.primary });
    else base.push({ color: COLORS.white });

    return base;
  };

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.primary : COLORS.white} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    ...SHADOWS.small,
    gap: SPACING.sm,
  },
  large: {
    paddingVertical: 18,
    paddingHorizontal: SPACING.lg,
    minHeight: 58,
  },
  medium: {
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  small: {
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    minHeight: 40,
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.primarySoft,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
    elevation: 0,
    shadowOpacity: 0,
  },
  danger: {
    backgroundColor: COLORS.error,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  textLarge: {
    fontSize: 18,
  },
  textMedium: {
    fontSize: 16,
  },
  textSmall: {
    fontSize: 14,
  },
});
