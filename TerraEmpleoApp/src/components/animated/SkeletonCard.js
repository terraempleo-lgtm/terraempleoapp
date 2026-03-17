import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShimmerPlaceholder from './ShimmerPlaceholder';
import { SPACING, RADIUS, SHADOWS } from '../../theme';

const SkeletonCard = ({ style }) => (
  <View style={[styles.card, style]}>
    <ShimmerPlaceholder width="100%" height={190} borderRadius={RADIUS.md} />
    <View style={styles.body}>
      <ShimmerPlaceholder width="70%" height={18} borderRadius={RADIUS.xs} />
      <ShimmerPlaceholder
        width="45%"
        height={14}
        borderRadius={RADIUS.xs}
        style={{ marginTop: SPACING.sm }}
      />
      <View style={styles.tagsRow}>
        <ShimmerPlaceholder width={80} height={28} borderRadius={RADIUS.full} />
        <ShimmerPlaceholder width={70} height={28} borderRadius={RADIUS.full} />
        <ShimmerPlaceholder width={60} height={28} borderRadius={RADIUS.full} />
      </View>
      <View style={styles.bottomRow}>
        <ShimmerPlaceholder width="40%" height={16} borderRadius={RADIUS.xs} />
        <ShimmerPlaceholder width={100} height={36} borderRadius={RADIUS.full} />
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  body: {
    padding: SPACING.md,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
});

export default SkeletonCard;
