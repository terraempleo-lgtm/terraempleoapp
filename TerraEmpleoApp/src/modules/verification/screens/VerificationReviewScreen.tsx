import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../theme';
import { VerificationStatusCard } from '../components';
import { useVerificationFlowContext } from '../hooks';
import type { VerificationStackParamList } from '../types';
import { showAlert } from '../../../utils/alertService';

type Props = StackScreenProps<VerificationStackParamList, 'VerificationReview'>;

function estadoCard(estado: string): 'pendiente' | 'valido' | 'rechazado' {
  if (estado === 'valido') return 'valido';
  if (estado === 'rechazado') return 'rechazado';
  return 'pendiente';
}

export default function VerificationReviewScreen({ navigation }: Props) {
  const { estado, cargando, enviarParaRevision, retrocederPaso } = useVerificationFlowContext();

  const onEnviar = async () => {
    const response = await enviarParaRevision();
    if (!response.ok) {
      showAlert('No se pudo enviar', response.mensaje);
      return;
    }

    showAlert('Listo', 'Documentos enviados para revision');
    navigation.popToTop();
  };

  const onVolver = () => {
    retrocederPaso();
    navigation.navigate('SelfieWithIdCapture');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <Text style={styles.titulo}>Revisión final</Text>
          <Text style={styles.subtitulo}>
            Revisa cada paso antes de enviar. Esta validación es interna para seguridad de TerraEmpleo.
          </Text>
        </View>

        <VerificationStatusCard
          titulo="1. Frente de la cédula"
          descripcion="Debe verse el documento completo y legible."
          estado={estadoCard(estado.documentos.cedulaFrente.estado)}
          mensajeError={estado.documentos.cedulaFrente.resultado?.errores?.[0]?.mensajeUsuario}
        />

        <VerificationStatusCard
          titulo="2. Selfie"
          descripcion="Debe detectarse exactamente un rostro claro."
          estado={estadoCard(estado.documentos.selfie.estado)}
          mensajeError={estado.documentos.selfie.resultado?.errores?.[0]?.mensajeUsuario}
        />

        <VerificationStatusCard
          titulo="3. Selfie con cédula"
          descripcion="Debe verse tu rostro y la cédula en la misma foto."
          estado={estadoCard(estado.documentos.selfieConCedula.estado)}
          mensajeError={estado.documentos.selfieConCedula.resultado?.errores?.[0]?.mensajeUsuario}
        />

        <View style={styles.botonesRow}>
          <Pressable style={styles.botonSecundario} onPress={onVolver}>
            <Text style={styles.botonSecundarioTexto}>Corregir fotos</Text>
          </Pressable>
          <Pressable style={[styles.boton, cargando && styles.botonDeshabilitado]} onPress={onEnviar} disabled={cargando}>
            <Text style={styles.botonTexto}>{cargando ? 'Enviando...' : 'Enviar documentos'}</Text>
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
  headerCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  titulo: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  subtitulo: {
    color: COLORS.textLight,
    lineHeight: 21,
  },
  botonesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
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
