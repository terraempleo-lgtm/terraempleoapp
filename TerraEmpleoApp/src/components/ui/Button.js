import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, LAYOUT, FONTS } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, danger, ghost
  size = 'large', // large, medium, small
  loading = false,
  loadingText,
  disabled = false,
  icon,
  iconRight,
  style,
  textStyle,
  fullWidth = true,
}) {
  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    const base = [styles.base];
    if (fullWidth) base.push(styles.fullWidth);

    // Size
    if (size === 'large') base.push(styles.large);
    else if (size === 'medium') base.push(styles.medium);
    else base.push(styles.small);

    // Variant
    if (variant === 'primary') base.push(styles.primary);
    else if (variant === 'secondary') base.push(styles.secondary);
    else if (variant === 'outline') base.push(styles.outline);
    else if (variant === 'danger') base.push(styles.danger);
    else if (variant === 'ghost') base.push(styles.ghost);

    if (isDisabled) base.push(styles.disabled);
    if (isDisabled && variant === 'primary') base.push(styles.disabledPrimary);
    if (isDisabled && variant === 'outline') base.push(styles.disabledOutline);

    return base;
  };

  const getTextStyle = () => {
    const base = [styles.text];
    if (size === 'large') base.push(styles.textLarge);
    else if (size === 'medium') base.push(styles.textMedium);
    else base.push(styles.textSmall);

    if (variant === 'outline') base.push({ color: COLORS.primary });
    else if (variant === 'secondary') base.push({ color: COLORS.primary });
    else if (variant === 'ghost') base.push({ color: COLORS.primary });
    else if (variant === 'danger') base.push({ color: COLORS.white });
    else base.push({ color: COLORS.white });

    if (isDisabled && (variant === 'primary' || variant === 'danger')) {
      base.push({ color: COLORS.white });
    }
    if (isDisabled && (variant === 'outline' || variant === 'ghost')) {
      base.push({ color: COLORS.disabled });
    }

    return base;
  };

  const spinnerColor = (variant === 'outline' || variant === 'ghost' || variant === 'secondary')
    ? COLORS.primary
    : COLORS.white;

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color={spinnerColor} size="small" />
          <Text style={[...getTextStyle(), textStyle]}>{loadingText || title}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
          {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  iconLeft: {
    marginRight: 2,
  },
  iconRight: {
    marginLeft: 2,
  },
  // Sizes
  large: {
    height: LAYOUT.buttonHeight,
    paddingHorizontal: SPACING.xl,
    ...SHADOWS.button,
  },
  medium: {
    height: 48,
    paddingHorizontal: SPACING.lg,
    ...SHADOWS.small,
  },
  small: {
    height: LAYOUT.buttonHeightSmall,
    paddingHorizontal: SPACING.md,
    ...SHADOWS.none,
  },
  // Variants
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.primarySoft,
    ...SHADOWS.none,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
    ...SHADOWS.none,
  },
  danger: {
    backgroundColor: COLORS.error,
  },
  ghost: {
    backgroundColor: 'transparent',
    ...SHADOWS.none,
  },
  // Disabled
  disabled: {
    opacity: 0.55,
  },
  disabledPrimary: {
    backgroundColor: COLORS.disabled,
    opacity: 1,
    ...SHADOWS.none,
  },
  disabledOutline: {
    borderColor: COLORS.disabled,
    opacity: 1,
  },
  // Text
  text: {
    ...FONTS.button,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  textLarge: {
    ...FONTS.bigButton,
  },
  textMedium: {
    ...FONTS.button,
  },
  textSmall: {
    ...FONTS.buttonSmall,
  },
});
