import React, { useRef, useState } from 'react';
import { FlatList, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, FONTS } from '../../theme';

// Selector de hora 100% JS (sin @react-native-community/datetimepicker).
// El módulo nativo requiere un build nuevo para llegarle a celulares con la
// app ya instalada — un OTA no alcanza a instalarlo — así que la rueda de
// hora/minuto se dibuja a mano con FlatList y funciona en cualquier binario.
const ITEM_H = 40;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const PAD_V = (WHEEL_H - ITEM_H) / 2;

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function parseValor(valor) {
  if (valor && /^\d{1,2}:\d{2}/.test(valor)) {
    const [h, m] = valor.split(':').map(Number);
    return {
      hIdx: Math.min(23, Math.max(0, h || 0)),
      mIdx: Math.min(11, Math.max(0, Math.round((m || 0) / 5))),
    };
  }
  const ahora = new Date();
  return { hIdx: ahora.getHours(), mIdx: Math.round(ahora.getMinutes() / 5) % 12 };
}

function Rueda({ datos, indiceInicial, onCambiar }) {
  const listRef = useRef(null);
  const [indice, setIndice] = useState(indiceInicial);

  const seleccionar = (i) => {
    setIndice(i);
    onCambiar(i);
  };

  const onMomentumEnd = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.min(datos.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    seleccionar(i);
  };

  const tocarItem = (i) => {
    listRef.current?.scrollToOffset({ offset: i * ITEM_H, animated: true });
    seleccionar(i);
  };

  return (
    <View style={styles.wheelWrap}>
      <View style={styles.wheelBanda} pointerEvents="none" />
      <FlatList
        ref={listRef}
        data={datos}
        keyExtractor={(v) => v}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: PAD_V }}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        initialScrollIndex={indiceInicial}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index: i }) => (
          <TouchableOpacity style={styles.wheelItem} onPress={() => tocarItem(i)} activeOpacity={0.6}>
            <Text style={[styles.wheelText, i === indice && styles.wheelTextActivo]}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
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
  const [seleccion, setSeleccion] = useState(() => parseValor(value));

  const abrirSelector = () => {
    if (Platform.OS === 'web') {
      abrirSelectorHoraWeb(value, onChange);
      return;
    }
    setSeleccion(parseValor(value));
    setShowPicker(true);
  };

  const confirmar = () => {
    onChange(`${HORAS[seleccion.hIdx]}:${MINUTOS[seleccion.mIdx]}`);
    setShowPicker(false);
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

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPicker(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Selecciona la hora'}</Text>
              <TouchableOpacity style={styles.iosCloseBtn} onPress={confirmar}>
                <Text style={styles.iosCloseText}>Listo</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.ruedasRow}>
              <Rueda datos={HORAS} indiceInicial={seleccion.hIdx} onCambiar={(i) => setSeleccion((s) => ({ ...s, hIdx: i }))} />
              <Text style={styles.dosPuntos}>:</Text>
              <Rueda datos={MINUTOS} indiceInicial={seleccion.mIdx} onCambiar={(i) => setSeleccion((s) => ({ ...s, mIdx: i }))} />
            </View>
          </View>
        </View>
      </Modal>
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink900,
  },
  ruedasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  wheelWrap: {
    height: WHEEL_H,
    width: 90,
  },
  wheelBanda: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD_V,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.primary + '10',
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 18,
    color: COLORS.ink400,
    fontWeight: '600',
  },
  wheelTextActivo: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  dosPuntos: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink900,
    marginHorizontal: 4,
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
