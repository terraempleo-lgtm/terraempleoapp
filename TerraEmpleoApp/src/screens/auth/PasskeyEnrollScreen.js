import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../theme';
import { Button } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { passkeyAPI } from '../../services/api';
import {
  createPasskey,
  savePasskeyCelular,
  markPasskeyPrompted,
} from '../../services/passkeyService';

export default function PasskeyEnrollScreen({ navigation, route }) {
  const { user, token, cognitoAccessToken, fromPerfil } = route.params;
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnroll = async () => {
    setError('');
    setLoading(true);
    try {
      // 1. Pedir challenge a Cognito a través del backend
      const startRes = await passkeyAPI.registerStart(cognitoAccessToken);
      const { credentialCreationOptions } = startRes.data;

      // 2. Invocar Face ID / huella / Credential Manager
      const credential = await createPasskey(credentialCreationOptions);

      // 3. Completar registro en Cognito
      await passkeyAPI.registerFinish(cognitoAccessToken, credential);

      // 4. Guardar celular localmente para el login con passkey
      await savePasskeyCelular(user.celular);
      await markPasskeyPrompted();

      // 5. Si venimos de Perfil, solo volver; si no, hacer signIn
      if (fromPerfil) {
        navigation.goBack();
      } else {
        await signIn(user, token);
      }
    } catch (err) {
      if (err.message?.includes('cancelled') || err.message?.includes('cancel')) {
        // El usuario canceló el diálogo nativo — tratar como "ahora no"
        await handleSkip();
        return;
      }
      const msg = err.response?.data?.error || err.message || 'No se pudo registrar la passkey.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await markPasskeyPrompted();
    if (fromPerfil) {
      navigation.goBack();
    } else {
      await signIn(user, token);
    }
  };

  const biometricLabel = Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Huella / Face ID';
  const biometricIcon = Platform.OS === 'ios' ? 'scan-outline' : 'finger-print-outline';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={biometricIcon} size={64} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Activa tu acceso rápido</Text>
        <Text style={styles.subtitle}>
          Inicia sesión la próxima vez con {biometricLabel} sin necesidad de contraseña.
        </Text>

        <View style={styles.benefitsList}>
          {[
            { icon: 'flash-outline',        text: 'Acceso en un segundo' },
            { icon: 'shield-checkmark-outline', text: 'Más seguro que una contraseña' },
            { icon: 'lock-closed-outline',  text: 'Tu biométrico nunca sale del dispositivo' },
          ].map((item) => (
            <View key={item.icon} style={styles.benefitRow}>
              <Ionicons name={item.icon} size={20} color={COLORS.primary} />
              <Text style={styles.benefitText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          title={`Activar ${biometricLabel}`}
          onPress={handleEnroll}
          loading={loading}
          size="large"
          style={styles.primaryBtn}
        />

        <Button
          title="Ahora no"
          onPress={handleSkip}
          variant="outline"
          size="large"
          disabled={loading}
          style={styles.skipBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0d0d0d',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  benefitsList: {
    width: '100%',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FAF4',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  benefitText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    width: '100%',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    marginBottom: SPACING.sm,
  },
  skipBtn: {
    width: '100%',
  },
});
