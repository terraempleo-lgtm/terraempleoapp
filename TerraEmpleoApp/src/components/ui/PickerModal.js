import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Keyboard, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { COLORS, SPACING, RADIUS, SHADOWS, FONTS } from '../../theme';
import { AnimatedPressable } from '../animated';
import Input from './Input';

export default function PickerModal({
  visible,
  onClose,
  title,
  options = [],
  selectedValue,
  onSelect,
  searchable = true,
}) {
  const [search, setSearch] = React.useState('');
  const bottomSheetRef = useRef(null);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  const filtered = search
    ? options.filter(opt =>
        (typeof opt === 'string' ? opt : opt.label)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : options;

  const handleSelect = (item) => {
    Keyboard.dismiss();
    onSelect(typeof item === 'string' ? item : item.value);
    onClose();
    setSearch('');
  };

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
    setSearch('');
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

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
  }, [selectedValue]);

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={['60%', '85%']}
      onClose={handleClose}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      style={styles.sheet}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <AnimatedPressable onPress={handleClose} scaleValue={0.9} haptic={false}>
          <Ionicons name="close-circle" size={30} color={COLORS.textLight} />
        </AnimatedPressable>
      </View>

      {searchable && (
        <View style={styles.searchContainer}>
          <Input
            placeholder="Buscar..."
            value={search}
            onChangeText={setSearch}
            icon="search"
            style={{ marginBottom: 0 }}
            containerStyle={{ marginBottom: SPACING.sm }}
          />
        </View>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No se encontraron resultados</Text>
        ) : (
          filtered.map((item, idx) => {
            const keyBase = typeof item === 'string' ? item : item.value;
            return (
              <View key={`${keyBase}-${idx}`}>
                {renderItem({ item })}
                {idx < filtered.length - 1 ? <View style={styles.separator} /> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    zIndex: 1000,
  },
  background: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    ...SHADOWS.large,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
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
  empty: {
    textAlign: 'center',
    padding: SPACING.lg,
    ...FONTS.bodySmall,
    color: COLORS.textLight,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
});
