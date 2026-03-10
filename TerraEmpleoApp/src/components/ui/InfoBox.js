import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../../theme';

export default function InfoBox({
  icon = 'information-circle',
  title,
  message,
  text, // alias for message
  variant = 'info', // info, success, warning, tip
  style,
}) {
  const displayMessage = message || text;
  const variants = {
    info: {
      bg: COLORS.infoSoft,
      iconColor: COLORS.info,
      borderColor: '#BFDBFE',
    },
    success: {
      bg: COLORS.primaryMuted,
      iconColor: COLORS.primary,
      borderColor: '#BBF7D0',
    },
    warning: {
      bg: COLORS.warningSoft,
      iconColor: COLORS.warning,
      borderColor: '#FDE68A',
    },
    tip: {
      bg: '#F0FDF4',
      iconColor: COLORS.primaryLight,
      borderColor: '#BBF7D0',
    },
  };

  const v = variants[variant] || variants.info;

  return (
    <View style={[styles.container, { backgroundColor: v.bg, borderColor: v.borderColor }, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={v.iconColor} />
      </View>
      <View style={styles.textWrap}>
        {title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.message}>{displayMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    gap: SPACING.sm + 4,
    alignItems: 'flex-start',
  },
  iconWrap: {
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...FONTS.label,
    fontWeight: FONTS.weight.bold,
    marginBottom: 4,
  },
  message: {
    ...FONTS.bodySmall,
  },
});
