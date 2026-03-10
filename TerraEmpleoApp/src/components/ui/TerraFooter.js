import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS } from '../../theme';

export default function TerraFooter({ tagline, light = false }) {
  const iconColor = light ? 'rgba(255,255,255,0.5)' : COLORS.primary;
  const textColor = light ? 'rgba(255,255,255,0.5)' : COLORS.textLight;
  const bgColor = light ? 'rgba(255,255,255,0.1)' : COLORS.primaryMuted;

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Ionicons name="leaf" size={13} color={iconColor} />
      </View>
      <Text style={[styles.text, { color: textColor }]}>TerraEmpleo</Text>
      {tagline && (
        <Text style={[styles.tagline, { color: textColor }]}>{tagline}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
  },
  iconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    ...FONTS.bodySmall,
    fontWeight: FONTS.weight.semibold,
    letterSpacing: 0.3,
  },
  tagline: {
    ...FONTS.caption,
    fontWeight: FONTS.weight.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
});
