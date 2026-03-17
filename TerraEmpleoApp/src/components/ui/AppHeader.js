import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, LAYOUT, FONTS } from '../../theme';
import { AnimatedPressable, FadeInView } from '../animated';

export default function AppHeader({
  title,
  onBack,
  rightAction,
  rightIcon,
  onRightPress,
  transparent = false,
  lightContent = false,
}) {
  const textColor = lightContent ? COLORS.white : COLORS.textPrimary;
  const iconColor = lightContent ? COLORS.white : COLORS.textPrimary;

  return (
    <View style={[styles.container, transparent && styles.transparent]}>
      <View style={styles.left}>
        {onBack && (
          <AnimatedPressable onPress={onBack} style={styles.backBtn} scaleValue={0.9} haptic={true}>
            <Ionicons name="arrow-back" size={24} color={iconColor} />
          </AnimatedPressable>
        )}
      </View>

      {title ? (
        <FadeInView delay={100} translateY={-5} duration={300}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        </FadeInView>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      <View style={styles.right}>
        {rightAction || (rightIcon && onRightPress && (
          <AnimatedPressable onPress={onRightPress} style={styles.rightBtn} scaleValue={0.9} haptic={true}>
            <Ionicons name={rightIcon} size={24} color={iconColor} />
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: LAYOUT.headerHeight,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  left: {
    width: 44,
    alignItems: 'flex-start',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    ...FONTS.subtitle,
    textAlign: 'center',
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
  rightBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
