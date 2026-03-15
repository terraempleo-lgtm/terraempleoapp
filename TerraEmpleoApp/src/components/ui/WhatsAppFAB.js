import React from 'react';
import { TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../../theme';

const WHATSAPP_NUMBER = '573108870800';
const WHATSAPP_MESSAGE = 'Hola, necesito ayuda con TerraEmpleo.';

export default function WhatsAppFAB() {
  const handlePress = async () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'WhatsApp no disponible',
          'No se pudo abrir WhatsApp. Verifica que esté instalado en tu dispositivo.',
        );
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir el enlace de soporte.');
    }
  };

  return (
    <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={handlePress}>
      <Ionicons name="headset-outline" size={28} color={COLORS.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.button,
    zIndex: 999,
    elevation: 10,
  },
});
