import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NEUTRAL_BG = '#E4E6DE';
const NEUTRAL_ICON = '#8B9080';

export default function Avatar({ src, name, size = 40 }) {
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (src) {
    return <Image source={{ uri: src }} style={[styles.img, dim]} />;
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Ionicons name="person" size={size * 0.55} color={NEUTRAL_ICON} />
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#eee' },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: NEUTRAL_BG },
});
