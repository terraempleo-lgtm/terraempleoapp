import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { authAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';

export default function SmsVerificationScreen({ route, navigation }) {
  const { celular, onVerificado, siguienteRuta, siguienteParams } = route.params || {};

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (celular) {
      enviarCodigo();
    } else {
      showAlert('Error', 'No se recibió el número de celular');
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const enviarCodigo = async () => {
    if (enviando || !celular) return;
    try {
      setEnviando(true);
      await authAPI.enviarSMS(celular);
      setCountdown(60);
      showAlert('Código enviado', `Se envió un SMS al ${celular}`);
    } catch (error) {
      const mensaje = error.response?.data?.error || 'No se pudo enviar el código. Verifica el número e intenta de nuevo.';
      showAlert('Error', mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleCambioDigito = (valor, index) => {
    if (!/^\d*$/.test(valor)) return;
    const nuevoCodigo = [...codigo];
    nuevoCodigo[index] = valor;
    setCodigo(nuevoCodigo);
    if (valor && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (nuevoCodigo.every((d) => d !== '') && nuevoCodigo.join('').length === 6) {
      verificarCodigo(nuevoCodigo.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !codigo[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verificarCodigo = async (codigoCompleto) => {
    const codigoFinal = codigoCompleto || codigo.join('');
    if (codigoFinal.length !== 6) {
      showAlert('Error', 'Ingresa los 6 dígitos del código');
      return;
    }
    if (!celular) {
      showAlert('Error', 'Celular inválido para verificación');
      return;
    }
    try {
      setLoading(true);
      await authAPI.verificarSMS(celular, codigoFinal);
      if (typeof onVerificado === 'function') { onVerificado(); return; }
      if (siguienteRuta) { navigation.navigate(siguienteRuta, siguienteParams || {}); return; }
      navigation.goBack();
    } catch (error) {
      const mensaje = error.response?.data?.error || 'Código incorrecto. Intenta de nuevo.';
      showAlert('Error', mensaje);
      setCodigo(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.contenido}>
        {/* Icono */}
        <View style={styles.icono}>
          <Ionicons name="shield-checkmark" size={36} color={COLORS.primary} />
        </View>

        <Text style={styles.titulo}>Verifica tu celular</Text>
        <Text style={styles.subtitulo}>
          Ingresa el código de 6 dígitos que enviamos al
        </Text>
        <Text style={styles.celular}>{celular}</Text>

        {/* Inputs OTP */}
        <View style={styles.otpContainer}>
          {codigo.map((digito, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digito ? styles.otpInputActivo : null]}
              value={digito}
              onChangeText={(val) => handleCambioDigito(val, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Botón verificar */}
        <TouchableOpacity
          style={[styles.boton, (loading || codigo.some((d) => d === '')) && styles.botonDeshabilitado]}
          onPress={() => verificarCodigo()}
          disabled={loading || codigo.some((d) => d === '')}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Verificar código</Text>
          )}
        </TouchableOpacity>

        {/* Reenviar código */}
        <View style={styles.reenviarContainer}>
          <Text style={styles.reenviarTexto}>¿No recibiste el código? </Text>
          {countdown > 0 ? (
            <View style={styles.countdownWrap}>
              <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
              <Text style={styles.countdown}>Reenviar en {countdown}s</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={enviarCodigo} disabled={enviando}>
              {enviando ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.reenviarLink}>Reenviar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contenido: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  icono: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  celular: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    backgroundColor: '#F9FAFB',
  },
  otpInputActivo: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  boton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.button,
  },
  botonDeshabilitado: {
    backgroundColor: COLORS.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  botonTexto: {
    color: COLORS.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  reenviarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reenviarTexto: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  reenviarLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  countdownWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    color: COLORS.textLight,
    fontSize: 14,
  },
});
