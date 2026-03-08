import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input } from '../../components/ui';
import { authAPI } from '../../services/api';

export default function RecuperarPasswordScreen({ navigation }) {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);

  const [celular, setCelular] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [countdown, setCountdown] = useState(60);

  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (paso !== 2 || countdown <= 0) return undefined;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [paso, countdown]);

  const fuerzaPassword = () => {
    const p = nuevaPassword.trim();
    if (p.length < 6) return { label: 'Débil', color: COLORS.error };
    if (p.length < 9 || !/[A-Z]/.test(p) || !/[0-9]/.test(p)) {
      return { label: 'Media', color: COLORS.warning };
    }
    return { label: 'Fuerte', color: COLORS.success };
  };

  const validarCelular = () => {
    const valor = celular.replace(/\s/g, '');
    if (!valor) {
      setErrores({ celular: 'El número de celular es obligatorio' });
      return false;
    }
    if (!/^\d{7,15}$/.test(valor)) {
      setErrores({ celular: 'Ingresa un número de celular válido' });
      return false;
    }
    setErrores({});
    return true;
  };

  const enviarCodigo = async () => {
    if (!validarCelular()) return;
    setLoading(true);
    try {
      const valor = celular.replace(/\s/g, '');
      const { data } = await authAPI.solicitarRecuperacion(valor);
      setCelular(valor);
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      setPaso(2);
      if (data?.codigo_debug) {
        Alert.alert('Código de prueba', `Tu código OTP es: ${data.codigo_debug}`);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (valor, index) => {
    const digito = valor.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digito;
    setOtp(next);

    if (digito && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const onOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verificarCodigo = async () => {
    const codigo = otp.join('');
    if (codigo.length !== 6) {
      Alert.alert('Código incompleto', 'Ingresa los 6 dígitos del código');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.verificarCodigoRecuperacion(celular, codigo);
      setResetToken(data.reset_token);
      setPaso(3);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const { data } = await authAPI.solicitarRecuperacion(celular);
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      if (data?.codigo_debug) {
        Alert.alert('Nuevo código', `Tu nuevo OTP es: ${data.codigo_debug}`);
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo reenviar el código');
    } finally {
      setLoading(false);
    }
  };

  const guardarNuevaPassword = async () => {
    const nextErrores = {};
    if (!nuevaPassword || nuevaPassword.length < 6) {
      nextErrores.nuevaPassword = 'Mínimo 6 caracteres';
    }
    if (confirmarPassword !== nuevaPassword) {
      nextErrores.confirmarPassword = 'Las contraseñas no coinciden';
    }

    setErrores(nextErrores);
    if (Object.keys(nextErrores).length > 0) return;

    setLoading(true);
    try {
      await authAPI.actualizarPasswordRecuperacion(celular, resetToken, nuevaPassword);
      Alert.alert('Éxito', 'Contraseña actualizada correctamente ✓', [
        { text: 'Ir a iniciar sesión', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const strength = fuerzaPassword();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.recuperarContainer}>
            {paso === 1 && (
              <>
                <Text style={styles.recuperarTitulo}>Recuperar contraseña</Text>
                <Text style={styles.recuperarSubtitulo}>
                  Ingresa tu número de celular registrado y te enviaremos un código de verificación
                </Text>

                <Input
                  label="Número de celular"
                  value={celular}
                  onChangeText={setCelular}
                  keyboardType="phone-pad"
                  placeholder="300 000 0000"
                  icon="call-outline"
                  error={errores.celular}
                />

                <Button title="Enviar código" onPress={enviarCodigo} loading={loading} size="large" style={styles.actionBtn} />

                <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.linkText}>← Volver al inicio de sesión</Text>
                </TouchableOpacity>
              </>
            )}

            {paso === 2 && (
              <>
                <Text style={styles.recuperarTitulo}>Ingresa el código</Text>
                <Text style={styles.recuperarSubtitulo}>Enviamos un código de 6 dígitos al {celular}</Text>

                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { otpRefs.current[index] = ref; }}
                      value={digit}
                      onChangeText={(value) => onOtpChange(value, index)}
                      onKeyPress={(e) => onOtpKeyPress(e, index)}
                      style={styles.otpInput}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                    />
                  ))}
                </View>

                <Button title="Verificar" onPress={verificarCodigo} loading={loading} size="large" style={styles.actionBtn} />

                <TouchableOpacity
                  style={[styles.linkBtn, countdown > 0 && styles.linkBtnDisabled]}
                  onPress={reenviarCodigo}
                  disabled={countdown > 0 || loading}
                >
                  <Text style={[styles.linkText, countdown > 0 && styles.linkTextDisabled]}>
                    {countdown > 0
                      ? `¿No recibiste el código? Reenviar en ${countdown}s`
                      : '¿No recibiste el código? Reenviar'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {paso === 3 && (
              <>
                <Text style={styles.recuperarTitulo}>Nueva contraseña</Text>
                <Text style={styles.recuperarSubtitulo}>Crea una contraseña segura para tu cuenta</Text>

                <Input
                  label="Nueva contraseña"
                  value={nuevaPassword}
                  onChangeText={setNuevaPassword}
                  placeholder="Ingresa tu nueva contraseña"
                  secureTextEntry
                  icon="lock-closed-outline"
                  error={errores.nuevaPassword}
                />

                <View style={styles.strengthWrap}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={strength.color} />
                  <Text style={[styles.strengthText, { color: strength.color }]}>Fortaleza: {strength.label}</Text>
                </View>

                <Input
                  label="Confirmar contraseña"
                  value={confirmarPassword}
                  onChangeText={setConfirmarPassword}
                  placeholder="Repite tu nueva contraseña"
                  secureTextEntry
                  icon="lock-closed-outline"
                  error={errores.confirmarPassword}
                />

                <Button
                  title="Guardar contraseña"
                  onPress={guardarNuevaPassword}
                  loading={loading}
                  size="large"
                  style={styles.actionBtn}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },

  recuperarContainer: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  recuperarTitulo: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0d0d0d',
    marginBottom: 8,
  },
  recuperarSubtitulo: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 32,
  },

  actionBtn: {
    backgroundColor: '#008d49',
    borderRadius: RADIUS.full,
    ...SHADOWS.small,
  },

  linkBtn: {
    marginTop: SPACING.md,
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  linkBtnDisabled: { opacity: 0.7 },
  linkText: {
    color: '#008d49',
    fontSize: 14,
    fontWeight: '600',
  },
  linkTextDisabled: { color: COLORS.textLight },

  otpContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#0d0d0d',
    backgroundColor: COLORS.white,
  },

  strengthWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
  },
  strengthText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
