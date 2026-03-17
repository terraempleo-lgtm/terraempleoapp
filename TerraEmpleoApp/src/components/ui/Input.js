import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, LAYOUT, FONTS, ANIMATION } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const AnimatedView = Animated.View;

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  required = false,
  error,
  helper,
  maxLength,
  editable = true,
  icon,
  rightIcon,
  onRightIconPress,
  style,
  inputStyle,
  containerStyle,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const focusProgress = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const prevError = useSharedValue(false);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: ANIMATION.duration.fast,
      easing: Easing.out(Easing.ease),
    });
  }, [focused]);

  useEffect(() => {
    if (error && !prevError.value) {
      shakeX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
    prevError.value = !!error;
  }, [error]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? COLORS.error
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [COLORS.border, COLORS.primary]
        );

    const backgroundColor = error
      ? COLORS.errorSoft
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          ['#F9FAFB', COLORS.white]
        );

    return {
      borderColor,
      backgroundColor,
      borderWidth: focused ? 2 : 1.5,
      transform: [{ translateX: shakeX.value }],
    };
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <AnimatedView style={[
        styles.inputContainer,
        !editable && styles.inputDisabled,
        multiline && styles.inputMultiline,
        style,
        animatedContainerStyle,
      ]}>
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={focused ? COLORS.primary : COLORS.textLight}
            style={styles.icon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            multiline && { minHeight: numberOfLines * 24, textAlignVertical: 'top' },
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !showPassword}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.eyeBtn} disabled={!onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </AnimatedView>
      {error && <Text style={styles.error}>{error}</Text>}
      {helper && !error && <Text style={styles.helper}>{helper}</Text>}
      {maxLength && value && (
        <Text style={styles.counter}>{value.length} / {maxLength}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...FONTS.label,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: LAYOUT.inputHeight,
  },
  inputDisabled: {
    backgroundColor: COLORS.disabledBg,
    borderColor: COLORS.borderLight,
  },
  inputMultiline: {
    minHeight: 100,
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  icon: {
    marginRight: SPACING.sm + 2,
  },
  input: {
    flex: 1,
    ...FONTS.input,
    paddingVertical: SPACING.sm + 2,
  },
  eyeBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  error: {
    ...FONTS.caption,
    color: COLORS.error,
    marginTop: SPACING.xs + 2,
    fontWeight: FONTS.weight.medium,
  },
  helper: {
    ...FONTS.caption,
    marginTop: SPACING.xs + 2,
  },
  counter: {
    ...FONTS.small,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
});
