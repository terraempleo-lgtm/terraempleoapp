import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../../theme';
import { authAPI } from '../../services/api';

const VERDE = COLORS.primary;
const VERDE_CLARO = COLORS.primaryLight;

export default function SmsVerificationScreen({ route, navigation }) {
  const { celular, onVerificado, siguienteRuta, siguienteParams } = route.params || {};

  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Enviar SMS automáticamente al cargar la pantalla
  useEffect(() => {
    if (celular) {
      enviarCodigo();
    } else {
      Alert.alert('Error', 'No se recibió el número de celular');
    }
  }, []);

  // Countdown para reenvío
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
      setCountdown(60); // esperar 60s para reenviar
      Alert.alert('✅ Código enviado', `Se envió un SMS al ${celular}`);
    } catch (error) {
      const mensaje = error.response?.data?.error || 'No se pudo enviar el código. Verifica el número e intenta de nuevo.';
      Alert.alert(
        'Error',
        mensaje
      );
    } finally {
      setEnviando(false);
    }
  };

  const handleCambioDigito = (valor, index) => {
    // Solo números
    if (!/^\d*$/.test(valor)) return;

    const nuevoCodigo = [...codigo];
    nuevoCodigo[index] = valor;
    setCodigo(nuevoCodigo);

    // Avanzar al siguiente campo
    if (valor && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Si completó los 6 dígitos, verificar automáticamente
    if (nuevoCodigo.every((d) => d !== '') && nuevoCodigo.join('').length === 6) {
      verificarCodigo(nuevoCodigo.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    // Retroceder al campo anterior con backspace
    if (e.nativeEvent.key === 'Backspace' && !codigo[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verificarCodigo = async (codigoCompleto) => {
    const codigoFinal = codigoCompleto || codigo.join('');
    if (codigoFinal.length !== 6) {
      Alert.alert('Error', 'Ingresa los 6 dígitos del código');
      return;
    }
    if (!celular) {
      Alert.alert('Error', 'Celular inválido para verificación');
      return;
    }

    try {
      setLoading(true);
      await authAPI.verificarSMS(celular, codigoFinal);

      if (typeof onVerificado === 'function') {
        onVerificado();
        return;
      }

      if (siguienteRuta) {
        navigation.navigate(siguienteRuta, siguienteParams || {});
        return;
      }

      navigation.goBack();
    } catch (error) {
      const mensaje = error.response?.data?.error || 'Código incorrecto. Intenta de nuevo.';
      Alert.alert('Error', mensaje);
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
        {/* Ícono */}
        <View style={styles.icono}>
          <Text style={styles.iconoTexto}>📱</Text>
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
              style={[
                styles.otpInput,
                digito ? styles.otpInputActivo : null,
              ]}
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
          style={[styles.boton, loading && styles.botonDeshabilitado]}
          onPress={() => verificarCodigo()}
          disabled={loading || codigo.some((d) => d === '')}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>Verificar</Text>
          )}
        </TouchableOpacity>

        {/* Reenviar código */}
        <View style={styles.reenviarContainer}>
          <Text style={styles.reenviarTexto}>¿No recibiste el código? </Text>
          {countdown > 0 ? (
            <Text style={styles.countdown}>Reenviar en {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={enviarCodigo} disabled={enviando}>
              {enviando ? (
                <ActivityIndicator size="small" color={VERDE} />
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
    paddingHorizontal: 32,
  },
  icono: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e6f7ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconoTexto: {
    fontSize: 36,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  celular: {
    fontSize: 16,
    fontWeight: '600',
    color: VERDE,
    marginBottom: 36,
  },
  otpContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  otpInputActivo: {
    borderColor: VERDE_CLARO,
    backgroundColor: COLORS.primarySoft,
  },
  boton: {
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  botonDeshabilitado: {
    backgroundColor: '#80c9a0',
  },
  botonTexto: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
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
    color: VERDE,
    fontSize: 14,
    fontWeight: '600',
  },
  countdown: {
    color: COLORS.textLight,
    fontSize: 14,
  },
});