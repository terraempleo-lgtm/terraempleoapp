import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../theme';
import { Button, Input, AppHeader, TerraFooter } from '../../components/ui';
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
        // Email → legacy login
        const response = await authAPI.login({ correo: val, password: password.trim() });
        token = response.data.token;
        user = response.data.user;
      } else {
        // Phone → Cognito login, fallback to legacy if user not in Cognito
        try {
          const response = await cognitoAPI.login(val, password.trim());
          token = response.data.token;
          user = response.data.user;
        } catch (cognitoErr) {
          const code = cognitoErr.response?.status;
          // 404 = user not in Cognito → try legacy login with celular
          if (code === 404) {
            const response = await authAPI.login({ celular: val, password: password.trim() });
            token = response.data.token;
            user = response.data.user;
          } else {
            throw cognitoErr;
          }
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
    <SafeAreaView style={styles.container}>
      <AppHeader title="Iniciar sesión" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Título de bienvenida */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Bienvenido de nuevo</Text>
            <Text style={styles.subtitle}>
              Ingresa a tu cuenta de TerraEmpleo
            </Text>
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            <Input
              label="Correo electrónico o Teléfono"
              value={identificador}
              onChangeText={setIdentificador}
              placeholder="ejemplo@terra.com o 3001234567"
              autoCapitalize="none"
              required
              error={errors.identificador}
            />

            <Input
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              required
              error={errors.password}
            />

            {/* ¿Olvidaste tu contraseña? — solo aparece tras primer error */}
            {loginFailed && (
              <TouchableOpacity
                style={styles.forgotContainer}
                onPress={() => navigation.navigate('RecuperarPassword', {
                  celularInicial: identificador.trim(),
                })}
              >
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <Button
          title="Entrar"
          onPress={handleLogin}
          loading={loading}
          size="large"
        />

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>¿No tienes una cuenta?  </Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoleSelect')}>
            <Text style={styles.registerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>

        <TerraFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
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
});
