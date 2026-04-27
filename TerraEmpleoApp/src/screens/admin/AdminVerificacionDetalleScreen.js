import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { AnimatedPressable } from '../../components/animated';
import { adminAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';
import { useAppTheme } from '../../context/ThemeContext';

function formatearFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return String(fecha);
  return parsed.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FotoSection({ label, uri, colors }) {
  return (
    <View style={[styles.fotoCard, { backgroundColor: colors.surface }]}>
      <View style={styles.fotoLabelRow}>
        <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
        <Text style={[styles.fotoLabel, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      {uri ? (
        <Image source={{ uri }} style={styles.fotoImg} resizeMode="cover" />
      ) : (
        <View style={[styles.fotoPlaceholder, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="image-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.fotoPlaceholderText, { color: colors.textMuted }]}>
            Foto no disponible
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AdminVerificacionDetalleScreen({ route, navigation }) {
  const { colors } = useAppTheme();
  const { item } = route.params;

  const [documentos, setDocumentos] = useState(null);
  const [validacion, setValidacion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await adminAPI.getUsuarioDocumentosIdentidad(item.id);
        if (!cancelled) {
          setDocumentos(data?.documentos || {});
          setValidacion(data?.validacion || {});
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err.response?.data?.error || 'No se pudieron cargar los documentos';
          showAlert('Error', msg);
          setDocumentos({});
          setValidacion({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item.id]);

  const handleRevision = async (estado) => {
    try {
      setProcesando(true);
      await adminAPI.revisarValidacionIdentidad(item.id, estado, null);
      navigation.goBack();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo guardar la revisión';
      Alert.alert('Error', msg);
    } finally {
      setProcesando(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const estadoValidacion = validacion?.estado || 'pendiente';
  const estadoColor =
    estadoValidacion === 'aprobada'
      ? { bg: '#DCFCE7', text: '#166534' }
      : estadoValidacion === 'rechazada'
      ? { bg: '#FEE2E2', text: '#B91C1C' }
      : { bg: '#FEF9C3', text: '#854D0E' };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header info card */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface }, SHADOWS.small]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.avatarCircle, { backgroundColor: COLORS.primary + '22' }]}>
              <Ionicons name="person-outline" size={28} color={COLORS.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.nombreText, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.nombre_completo}
              </Text>
              <Text style={[styles.cedulaText, { color: colors.textSecondary }]}>
                Cédula: {item.cedula || 'Sin dato'}
              </Text>
              <Text style={[styles.fechaText, { color: colors.textMuted }]}>
                Enviado: {formatearFecha(item.enviado_at)}
              </Text>
            </View>
            <View style={[styles.estadoChip, { backgroundColor: estadoColor.bg }]}>
              <Text style={[styles.estadoChipText, { color: estadoColor.text }]}>
                {estadoValidacion.charAt(0).toUpperCase() + estadoValidacion.slice(1)}
              </Text>
            </View>
          </View>

          {validacion?.comentario ? (
            <View style={[styles.comentarioRow, { borderTopColor: colors.border }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.comentarioText, { color: colors.textMuted }]}>
                {validacion.comentario}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Fotos de identidad */}
        <FotoSection
          label="Selfie del usuario"
          uri={documentos?.selfie}
          colors={colors}
        />
        <FotoSection
          label="Cédula (frente)"
          uri={documentos?.cedula_frente}
          colors={colors}
        />
        <FotoSection
          label="Selfie con cédula"
          uri={documentos?.selfie_con_cedula}
          colors={colors}
        />

        {/* Spacer for fixed footer */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Fixed footer: Rechazar / Aprobar */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <AnimatedPressable
          onPress={() => handleRevision('rechazada')}
          style={[styles.footerBtn, styles.rejectBtn, procesando && styles.disabledBtn]}
          scaleValue={0.97}
          disabled={procesando}
        >
          <Ionicons name="close-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.footerBtnText}>
            {procesando ? 'Guardando...' : 'Rechazar'}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => handleRevision('aprobada')}
          style={[styles.footerBtn, styles.approveBtn, procesando && styles.disabledBtn]}
          scaleValue={0.97}
          disabled={procesando}
        >
          <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
          <Text style={styles.footerBtnText}>
            {procesando ? 'Guardando...' : 'Aprobar'}
          </Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  footerSpacer: {
    height: SPACING.lg,
  },

  // Header card
  headerCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerInfo: {
    flex: 1,
  },
  nombreText: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  cedulaText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
  },
  fechaText: {
    marginTop: 2,
    fontSize: 12,
  },
  estadoChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  estadoChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  comentarioRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  comentarioText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // Photo sections
  fotoCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  fotoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  fotoLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fotoImg: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.md,
  },
  fotoPlaceholder: {
    height: 220,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fotoPlaceholderText: {
    fontSize: 13,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
  },
  rejectBtn: {
    backgroundColor: COLORS.error,
  },
  approveBtn: {
    backgroundColor: COLORS.primary,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  footerBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
