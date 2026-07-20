import React, { useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, RADIUS, SPACING, FONTS } from '../../theme';

function parseToDate(valor) {
  const d = new Date();
  if (valor && /^\d{1,2}:\d{2}/.test(valor)) {
    const [h, m] = valor.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setSeconds(0, 0);
  }
  return d;
}

function formatHora(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function abrirSelectorHoraWeb(valorActual, onSelect) {
  if (typeof document === 'undefined') return;

  const input = document.createElement('input');
  input.type = 'time';
  input.value = valorActual || '';
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

export default function HoraField({ label, value, onChange, placeholder = '--:--', style }) {
  const [showPicker, setShowPicker] = useState(false);

  const abrirSelector = () => {
    if (Platform.OS === 'web') {
      abrirSelectorHoraWeb(value, onChange);
      return;
    }
    setShowPicker(true);
  };

  const handleNativeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(formatHora(selectedDate));
      }
    } else if (selectedDate) {
      onChange(formatHora(selectedDate));
    }
  };

  return (
    <View style={style}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.field} onPress={abrirSelector} activeOpacity={0.85}>
        <Ionicons name="time-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value || placeholder}
        </Text>
        {!!value && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onChange(''); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.ink400} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parseToDate(value)}
          mode="time"
          is24Hour
          display="default"
          onChange={handleNativeChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPicker(false)} />
            <View style={styles.modalCard}>
              <TouchableOpacity style={styles.iosCloseBtn} onPress={() => setShowPicker(false)}>
                <Text style={styles.iosCloseText}>Listo</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={parseToDate(value)}
                mode="time"
                is24Hour
                display="spinner"
                themeVariant="light"
                textColor={COLORS.ink900}
                style={styles.iosSpinner}
                onChange={handleNativeChange}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...FONTS.label,
    marginBottom: SPACING.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  value: {
    ...FONTS.body,
    color: COLORS.ink900,
    flex: 1,
  },
  placeholder: {
    color: COLORS.ink400,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingBottom: SPACING.lg,
  },
  iosSpinner: {
    height: 216,
    width: '100%',
  },
  iosCloseBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  iosCloseText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
