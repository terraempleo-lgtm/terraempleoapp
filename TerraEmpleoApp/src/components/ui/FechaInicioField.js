import React from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, FONTS } from '../../theme';
import { formatVacancyStartDate, getFechaInicioInputValue } from '../../utils/vacantesFecha';

function abrirSelectorFechaWeb(valorActual, onSelect) {
  if (typeof document === 'undefined') return;

  const input = document.createElement('input');
  input.type = 'date';
  input.value = getFechaInicioInputValue(valorActual);
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  input.style.left = '-9999px';

  input.addEventListener('change', (event) => {
    const valor = event.target?.value || '';
    onSelect(valor || '');
    input.remove();
  });

  input.addEventListener('blur', () => {
    setTimeout(() => input.remove(), 0);
  });

  document.body.appendChild(input);

  if (typeof input.showPicker === 'function') {
    input.showPicker();
    return;
  }

  input.click();
}

export default function FechaInicioField({
  label = 'Fecha de inicio',
  value,
  onChange,
  helper = 'Indica desde qué fecha necesitas al trabajador',
  placeholder = 'Selecciona una fecha',
}) {
  const fechaMostrada = formatVacancyStartDate(value, { long: true, fallback: '' });

  const abrirSelector = () => {
    if (Platform.OS === 'web') {
      abrirSelectorFechaWeb(value, onChange);
      return;
    }

    Alert.alert('Fecha de inicio', 'Seleccion de fecha disponible en web por ahora.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={abrirSelector} activeOpacity={0.85}>
        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
        <Text style={[styles.value, !fechaMostrada && styles.placeholder]}>
          {fechaMostrada || placeholder}
        </Text>
        {fechaMostrada ? (
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={16} color={COLORS.textLight} />
        )}
      </TouchableOpacity>
      <Text style={styles.helper}>{helper}</Text>
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 54,
  },
  value: {
    flex: 1,
    ...FONTS.input,
    fontWeight: FONTS.weight.semibold,
    textTransform: 'capitalize',
  },
  placeholder: {
    color: COLORS.textLight,
    fontWeight: FONTS.weight.regular,
    textTransform: 'none',
  },
  helper: {
    ...FONTS.caption,
    marginTop: SPACING.xs + 2,
  },
});
