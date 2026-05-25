import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
import { COLORS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';

const TabItem = ({ isFocused, onPress, onLongPress, iconName, label, colors, badge }) => {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.12 : 1, { damping: 14, stiffness: 200 });
    bgOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [isFocused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pillStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scaleX: withSpring(isFocused ? 1 : 0.6, { damping: 16 }) }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      haptic={true}
      hapticStyle={Haptics.ImpactFeedbackStyle.Light}
      scaleValue={0.9}
      style={styles.tabItem}
    >
      <View style={styles.iconWrap}>
        {/* Pill background for active */}
        <Animated.View style={[styles.activePill, { backgroundColor: COLORS.primary + '20' }, pillStyle]} />

        <Animated.View style={iconStyle}>
          <Ionicons
            name={iconName}
            size={22}
            color={isFocused ? colors.primary : colors.textMuted}
          />
        </Animated.View>

        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.textMuted }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const AnimatedTabBar = ({ state, descriptors, navigation }) => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || (Platform.OS === 'ios' ? 16 : 8);

  return (
    <View style={[
      styles.outerContainer,
      { paddingBottom: bottomInset, backgroundColor: 'transparent' },
    ]}>
      <View style={[
        styles.container,
        {
          backgroundColor: isDark ? '#0f201aee' : '#ffffffee',
          borderColor: isDark ? '#1f3a3044' : '#e5e7eb88',
          shadowColor: isDark ? '#000' : '#2E7D32',
        },
      ]}>
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
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          let iconName = 'ellipse';
          const tabBarIcon = options.tabBarIcon;
          if (tabBarIcon) {
            const iconResult = tabBarIcon({ focused: isFocused, color: colors.primary, size: 22 });
            iconName = iconResult?.props?.name || 'ellipse';
          }

          return (
            <TabItem
              key={route.key}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              iconName={iconName}
              label={label}
              colors={colors}
              badge={options.tabBarBadge}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
      web: { boxShadow: '0 4px 20px rgba(46,125,50,0.10)' },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 32,
    borderRadius: 16,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 0,
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});

export default AnimatedTabBar;
