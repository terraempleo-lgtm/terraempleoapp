import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Button, Input, AppHeader, TerraFooter } from '../../components/ui';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { authAPI, cognitoAPI, passkeyAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import {
  isPasskeySupported,
  getPasskey,
  getPasskeyCelular,
  wasPasskeyPrompted,
} from '../../services/passkeyService';

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const { colors } = useAppTheme();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginFailed, setLoginFailed] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');
  const [showPasskeyBtn, setShowPasskeyBtn] = useState(false);

  // Mostrar botón de passkey si el dispositivo lo soporta y el usuario ya enroló
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      if (!isPasskeySupported()) return;
      const celular = await getPasskeyCelular();
      if (celular) setShowPasskeyBtn(true);
    })();
  }, []);

  const validate = () => {
    const errs = {};
    const val = identificador.trim();
    if (!val) {
      errs.identificador = 'El correo o número de celular es obligatorio';
    } else if (!isEmail(val) && !/^\d{7,15}$/.test(val)) {
      errs.identificador = 'Ingresa un correo válido o número de celular';
    }
    if (!password.trim()) errs.password = 'La contraseña es obligatoria';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setErrorLogin('');
    setLoading(true);
    try {
      const val = identificador.trim();
      let token, user, cognitoAccessToken;

      if (isEmail(val)) {
        const response = await authAPI.login({ correo: val, password: password.trim() });
        token = response.data.token;
        user = response.data.user;
      } else {
        try {
          const response = await cognitoAPI.login(val, password.trim());
          token = response.data.token;
          user = response.data.user;
          cognitoAccessToken = response.data.cognito?.accessToken;
        } catch (cognitoErr) {
          const response = await authAPI.login({ celular: val, password: password.trim() });
          token = response.data.token;
          user = response.data.user;
        }
      }

      if (!token || !user) {
        setErrorLogin('Respuesta del servidor incompleta');
        return;
      }

      // Ofrecer enrollment de passkey solo en native, si no se ha hecho antes
      if (
        Platform.OS !== 'web' &&
        cognitoAccessToken &&
        isPasskeySupported() &&
        !(await wasPasskeyPrompted())
      ) {
        navigation.navigate('PasskeyEnroll', { user, token, cognitoAccessToken });
        return;
      }

      await signIn(user, token);
    } catch (err) {
      const msg = err.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado. Intenta de nuevo.'
        : err.response?.data?.error || 'Correo/teléfono o contraseña incorrectos';
      setErrorLogin(msg);
      setLoginFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setErrorLogin('');
    setPasskeyLoading(true);
    try {
      const celular = await getPasskeyCelular();
      if (!celular) {
        setShowPasskeyBtn(false);
        return;
      }

      // 1. Obtener challenge de Cognito
      const startRes = await passkeyAPI.authStart(celular);
      const { session, credentialRequestOptions } = startRes.data;

      // 2. Invocar Face ID / huella
      const credential = await getPasskey(credentialRequestOptions);

      // 3. Verificar en backend
      const finishRes = await passkeyAPI.authFinish(session, credential, celular);
      const { token, user } = finishRes.data;

      await signIn(user, token);
    } catch (err) {
      if (err.message?.includes('cancel') || err.message?.includes('Cancel')) return;
      const msg = err.response?.data?.error || 'No se pudo iniciar sesión con passkey.';
      const hasFallback = err.response?.data?.fallback === 'password';
      setErrorLogin(hasFallback ? 'Passkey no reconocida. Usa tu contraseña.' : msg);
      if (hasFallback) setShowPasskeyBtn(false);
    } finally {
      setPasskeyLoading(false);
    }
  };

  const biometricLabel = Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Huella / Face ID';
  const biometricIcon = Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline';

  return (
    <View style={styles.gradientBg}>
      <SafeAreaView style={styles.container}>
        <AppHeader title="Iniciar sesión" onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.headerSection}>
            <FadeInView delay={100} translateY={-10}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Bienvenido de nuevo</Text>
            </FadeInView>
            <FadeInView delay={200} translateY={-8}>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Ingresa a tu cuenta de TerraEmpleo
              </Text>
            </FadeInView>
          </View>

          <View style={styles.form}>
            <StaggeredItem index={0}>
              <Input
                label="Correo electrónico o Teléfono"
                value={identificador}
                onChangeText={setIdentificador}
                placeholder="ejemplo@terra.com o 3001234567"
                autoCapitalize="none"
                required
                error={errors.identificador}
              />
            </StaggeredItem>

            <StaggeredItem index={1}>
              <Input
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                required
                error={errors.password}
              />
            </StaggeredItem>

            <AnimatePresence>
              {loginFailed && (
                <MotiView
                  from={{ opacity: 0, translateY: -10 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: -10 }}
                  transition={{ type: 'timing', duration: 300 }}
                >
                  <AnimatedPressable
                    style={styles.forgotContainer}
                    onPress={() => navigation.navigate('RecuperarPassword', {
                      celularInicial: identificador.trim(),
                    })}
                    scaleValue={0.97}
                    haptic={false}
                  >
                    <Text style={[styles.forgotText, { color: colors.primary }]}>¿Olvidaste tu contraseña?</Text>
                  </AnimatedPressable>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <FadeInView delay={400} translateY={10}>
          <View style={[styles.footer, { backgroundColor: 'transparent' }]}>
            {!!errorLogin && (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>{errorLogin}</Text>
              </View>
            )}

            <Button
              title="Entrar"
              onPress={handleLogin}
              loading={loading}
              size="large"
            />

            {showPasskeyBtn && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AnimatedPressable
                  style={styles.passkeyBtn}
                  onPress={handlePasskeyLogin}
                  disabled={passkeyLoading}
                  scaleValue={0.97}
                  haptic
                >
                  <Ionicons name={biometricIcon} size={22} color={COLORS.primary} />
                  <Text style={styles.passkeyBtnText}>
                    {passkeyLoading ? 'Verificando...' : `Iniciar con ${biometricLabel}`}
                  </Text>
                </AnimatedPressable>
              </>
            )}

            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: colors.textSecondary }]}>¿No tienes una cuenta?  </Text>
              <AnimatedPressable
                onPress={() => navigation.navigate('RoleSelect')}
                scaleValue={0.97}
                haptic={false}
              >
                <Text style={[styles.registerLink, { color: colors.primary }]}>Crear cuenta</Text>
              </AnimatedPressable>
            </View>

            <TerraFooter />
          </View>
        </FadeInView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradientBg: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  headerSection: {
    marginBottom: SPACING.xl + SPACING.sm,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  form: {
    gap: SPACING.xs,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginTop: SPACING.xs,
  },
  forgotText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
    gap: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  passkeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    backgroundColor: '#F0FAF4',
    marginBottom: SPACING.sm,
  },
  passkeyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  registerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
  },
  errorBoxText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
