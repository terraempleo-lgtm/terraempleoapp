import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import CamaraFoto from '../../../components/CamaraFoto';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';
import { CameraOverlay, CaptureInstructions } from '../components';
import { useVerificationFlowContext } from '../hooks';
import type { VerificationStackParamList } from '../types';

type Props = StackScreenProps<VerificationStackParamList, 'IdFrontCapture'>;

export default function IdFrontCaptureScreen({ navigation }: Props) {
  const { estado, cargando, capturarCedulaFrente, validarPasoActual, avanzarPaso } = useVerificationFlowContext();

  const onContinuar = async () => {
    const resultado = await validarPasoActual();
    if (!resultado?.aprobado) {
      const mensaje = resultado?.errores?.[0]?.mensajeUsuario || 'No parece una cédula. Intenta de nuevo.';
      Alert.alert('Repite la foto', mensaje);
      return;
    }

    avanzarPaso();
    navigation.navigate('SelfieCapture');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CaptureInstructions
          titulo="Paso 1 de 3: Frente de la cédula"
          subtitulo="Esta es una validación interna de identidad. No es una verificación oficial del gobierno."
          pasos={[
            'Pon la cédula sobre una superficie plana.',
            'Evita sombras y reflejos.',
            'Asegúrate de que se vea completa y legible.',
          ]}
        />

        <CameraOverlay tipo="cedula" />

        <CamaraFoto
          tipo="cedula"
          label="Tomar foto de la cédula"
          modoLocal
          permitirGaleria
          onFotoGuardada={(_tipo: string, uri: string) => capturarCedulaFrente(uri)}
        />

        <View style={styles.resumenCard}>
          <Text style={styles.resumenTitulo}>Estado actual</Text>
          <Text style={styles.resumenTexto}>
            {estado.documentos.cedulaFrente.estado === 'valido'
              ? 'Foto valida. Puedes continuar.'
              : estado.documentos.cedulaFrente.estado === 'rechazado'
                ? 'La foto no cumple. Debes repetirla.'
                : 'Toma la foto y luego valida para continuar.'}
          </Text>
        </View>

        <Pressable style={[styles.boton, cargando && styles.botonDeshabilitado]} onPress={onContinuar} disabled={cargando}>
          <Text style={styles.botonTexto}>{cargando ? 'Validando...' : 'Validar y continuar'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  resumenCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    ...SHADOWS.small,
  },
  resumenTitulo: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  resumenTexto: {
    color: COLORS.textLight,
  },
  boton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOWS.button,
  },
  botonDeshabilitado: {
    opacity: 0.7,
  },
  botonTexto: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
