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

} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input } from '../../components/ui';
import { authAPI, cognitoAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';


export default function RecuperarPasswordScreen({ navigation, route }) {
  const celularInicial = route?.params?.celularInicial || '';
  // Método de recuperación: 'sms' | 'email'
  const [metodo, setMetodo] = useState('sms');
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);

  // SMS
  const [celular, setCelular] = useState(celularInicial);
  const [codigoSMS, setCodigoSMS] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otpCodigo, setOtpCodigo] = useState('');
  const otpInputRef = useRef(null);
  const [countdown, setCountdown] = useState(60);

  // Email
  const [correo, setCorreo] = useState('');
  const [celularFromEmail, setCelularFromEmail] = useState('');

  // Nueva contraseña
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [errores, setErrores] = useState({});
  const [mensajeInfo, setMensajeInfo] = useState('');

  const CODIGO_MOCK = '123456';

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

  // ── Validaciones ──
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

  const validarCorreo = () => {
    const valor = correo.trim();
    if (!valor) {
      setErrores({ correo: 'El correo electrónico es obligatorio' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      setErrores({ correo: 'Ingresa un correo electrónico válido' });
      return false;
    }
    setErrores({});
    return true;
  };

  // ── Enviar código por SMS ──
  const enviarCodigoSMS = async () => {
    if (!validarCelular()) return;
    setLoading(true);
    try {
      const valor = celular.replace(/\s/g, '');
      const { data } = await cognitoAPI.forgotPassword(valor);
      setCelular(valor);
      setOtpCodigo('');
      setCodigoSMS('');
      setCountdown(60);
      setPaso(2);
      if (data?.codigo_debug) {
        showAlert('Código de prueba', `Tu código OTP es: ${data.codigo_debug}`);
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  };

  // ── Enviar código por Email ──
  const enviarCodigoEmail = async () => {
    if (!validarCorreo()) return;
    setLoading(true);
    try {
      const { data } = await authAPI.solicitarRecuperacionEmail(correo.trim());

      if (data?.celular) {
        setCelularFromEmail(data.celular);
        setCelular(data.celular);
      }

      setOtpCodigo('');
      setCountdown(60);
      setMensajeInfo(data?.codigo_debug
        ? `Código de prueba: ${data.codigo_debug}`
        : 'Revisa tu bandeja de entrada y escribe el código que te enviamos.');
      setPaso(2);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo enviar el correo de recuperación';
      setErrores({ correo: msg });
    } finally {
      setLoading(false);
    }
  };

  // ── OTP ──
  const onOtpCodeChange = (valor) => {
    const clean = valor.replace(/\D/g, '').slice(0, 6);
    setOtpCodigo(clean);
  };

  const verificarCodigo = async () => {
    const codigo = otpCodigo;
    if (codigo.length !== 6) {
      showAlert('Código incompleto', 'Ingresa los 6 dígitos del código');
      return;
    }

    const celularVerificar = metodo === 'email' ? celularFromEmail || celular : celular;

    if (metodo === 'sms') {
      if (codigo === CODIGO_MOCK) {
        setResetToken(`mock-reset-${Date.now()}`);
      }
      setCodigoSMS(codigo);
      setPaso(3);
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.verificarCodigoRecuperacion(celularVerificar, codigo, metodo);
      setResetToken(data.reset_token);
      setPaso(3);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      let data;
      if (metodo === 'email') {
        const resp = await authAPI.solicitarRecuperacionEmail(correo.trim());
        data = resp.data;
      } else {
        const resp = await cognitoAPI.forgotPassword(celular);
        data = resp.data;
      }
      setOtpCodigo('');
      setCountdown(60);
      if (data?.codigo_debug) {
        setMensajeInfo(`Código de prueba: ${data.codigo_debug}`);
      }
    } catch (err) {
      setMensajeInfo('');
    } finally {
      setLoading(false);
    }
  };

  // ── Guardar nueva contraseña ──
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

    const celularFinal = metodo === 'email' ? celularFromEmail || celular : celular;

    setLoading(true);
    try {
      if (metodo === 'sms') {
        if (codigoSMS === CODIGO_MOCK || String(resetToken).startsWith('mock-reset-')) {
          await authAPI.actualizarPasswordRecuperacion(celularFinal, resetToken || `mock-reset-${Date.now()}`, nuevaPassword);
        } else {
          await cognitoAPI.confirmForgotPassword(celularFinal, codigoSMS, nuevaPassword);
        }
      } else {
        await authAPI.actualizarPasswordRecuperacion(celularFinal, resetToken, nuevaPassword);
      }
      showAlert('Éxito', 'Contraseña actualizada correctamente', [
        { text: 'Ir a iniciar sesión', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const cambiarMetodo = (nuevoMetodo) => {
    setMetodo(nuevoMetodo);
    setErrores({});
  };

  const strength = fuerzaPassword();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
          <View style={styles.recuperarContainer}>
            {/* ── Paso 1: Solicitar código ── */}
            {paso === 1 && (
              <>
                <Text style={styles.recuperarTitulo}>Restablecer contraseña</Text>
                <Text style={styles.recuperarSubtitulo}>
                  Elige cómo quieres recibir tu código de recuperación
                </Text>

                {/* Tabs SMS / Email / Passkey */}
                <View style={styles.tabsRow}>
                  <TouchableOpacity
                    style={[styles.tab, metodo === 'sms' && styles.tabActive]}
                    onPress={() => cambiarMetodo('sms')}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={metodo === 'sms' ? COLORS.white : COLORS.primary} />
                    <Text style={[styles.tabText, metodo === 'sms' && styles.tabTextActive]}>SMS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tab, metodo === 'email' && styles.tabActive]}
                    onPress={() => cambiarMetodo('email')}
                  >
                    <Ionicons name="mail-outline" size={18} color={metodo === 'email' ? COLORS.white : COLORS.primary} />
                    <Text style={[styles.tabText, metodo === 'email' && styles.tabTextActive]}>Correo</Text>
                  </TouchableOpacity>
                </View>

                {metodo === 'sms' ? (
                  <>
                    <Input
                      label="Número de celular"
                      value={celular}
                      onChangeText={setCelular}
                      keyboardType="phone-pad"
                      placeholder="300 000 0000"
                      icon="call-outline"
                      error={errores.celular}
                    />
                    <Button
                      title="Enviar código por SMS"
                      onPress={enviarCodigoSMS}
                      loading={loading}
                      size="large"
                      style={styles.actionBtn}
                    />
                  </>
                ) : (
                  <>
                    <Input
                      label="Correo electrónico"
                      value={correo}
                      onChangeText={setCorreo}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="ejemplo@correo.com"
                      icon="mail-outline"
                      error={errores.correo}
                    />
                    <Button
                      title="Enviar código por correo"
                      onPress={enviarCodigoEmail}
                      loading={loading}
                      size="large"
                      style={styles.actionBtn}
                    />
                  </>
                )}

                <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.linkText}>← Volver al inicio de sesión</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Paso 2: Verificar código OTP ── */}
            {paso === 2 && (
              <>
                <Text style={styles.recuperarTitulo}>Ingresa el código</Text>
                <Text style={styles.recuperarSubtitulo}>
                  {metodo === 'email'
                    ? `Enviamos un código de 6 dígitos a ${correo}`
                    : `Enviamos un código de 6 dígitos al ${celular}`}
                </Text>

                {!!mensajeInfo && (
                  <View style={styles.infoBox}>
                    <Text style={styles.infoBoxText}>{mensajeInfo}</Text>
                  </View>
                )}

                <View style={styles.otpContainer}>
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.otpTouchArea}
                    onPress={() => otpInputRef.current?.focus()}
                  >
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <View key={index} style={[styles.otpInput, otpCodigo.length > index && styles.otpInputFilled]}>
                        <Text style={styles.otpDigit}>{otpCodigo[index] || ''}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                  <TextInput
                    ref={otpInputRef}
                    value={otpCodigo}
                    onChangeText={onOtpCodeChange}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={styles.hiddenOtpInput}
                  />
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

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => { setPaso(1); setOtpCodigo(''); }}
                >
                  <Text style={styles.linkText}>← Cambiar método de recuperación</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Paso 3: Nueva contraseña ── */}
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
    marginBottom: 24,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  tabTextActive: {
    color: COLORS.white,
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

  mockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  mockNoticeText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    fontWeight: '600',
  },

  otpContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  otpTouchArea: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0d0d0d',
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
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
  passkeyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  passkeyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  passkeyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  passkeySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  passkeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: '100%',
    ...SHADOWS.small,
  },
  passkeyBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  infoBox: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: SPACING.md,
  },
  infoBoxText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

});
