import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS, SHADOWS } from '../../theme';

// ── Helpers ────────────────────────────────────────────────────────────────

function detectType(title = '', buttons = []) {
  const t = title.toLowerCase();
  if (buttons.some(b => b.style === 'destructive')) return 'destructive';
  if (t.includes('error') || t.includes('falló') || t.includes('fallo')) return 'error';
  if (t.includes('éxito') || t.includes('listo') || t.includes('enviado') ||
      t.includes('guardado') || t.includes('registrado') || t.includes('completado') ||
      t.includes('correcto') || t.includes('enviada') || t.includes('creada') ||
      t.includes('actualizado') || t.includes('eliminado')) return 'success';
  if (t.includes('advertencia') || t.includes('atención')) return 'warning';
  return 'info';
}

const TYPE_META = {
  success:     { icon: 'checkmark-circle', color: COLORS.primary,   bg: COLORS.primarySoft },
  error:       { icon: 'close-circle',     color: COLORS.error,      bg: COLORS.errorSoft },
  warning:     { icon: 'alert-circle',     color: COLORS.warning,    bg: COLORS.warningSoft },
  info:        { icon: 'information-circle', color: COLORS.info,     bg: COLORS.infoSoft },
  destructive: { icon: 'trash',            color: COLORS.error,      bg: COLORS.errorSoft },
};

// ── Component ──────────────────────────────────────────────────────────────

const AppAlert = React.forwardRef((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [cfg, setCfg] = useState({ title: '', message: '', buttons: [], type: 'info' });
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  React.useImperativeHandle(ref, () => ({
    show(title, message = '', buttons = [{ text: 'OK' }], type) {
      const resolvedType = type || detectType(title, buttons);
      setCfg({ title, message, buttons, type: resolvedType });
      setVisible(true);
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 180 });
    },
  }));

  const dismiss = () => {
    scale.value = withTiming(0.9, { duration: 150 });
    opacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => setVisible(false), 160);
  };

  const handleBtn = (onPress) => {
    dismiss();
    setTimeout(() => onPress?.(), 200);
  };

  const { title, message, buttons, type } = cfg;
  const { icon, color, bg } = TYPE_META[type] ?? TYPE_META.info;

  const columnLayout = buttons.length > 2;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, animatedCard]}>

          {/* ── Icon badge ── */}
          <View style={[styles.iconWrap, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={34} color={color} />
          </View>

          {/* ── Title ── */}
          <Text style={styles.title}>{title}</Text>

          {/* ── Message ── */}
          {!!message && <Text style={styles.message}>{message}</Text>}

          {/* ── Buttons ── */}
          <View style={[styles.btnRow, columnLayout && styles.btnColumn]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.btn,
                    columnLayout ? styles.btnFull : styles.btnFlex,
                    isCancel      ? styles.btnOutline     :
                    isDestructive ? styles.btnRed          :
                                    styles.btnGreen,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={() => handleBtn(btn.onPress)}
                >
                  <Text style={[
                    styles.btnText,
                    isCancel ? styles.btnTextGray : styles.btnTextWhite,
                  ]}>
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
});

AppAlert.displayName = 'AppAlert';
export default AppAlert;

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.large,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.subtitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    ...FONTS.body,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.sm,
  },
  btnColumn: {
    flexDirection: 'column',
  },
  btnFlex: {
    flex: 1,
  },
  btnFull: {
    width: '100%',
  },
  btn: {
    height: 48,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  btnGreen: {
    backgroundColor: COLORS.primary,
  },
  btnRed: {
    backgroundColor: COLORS.error,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  btnPressed: {
    opacity: 0.78,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTextWhite: {
    color: COLORS.white,
  },
  btnTextGray: {
    color: COLORS.textLight,
  },
});
