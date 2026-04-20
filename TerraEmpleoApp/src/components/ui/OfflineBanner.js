import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfflineBanner({ isOnline }) {
  const slideY = useRef(new Animated.Value(-60)).current;
  const wasOnline = useRef(true);

  useEffect(() => {
    if (!isOnline) {
      // Mostrar banner
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    } else if (!wasOnline.current) {
      // Ocultar banner cuando vuelve la conexión
      Animated.timing(slideY, {
        toValue: -60,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
    wasOnline.current = isOnline;
  }, [isOnline, slideY]);

  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      style={[
        styles.banner,
        { top: insets.top, transform: [{ translateY: slideY }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
      <Text style={styles.text}>Sin conexión — mostrando datos guardados</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#616161',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
