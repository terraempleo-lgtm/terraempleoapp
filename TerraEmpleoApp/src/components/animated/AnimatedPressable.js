import React, { useCallback } from 'react';
import { Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ANIMATION } from '../../theme';

const AnimatedPressableView = Animated.createAnimatedComponent(Pressable);

const AnimatedPressable = ({
  children,
  onPress,
  onLongPress,
  scaleValue = ANIMATION.scale.pressed,
  haptic = true,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  disabled = false,
  style,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(scaleValue, ANIMATION.spring.snappy);
  }, [scaleValue]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, ANIMATION.spring.bouncy);
  }, []);

  const handlePress = useCallback(() => {
    if (haptic && Platform.OS !== 'web') {
      Haptics.impactAsync(hapticStyle);
    }
    onPress?.();
  }, [haptic, hapticStyle, onPress]);

  return (
    <AnimatedPressableView
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressableView>
  );
};

export default AnimatedPressable;
