import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../../theme';

type OverlayTipo = 'cedula' | 'selfie' | 'selfie_con_cedula';

interface CameraOverlayProps {
  tipo: OverlayTipo;
}

const TITULOS: Record<OverlayTipo, string> = {
  cedula: 'Alinea el frente de la cédula dentro del recuadro',
  selfie: 'Ubica tu rostro al centro',
  selfie_con_cedula: 'Muestra tu rostro y la cédula juntos',
};

export default function CameraOverlay({ tipo }: CameraOverlayProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.recuadro}>
        <View style={styles.esquinaSuperiorIzquierda} />
        <View style={styles.esquinaSuperiorDerecha} />
        <View style={styles.esquinaInferiorIzquierda} />
        <View style={styles.esquinaInferiorDerecha} />
      </View>
      <Text style={styles.texto}>{TITULOS[tipo]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  recuadro: {
    width: 250,
    height: 160,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.primary,
    position: 'relative',
    backgroundColor: COLORS.primarySoft,
  },
  texto: {
    marginTop: SPACING.sm,
    color: COLORS.textLight,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  esquinaSuperiorIzquierda: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  esquinaSuperiorDerecha: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
  esquinaInferiorIzquierda: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: COLORS.primary,
  },
  esquinaInferiorDerecha: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 22,
    height: 22,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: COLORS.primary,
  },
});
