import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';

export default function DecorativeBackground({ intensity = 'normal' }) {
  const { gradients, isDark } = useAppTheme();
  const strong = intensity === 'strong';

  return (
    <View pointerEvents="none" style={styles.layer}>
      <View
        style={[
          styles.blobA,
          { backgroundColor: gradients.agroBlobA, opacity: strong ? 1 : 0.9 },
        ]}
      />
      <View
        style={[
          styles.blobB,
          { backgroundColor: gradients.agroBlobB, opacity: strong ? 0.95 : 0.8 },
        ]}
      />
      <View
        style={[
          styles.blobC,
          { backgroundColor: isDark ? 'rgba(61, 208, 143, 0.14)' : 'rgba(0, 141, 73, 0.10)' },
        ]}
      />
      <View
        style={[
          styles.ring,
          { borderColor: isDark ? 'rgba(154, 226, 103, 0.22)' : 'rgba(0, 141, 73, 0.16)' },
        ]}
      />
      <View
        style={[
          styles.leaf,
          { backgroundColor: isDark ? 'rgba(154, 226, 103, 0.12)' : 'rgba(0, 141, 73, 0.07)' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blobA: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -42,
    left: -56,
  },
  blobB: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    top: -118,
    right: -96,
  },
  blobC: {
    position: 'absolute',
    width: 145,
    height: 145,
    borderRadius: 72,
    bottom: 92,
    right: -52,
  },
  ring: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 20,
    bottom: -72,
    left: -38,
  },
  leaf: {
    position: 'absolute',
    width: 118,
    height: 54,
    borderRadius: 40,
    transform: [{ rotate: '-24deg' }],
    top: 110,
    right: 26,
  },
});
