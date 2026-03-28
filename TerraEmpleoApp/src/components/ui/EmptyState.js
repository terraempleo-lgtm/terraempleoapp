import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONTS, RADIUS } from '../../theme';

export const EmptyState = ({
  icon = 'search-outline',
  title = 'Sin datos',
  description = 'No hay nada por aquí todavía',
  action,
  actionLabel,
  size = 'medium',
}) => {
  const iconSize = size === 'small' ? 40 : size === 'large' ? 80 : 60;
  const screenHeight = size === 'small' ? SPACING.xxxl : SPACING.xxxl * 2;

  return (
    <View style={[styles.container, { minHeight: screenHeight }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={iconSize} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        {action && actionLabel && (
          <View style={styles.actionWrap}>
            {/* If you integrate a Button component, use it here */}
            <Text style={styles.actionText}>{actionLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  content: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.subtitle,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  description: {
    ...FONTS.bodySmall,
    textAlign: 'center',
    color: COLORS.textLight,
    marginBottom: SPACING.md,
  },
  actionWrap: {
    marginTop: SPACING.md,
  },
  actionText: {
    ...FONTS.button,
    color: COLORS.primary,
  },
});
