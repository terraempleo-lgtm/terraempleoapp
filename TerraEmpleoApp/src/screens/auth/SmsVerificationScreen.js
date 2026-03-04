// SmsVerificationScreen.js
// Pantalla de verificación de celular por SMS usando Firebase Auth
// Compatible con Expo (sin expo-firebase-recaptcha necesario en SDK 49+)

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
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../firebaseConfig'; // ajusta la ruta según tu proyecto
import app from '../firebaseConfig';

const VERDE = '#2E7D32';
const VERDE_CLARO = '#4CAF50';

export default function SmsVerificationScreen({ route, navigation }) {
  // Recibe el número de celular desde la pantalla anterior
  // Ejemplo: navigation.navigate('SmsVerification', { celular: '+573001234567' })
  const { celular } = route.params || {};

  const recaptchaVerifier = useRef(null);
  const [verificationId, setVerificationId] = useState(null);
  const [codigo, setCodigo] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Enviar SMS automáticamente al cargar la pantalla
  useEffect(() => {
    if (celular) {
      enviarCodigo();
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
    if (enviando) return;
    try {
      setEnviando(true);
      const phoneProvider = new PhoneAuthProvider(auth);
      const id = await phoneProvider.verifyPhoneNumber(
        celular,
        recaptchaVerifier.current
      );
      setVerificationId(id);
      setCountdown(60); // esperar 60s para reenviar
      Alert.alert('✅ Código enviado', `Se envió un SMS al ${celular}`);
    } catch (error) {
      console.error('Error al enviar SMS:', error);
      Alert.alert(
        'Error',
        'No se pudo enviar el código. Verifica el número e intenta de nuevo.'
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
    if (!verificationId) {
      Alert.alert('Error', 'Primero debes solicitar el código SMS');
      return;
    }

    try {
      setLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, codigoFinal);
      await signInWithCredential(auth, credential);

      // ✅ Verificación exitosa — navegar al siguiente paso
      // Ajusta la navegación según tu flujo de registro
      navigation.navigate('FotoVerificacion'); // o el paso que sigue
    } catch (error) {
      console.error('Error al verificar código:', error);
      let mensaje = 'Código incorrecto. Intenta de nuevo.';
      if (error.code === 'auth/code-expired') {
        mensaje = 'El código expiró. Solicita uno nuevo.';
      }
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
      {/* reCAPTCHA invisible — requerido por Firebase */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={app.options}
        attemptInvisibleVerification={true}
      />

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
    backgroundColor: '#fff',
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
    backgroundColor: '#E8F5E9',
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
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 15,
    color: '#666',
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
    borderColor: '#ddd',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    backgroundColor: '#f9f9f9',
  },
  otpInputActivo: {
    borderColor: VERDE_CLARO,
    backgroundColor: '#F1F8E9',
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
    backgroundColor: '#A5D6A7',
  },
  botonTexto: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reenviarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reenviarTexto: {
    color: '#666',
    fontSize: 14,
  },
  reenviarLink: {
    color: VERDE,
    fontSize: 14,
    fontWeight: '600',
  },
  countdown: {
    color: '#999',
    fontSize: 14,
  },
});