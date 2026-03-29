import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { COLORS, RADIUS, SPACING, SHADOWS, FONTS, ANIMATION } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../animated';
import { MotiView, AnimatePresence } from 'moti';

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
        {options.map((option, index) => {
          const isSelected = selected.includes(option);
          return (
            <MotiView
              key={option}
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 300, delay: index * 30 }}
            >
              <AnimatedPressable
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleOption(option)}
                scaleValue={ANIMATION.scale.chipPressed}
                haptic={true}
              >
                <AnimatePresence>
                  {isSelected && (
                    <MotiView
                      from={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    >
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.white} style={{ marginRight: 4 }} />
                    </MotiView>
                  )}
                </AnimatePresence>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {option}
                </Text>
              </AnimatedPressable>
            </MotiView>
          );
        })}

        {/* Chips personalizados */}
        {selected.filter(s => !options.includes(s)).map((custom) => (
          <AnimatedPressable
            key={custom}
            style={[styles.chip, styles.chipCustom]}
            onPress={() => onSelectionChange(selected.filter(s => s !== custom))}
            scaleValue={ANIMATION.scale.chipPressed}
            haptic={true}
          >
            <Text style={[styles.chipText, styles.chipTextSelected]}>{custom}</Text>
            <Ionicons name="close-circle" size={18} color={COLORS.white} style={{ marginLeft: 4 }} />
          </AnimatedPressable>
        ))}

        {allowCustom && (
          <AnimatedPressable
            style={[styles.chip, styles.chipAdd]}
            onPress={() => setShowCustomInput(true)}
            scaleValue={ANIMATION.scale.chipPressed}
            haptic={false}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.chipText, { color: COLORS.primary }]}>{customLabel}</Text>
          </AnimatedPressable>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {/* Modal para agregar personalizado */}
      <Modal visible={showCustomInput} transparent animationType="fade" onRequestClose={() => setShowCustomInput(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowCustomInput(false)} />
          <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            style={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Agregar opción</Text>
            <TextInput
              style={styles.modalInput}
              value={customText}
              onChangeText={setCustomText}
              placeholder="Escribe aquí..."
              placeholderTextColor={COLORS.textLight}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addCustom}
            />
            <View style={styles.modalButtons}>
              <AnimatedPressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setShowCustomInput(false); setCustomText(''); }}
                scaleValue={ANIMATION.scale.pressed}
                haptic={false}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.modalBtn, styles.modalBtnAdd]}
                onPress={addCustom}
                scaleValue={ANIMATION.scale.pressed}
                haptic={true}
              >
                <Text style={styles.modalBtnAddText}>Agregar</Text>
              </AnimatedPressable>
            </View>
          </MotiView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...FONTS.label,
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
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },
  chipAdd: {
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  chipText: {
    ...FONTS.chip,
    fontWeight: FONTS.weight.medium,
    color: COLORS.chipTextUnselected,
  },
  chipTextSelected: {
    color: COLORS.chipTextSelected,
    fontWeight: FONTS.weight.semibold,
  },
  error: {
    ...FONTS.caption,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  modalTitle: {
    ...FONTS.subtitle,
    marginBottom: SPACING.md,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...FONTS.input,
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
    ...FONTS.label,
    color: COLORS.textSecondary,
  },
  modalBtnAdd: {
    backgroundColor: COLORS.primary,
  },
  modalBtnAddText: {
    ...FONTS.label,
    color: COLORS.white,
  },
});
