import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS, SHADOWS } from '../../theme';

const TOAST_DURATION = 3500; // ms

export const Toast = React.forwardRef((props, ref) => {
  const [config, setConfig] = useState({ type: 'info', title: '', message: '' });
  const opacity = useSharedValue(0);
  const timeoutRef = useRef(null);

  const show = React.useCallback(() => {
    opacity.value = withTiming(1, { duration: 300 });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 300 });
    }, TOAST_DURATION);
  }, []);

  const hide = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    opacity.value = withTiming(0, { duration: 200 });
  }, []);

  React.useImperativeHandle(ref, () => ({
    show,
    hide,
    setConfig,
  }), [show, hide]);

  const { type, title, message } = config;

  const iconName = type === 'success' ? 'checkmark-circle'
    : type === 'error' ? 'close-circle'
    : type === 'warning' ? 'alert-circle'
    : 'information-circle';

  const iconColor = type === 'success' ? '#22C55E'
    : type === 'error' ? '#EF4444'
    : type === 'warning' ? '#F59E0B'
    : COLORS.primary;

  const bgColor = type === 'success' ? 'rgba(34, 197, 94, 0.1)'
    : type === 'error' ? 'rgba(239, 68, 68, 0.1)'
    : type === 'warning' ? 'rgba(245, 158, 11, 0.1)'
    : 'rgba(46, 125, 50, 0.1)';

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(0.8)}
      exiting={FadeOutUp.springify()}
      style={[styles.container, animatedStyle]}
      pointerEvents="none"
    >
      <View style={[styles.toast, { backgroundColor: bgColor }]}>
        <Ionicons name={iconName} size={20} color={iconColor} />
        <View style={styles.content}>
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={[styles.message, title && { marginTop: 2 }]}>{message}</Text>}
        </View>
      </View>
    </Animated.View>
  );
});

Toast.displayName = 'Toast';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOWS.medium,
    gap: SPACING.md,
  },
  content: {
    flex: 1,
  },
  title: {
    ...FONTS.subtitle,
    color: COLORS.textPrimary,
  },
  message: {
    ...FONTS.bodySmall,
    color: COLORS.textSecondary,
  },
});

