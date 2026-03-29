import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Keyboard, Modal, TextInput, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, FONTS } from '../../theme';
import { AnimatedPressable } from '../animated';

export default function PickerModal({
  visible,
  onClose,
  title,
  options = [],
  selectedValue,
  onSelect,
  searchable = true,
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = React.useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter(opt =>
      (typeof opt === 'string' ? opt : opt.label)
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search, options]);

  const handleSelect = useCallback((item) => {
    Keyboard.dismiss();
    onSelect(typeof item === 'string' ? item : item.value);
    onClose();
    setSearch('');
  }, [onSelect, onClose]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    setSearch('');
  }, [onClose]);

  const renderItem = useCallback(({ item }) => {
    const label = typeof item === 'string' ? item : item.label;
    const value = typeof item === 'string' ? item : item.value;
    const isSelected = value === selectedValue;

    return (
      <AnimatedPressable
        style={[styles.option, isSelected && styles.optionSelected]}
        onPress={() => handleSelect(item)}
        scaleValue={0.98}
        haptic={true}
      >
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
          {label}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
        )}
      </AnimatedPressable>
    );
  }, [selectedValue, handleSelect]);

  const keyExtractor = useCallback((item, index) => {
    const key = typeof item === 'string' ? item : item.value;
    return `${key}-${index}`;
  }, []);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.webOverlay}>
        <Pressable style={styles.webBackdrop} onPress={handleClose} />
        <View style={[styles.webCard, { marginTop: insets.top + 12 }]}> 
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <AnimatedPressable onPress={handleClose} scaleValue={0.9} haptic={false}>
              <Ionicons name="close-circle" size={30} color={COLORS.textLight} />
            </AnimatedPressable>
          </View>

          {searchable && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search" size={18} color={COLORS.textLight} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar..."
                  placeholderTextColor={COLORS.textLight}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <AnimatedPressable
                    onPress={() => setSearch('')}
                    scaleValue={0.85}
                    haptic={false}
                    style={styles.clearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                  </AnimatedPressable>
                )}
              </View>
            </View>
          )}

          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="search-outline" size={32} color={COLORS.border} />
                <Text style={styles.empty}>No se encontraron resultados</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: Math.max(SPACING.xxxl * 2, insets.bottom + 24) }} />}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  webOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  webCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  title: {
    ...FONTS.subtitle,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 46,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...FONTS.input,
    color: COLORS.textPrimary,
    paddingVertical: 0,
    height: '100%',
  },
  clearBtn: {
    padding: 2,
    marginLeft: SPACING.xs,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  optionSelected: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  optionText: {
    ...FONTS.regular,
    flex: 1,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: FONTS.weight.semibold,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: SPACING.lg,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  empty: {
    textAlign: 'center',
    ...FONTS.bodySmall,
    color: COLORS.textLight,
  },
  listContent: {
    paddingBottom: SPACING.lg,
  },
});
