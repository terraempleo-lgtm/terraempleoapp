import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, AnimatePresence } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, AppHeader, TerraFooter } from '../../components/ui';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { authAPI, cognitoAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginFailed, setLoginFailed] = useState(false);

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
        Alert.alert('Error', 'Respuesta del servidor incompleta');
        return;
      }

      await signIn(user, token);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus datos.';
      Alert.alert('Error', msg);
      setLoginFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header visual con gradiente */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <AnimatedPressable
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            scaleValue={0.9}
            haptic
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </AnimatedPressable>

          <MotiView
            from={{ scale: 0.5, opacity: 0, rotate: '-30deg' }}
            animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
            transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 200 }}
            style={styles.iconContainer}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="leaf" size={32} color={COLORS.accent} />
            </View>
          </MotiView>

          <FadeInView delay={300} translateY={-10}>
            <Text style={styles.headerTitle}>TerraEmpleo</Text>
          </FadeInView>
          <FadeInView delay={400} translateY={-8}>
            <Text style={styles.headerSubtitle}>Tu conexión con el campo</Text>
          </FadeInView>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Título de bienvenida con animación */}
          <View style={styles.headerSection}>
            <FadeInView delay={500} translateY={-10}>
              <Text style={styles.title}>Bienvenido de nuevo</Text>
            </FadeInView>
            <FadeInView delay={600} translateY={-8}>
              <Text style={styles.subtitle}>
                Ingresa a tu cuenta para continuar
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
                    <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                  </AnimatedPressable>
                </MotiView>
              )}
            </AnimatePresence>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer fijo */}
      <FadeInView delay={400} translateY={10}>
        <View style={styles.footer}>
          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            size="large"
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>¿No tienes una cuenta?  </Text>
            <AnimatedPressable
              onPress={() => navigation.navigate('RoleSelect')}
              scaleValue={0.97}
              haptic={false}
            >
              <Text style={styles.registerLink}>Crear cuenta</Text>
            </AnimatedPressable>
          </View>

          <TerraFooter />
        </View>
      </FadeInView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerGradient: {
    paddingBottom: SPACING.xl,
  },
  headerSafe: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  backBtn: {
    position: 'absolute',
    left: SPACING.md,
    top: SPACING.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: SPACING.xs,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  headerSection: {
    marginBottom: SPACING.lg,
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
});
