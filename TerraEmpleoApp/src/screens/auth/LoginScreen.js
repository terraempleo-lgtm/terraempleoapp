import React, { useState } from 'react';
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
import { COLORS, SPACING } from '../../theme';
import { Button, Input, AppHeader, TerraFooter } from '../../components/ui';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { authAPI, cognitoAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const { colors } = useAppTheme();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginFailed, setLoginFailed] = useState(false);
  const [errorLogin, setErrorLogin] = useState('');

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
      let token, user;

      if (isEmail(val)) {
        const response = await authAPI.login({ correo: val, password: password.trim() });
        token = response.data.token;
        user = response.data.user;
      } else {
        try {
          const response = await cognitoAPI.login(val, password.trim());
          token = response.data.token;
          user = response.data.user;
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
          {/* Título de bienvenida con animación */}
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

          {/* Formulario con stagger */}
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

            {/* ¿Olvidaste tu contraseña? — animación de entrada */}
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

        {/* Footer fijo */}
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
