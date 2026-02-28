import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

export default function ChipSelector({
  label,
  options,
  selected = [],
  onSelectionChange,
  multiSelect = true,
  allowCustom = true,
  customLabel = '+ Otro',
  required = false,
  error,
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');

  const toggleOption = (option) => {
    if (multiSelect) {
      const isSelected = selected.includes(option);
      if (isSelected) {
        onSelectionChange(selected.filter(s => s !== option));
      } else {
        onSelectionChange([...selected, option]);
      }
    } else {
      onSelectionChange([option]);
    }
  };

  const addCustom = () => {
    if (customText.trim()) {
      const val = customText.trim();
      if (!selected.includes(val)) {
        onSelectionChange([...selected, val]);
      }
      setCustomText('');
      setShowCustomInput(false);
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <View style={styles.chipsContainer}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => toggleOption(option)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <Ionicons name="checkmark-circle" size={18} color={COLORS.white} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Chips personalizados */}
        {selected.filter(s => !options.includes(s)).map((custom) => (
          <TouchableOpacity
            key={custom}
            style={[styles.chip, styles.chipCustom]}
            onPress={() => onSelectionChange(selected.filter(s => s !== custom))}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, styles.chipTextSelected]}>{custom}</Text>
            <Ionicons name="close-circle" size={18} color={COLORS.white} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        ))}

        {allowCustom && (
          <TouchableOpacity
            style={[styles.chip, styles.chipAdd]}
            onPress={() => setShowCustomInput(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.chipText, { color: COLORS.primary }]}>{customLabel}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Modal para agregar personalizado */}
      <Modal visible={showCustomInput} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomInput(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Agregar opción</Text>
            <TextInput
              style={styles.modalInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="Escribe aquí..."
              placeholderTextColor={COLORS.textLight}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setShowCustomInput(false); setCustomText(''); }}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnAdd]}
                onPress={addCustom}
              >
                <Text style={styles.modalBtnAddText}>Agregar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  required: {
    color: COLORS.error,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.chipUnselected,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.chipSelected,
    borderColor: COLORS.chipSelected,
  },
  chipCustom: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipAdd: {
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.chipTextUnselected,
  },
  chipTextSelected: {
    color: COLORS.chipTextSelected,
  },
  error: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalBtn: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  modalBtnCancel: {
    backgroundColor: COLORS.chipUnselected,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalBtnAdd: {
    backgroundColor: COLORS.primary,
  },
  modalBtnAddText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
  },
});
