import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import CamaraFoto from '../../../components/CamaraFoto';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';
import { CameraOverlay, CaptureInstructions } from '../components';
import { useVerificationFlowContext } from '../hooks';
import type { VerificationStackParamList } from '../types';
import { showAlert } from '../../../utils/alertService';

type Props = StackScreenProps<VerificationStackParamList, 'SelfieWithIdCapture'>;

export default function SelfieWithIdCaptureScreen({ navigation }: Props) {
  const {
    estado,
    cargando,
    capturarSelfieConCedula,
    validarPasoActual,
    avanzarPaso,
    retrocederPaso,
  } = useVerificationFlowContext();

  const onContinuar = async () => {
    const resultado = await validarPasoActual();
    if (!resultado?.aprobado) {
      const mensaje = resultado?.errores?.[0]?.mensajeUsuario || 'Debe verse tu rostro y la cédula. Intenta de nuevo.';
      showAlert('Repite la foto', mensaje);
      return;
    }

    avanzarPaso();
    navigation.navigate('VerificationReview');
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
          titulo="Paso 3 de 3: Selfie con cédula"
          subtitulo="Sostén la cédula junto a tu rostro. Esta validación es solo interna."
          pasos={[
            'Debe verse tu cara completa.',
            'La cédula debe verse en la misma foto.',
            'Evita que tus dedos tapen el documento.',
          ]}
        />

        <CameraOverlay tipo="selfie_con_cedula" />

        <CamaraFoto
          tipo="selfie_cedula"
          label="Tomar selfie con cédula"
          modoLocal
          permitirGaleria
          onFotoGuardada={(_tipo: string, uri: string) => capturarSelfieConCedula(uri)}
        />

        <View style={styles.resumenCard}>
          <Text style={styles.resumenTitulo}>Estado actual</Text>
          <Text style={styles.resumenTexto}>
            {estado.documentos.selfieConCedula.estado === 'valido'
              ? 'Foto valida. Ya puedes revisar y enviar.'
              : estado.documentos.selfieConCedula.estado === 'rechazado'
                ? 'No se ve rostro + documento con claridad. Debes repetirla.'
                : 'Toma la foto y valida para ir a revisión.'}
          </Text>
        </View>

        <View style={styles.botonesRow}>
          <Pressable style={styles.botonSecundario} onPress={onRegresar}>
            <Text style={styles.botonSecundarioTexto}>Volver</Text>
          </Pressable>
          <Pressable style={[styles.boton, cargando && styles.botonDeshabilitado]} onPress={onContinuar} disabled={cargando}>
            <Text style={styles.botonTexto}>{cargando ? 'Validando...' : 'Validar y revisar'}</Text>
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
