import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input } from '../../components/ui';
import { authAPI, setAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen({ navigation }) {
  const { signIn, setLoading } = useAuth();
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoadingLocal] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!celular.trim()) errs.celular = 'El celular es obligatorio';
    if (!password.trim()) errs.password = 'La contraseña es obligatoria';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoadingLocal(true);
    try {
      const response = await authAPI.login({ celular, password });
      const { token, user } = response.data;
      signIn(user, token);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión. Verifica tus datos.';
      Alert.alert('Error', msg);
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Ionicons name="leaf" size={50} color={COLORS.primary} />
            <Text style={styles.title}>Iniciar Sesión</Text>
            <Text style={styles.subtitle}>Ingresa con tu celular y contraseña</Text>
          </View>

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

            <Button
              title="Iniciar Sesión"
              onPress={handleLogin}
              loading={loading}
              size="large"
              style={{ marginTop: SPACING.md }}
            />

            <Button
              title="¿No tienes cuenta? Regístrate"
              onPress={() => navigation.navigate('RoleSelect')}
              variant="secondary"
              size="medium"
              style={{ marginTop: SPACING.md }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.medium,
  },
});
