import React, { useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, ANIMATION } from '../../theme';
import { AnimatedPressable } from '../animated';

const AnimatedStar = ({ star, rating, size, onRate, readonly }) => {
  const scale = useSharedValue(1);
  const isFilled = star <= rating;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (readonly || !onRate) return;
    scale.value = withSequence(
      withSpring(1.4, ANIMATION.spring.bouncy),
      withSpring(1, ANIMATION.spring.gentle)
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onRate(star);
  }, [star, readonly, onRate]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      disabled={readonly}
      style={styles.starBtn}
      scaleValue={0.85}
      haptic={false}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={isFilled ? 'star' : 'star-outline'}
          size={size}
          color={isFilled ? COLORS.star : COLORS.starEmpty}
        />
      </Animated.View>
    </AnimatedPressable>
  );
};

export default function StarRating({ rating = 0, size = 28, onRate, readonly = false }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.container}>
      {stars.map((star) => (
        <AnimatedStar
          key={star}
          star={star}
          rating={rating}
          size={size}
          onRate={onRate}
          readonly={readonly}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starBtn: {
    padding: 2,
  },
});
