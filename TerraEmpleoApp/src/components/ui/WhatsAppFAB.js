import React, { useEffect } from 'react';
import { StyleSheet, Alert, Linking } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SHADOWS } from '../../theme';
import { AnimatedPressable } from '../animated';
import { showAlert } from '../../utils/alertService';

const WHATSAPP_NUMBER = '573108870800';
const WHATSAPP_MESSAGE = 'Hola, necesito ayuda con TerraEmpleo.';

export default function WhatsAppFAB() {
  const pulseScale = useSharedValue(1);
  const entryScale = useSharedValue(0);
  const entryOpacity = useSharedValue(0);

  useEffect(() => {
    // Entrance animation
    entryScale.value = withDelay(600, withTiming(1, { duration: 400 }));
    entryOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    // Pulse animation
    pulseScale.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entryScale.value * pulseScale.value }],
    opacity: entryOpacity.value,
  }));

  const handlePress = async () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert(
          'WhatsApp no disponible',
          'No se pudo abrir WhatsApp. Verifica que esté instalado en tu dispositivo.',
        );
      }
    } catch {
      showAlert('Error', 'No se pudo abrir el enlace de soporte.');
    }
  };

  return (
    <Animated.View style={[styles.fabWrapper, animatedStyle]}>
      <AnimatedPressable
        style={styles.fab}
        onPress={handlePress}
        scaleValue={0.9}
        haptic={true}
      >
        <Ionicons name="headset-outline" size={28} color={COLORS.white} />
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    position: 'absolute',
    bottom: 90,
    right: SPACING.lg,
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.button,
    elevation: 10,
  },
});
