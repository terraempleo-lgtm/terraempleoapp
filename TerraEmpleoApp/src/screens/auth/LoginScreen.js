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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input } from '../../components/ui';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

function TerraEmpleoFooter() {
  return (
    <View style={footerStyles.wrap}>
      <View style={footerStyles.iconBox}>
        <Ionicons name="leaf" size={14} color="#9E9E9E" />
      </View>
      <Text style={footerStyles.text}>TerraEmpleo</Text>
    </View>
  );
}

const footerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  iconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!celular.trim()) errs.celular = 'El número de celular es obligatorio';
    else if (!/^\d{7,15}$/.test(celular.trim())) errs.celular = 'Ingresa un número de celular válido';
    if (!password.trim()) errs.password = 'La contraseña es obligatoria';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        celular: celular.trim(),
        password: password.trim(),
      };

      const response = await authAPI.login(payload);
      const { token, user } = response.data;
      signIn(user, token);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus datos.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header con flecha y título */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Iniciar sesión</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Título de bienvenida */}
          <Text style={styles.title}>Bienvenido de nuevo</Text>
          <Text style={styles.subtitle}>
            Ingresa tus datos para continuar en TerraEmpleo
          </Text>

          {/* Formulario */}
          <View style={styles.form}>
            <Input
              label="Número de celular"
              value={celular}
              onChangeText={setCelular}
              placeholder="Ej: 3001234567"
              keyboardType="phone-pad"
              icon="call-outline"
              required
              error={errors.celular}
            />

            <Input
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              placeholder="Tu contraseña"
              secureTextEntry
              icon="lock-closed-outline"
              required
              error={errors.password}
            />

            {/* ¿Olvidaste tu contraseña? */}
            <TouchableOpacity style={styles.forgotContainer} onPress={() => navigation.navigate('RecuperarPassword')}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Botón y link al fondo */}
      <View style={styles.footer}>
        <Button
          title="Ingresar"
          onPress={handleLogin}
          loading={loading}
          size="large"
          style={styles.loginButton}
        />
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('RoleSelect')}>
            <Text style={styles.registerLink}>Regístrate</Text>
          </TouchableOpacity>
        </View>
        <TerraEmpleoFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 180,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
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
    color: '#008d49',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  loginButton: {
    borderRadius: RADIUS.xl || 30,
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
    color: '#008d49',
  },
});
