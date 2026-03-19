import React, { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AnimatedPressable from './AnimatedPressable';
import { COLORS, FONTS, ANIMATION } from '../../theme';

const TAB_BAR_HEIGHT = 65;

const TabItem = ({ route, isFocused, onPress, onLongPress, iconName, label }) => {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isFocused) {
      scale.value = withSpring(1.1, ANIMATION.spring.bouncy);
      translateY.value = withSpring(-2, ANIMATION.spring.gentle);
    } else {
      scale.value = withSpring(1, ANIMATION.spring.gentle);
      translateY.value = withSpring(0, ANIMATION.spring.gentle);
    }
  }, [isFocused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isFocused ? 1 : 0, { duration: ANIMATION.duration.fast }),
    transform: [{ scale: withSpring(isFocused ? 1 : 0.5, ANIMATION.spring.bouncy) }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      haptic={true}
      hapticStyle={Haptics.ImpactFeedbackStyle.Light}
      scaleValue={0.92}
      style={styles.tabItem}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={iconName}
          size={24}
          color={isFocused ? COLORS.primary : COLORS.textLight}
        />
      </Animated.View>
      <Animated.Text
        style={[
          styles.tabLabel,
          { color: isFocused ? COLORS.primary : COLORS.textLight },
          isFocused && styles.tabLabelActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
      <Animated.View style={[styles.activeDot, dotStyle]} />
    </AnimatedPressable>
  );
};

const AnimatedTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 6);

  return (
    <View style={styles.container}>
      <View style={[styles.tabBar, { paddingBottom: bottomInset, height: TAB_BAR_HEIGHT + bottomInset }] }>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          let iconName;
          const tabBarIcon = options.tabBarIcon;
          if (tabBarIcon) {
            const iconResult = tabBarIcon({ focused: isFocused, color: COLORS.primary, size: 24 });
            iconName = iconResult?.props?.name || 'ellipse';
          } else {
            iconName = 'ellipse';
          }

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              iconName={iconName}
              label={label}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 40,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabBar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginTop: 2,
  },
});

export default AnimatedTabBar;
