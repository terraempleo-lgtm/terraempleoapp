import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, LAYOUT, FONTS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
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
  const { colors, gradients } = useAppTheme();
  const useLightContent = lightContent || !transparent;
  const textColor = useLightContent ? COLORS.white : colors.textPrimary;
  const iconColor = useLightContent ? COLORS.white : colors.textPrimary;

  return (
    <LinearGradient
      colors={transparent ? ['transparent', 'transparent'] : gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, transparent && styles.transparent]}
    >
      {!transparent && (
        <>
          <View style={[styles.blobA, { backgroundColor: gradients.agroBlobA }]} />
          <View style={[styles.blobB, { backgroundColor: gradients.agroBlobB }]} />
        </>
      )}
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
    </LinearGradient>
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
    overflow: 'hidden',
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
  blobA: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -46,
    left: -26,
  },
  blobB: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    right: -18,
    bottom: -34,
  },
});
