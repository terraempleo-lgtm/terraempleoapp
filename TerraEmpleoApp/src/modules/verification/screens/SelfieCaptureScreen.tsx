import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import CamaraFoto from '../../../components/CamaraFoto';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';
import { CameraOverlay, CaptureInstructions } from '../components';
import { useVerificationFlowContext } from '../hooks';
import type { VerificationStackParamList } from '../types';

type Props = StackScreenProps<VerificationStackParamList, 'SelfieCapture'>;

export default function SelfieCaptureScreen({ navigation }: Props) {
  const { estado, cargando, capturarSelfie, validarPasoActual, avanzarPaso, retrocederPaso } = useVerificationFlowContext();

  const onContinuar = async () => {
    const resultado = await validarPasoActual();
    if (!resultado?.aprobado) {
      const mensaje = resultado?.errores?.[0]?.mensajeUsuario || 'No encontramos un rostro claro. Intenta de nuevo.';
      Alert.alert('Repite la selfie', mensaje);
      return;
    }

    avanzarPaso();
    navigation.navigate('SelfieWithIdCapture');
  };

  const onRegresar = () => {
    retrocederPaso();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <CaptureInstructions
          titulo="Paso 2 de 3: Tu selfie"
          subtitulo="Necesitamos ver tu rostro con claridad para la validación interna de identidad."
          pasos={[
            'Debe salir solo tu rostro.',
            'Mira de frente a la cámara.',
            'Evita contraluz o zonas oscuras.',
          ]}
        />

        <CameraOverlay tipo="selfie" />

        <CamaraFoto
          tipo="selfie"
          label="Tomar selfie"
          modoLocal
          permitirGaleria
          onFotoGuardada={(_tipo: string, uri: string) => capturarSelfie(uri)}
        />

        <View style={styles.resumenCard}>
          <Text style={styles.resumenTitulo}>Estado actual</Text>
          <Text style={styles.resumenTexto}>
            {estado.documentos.selfie.estado === 'valido'
              ? 'Selfie valida. Puedes continuar.'
              : estado.documentos.selfie.estado === 'rechazado'
                ? 'No se detecto un rostro claro. Debes repetirla.'
                : 'Toma la selfie y luego valida para continuar.'}
          </Text>
        </View>

        <View style={styles.botonesRow}>
          <Pressable style={styles.botonSecundario} onPress={onRegresar}>
            <Text style={styles.botonSecundarioTexto}>Volver</Text>
          </Pressable>
          <Pressable style={[styles.boton, cargando && styles.botonDeshabilitado]} onPress={onContinuar} disabled={cargando}>
            <Text style={styles.botonTexto}>{cargando ? 'Validando...' : 'Validar y continuar'}</Text>
          </Pressable>
        </View>
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
  botonesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  botonSecundario: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  botonSecundarioTexto: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  boton: {
    flex: 1.4,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
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
