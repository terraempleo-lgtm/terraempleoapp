import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, FONTS } from '../../theme';
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

  const filtered = search
    ? options.filter(opt =>
        (typeof opt === 'string' ? opt : opt.label)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : options;

  const handleSelect = (item) => {
    onSelect(typeof item === 'string' ? item : item.value);
    onClose();
    setSearch('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={() => { onClose(); setSearch(''); }}>
                <Ionicons name="close-circle" size={30} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            {searchable && (
              <Input
                placeholder="Buscar..."
                value={search}
                onChangeText={setSearch}
                icon="search"
                style={{ marginBottom: SPACING.sm }}
              />
            )}

            <FlatList
              data={filtered}
              keyExtractor={(item, idx) => (typeof item === 'string' ? item : item.value) + idx}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const label = typeof item === 'string' ? item : item.label;
                const value = typeof item === 'string' ? item : item.value;
                const isSelected = value === selectedValue;

                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={() => (
                <Text style={styles.empty}>No se encontraron resultados</Text>
              )}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '80%',
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.subtitle,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  optionSelected: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
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
  },
  empty: {
    textAlign: 'center',
    padding: SPACING.lg,
    ...FONTS.bodySmall,
    color: COLORS.textLight,
  },
});
