import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS } from '../../theme';

export default function SectionTitle({ title, subtitle, accent = false, style }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, accent && styles.titleAccent]}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.subtitle,
    marginBottom: SPACING.xs,
  },
  titleAccent: {
    color: COLORS.primary,
  },
  subtitle: {
    ...FONTS.body,
  },
});
