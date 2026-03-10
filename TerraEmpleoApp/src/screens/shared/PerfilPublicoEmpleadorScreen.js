import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';

export default function PerfilPublicoEmpleadorScreen({ route, navigation }) {
  const { vacante_id, chat_data } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [vacante, setVacante] = useState(null);

  useEffect(() => {
    let mounted = true;

    const cargar = async () => {
      if (!vacante_id) {
        setLoading(false);
        return;
      }
      try {
        const res = await vacantesAPI.detalle(vacante_id);
        if (!mounted) return;
        setVacante(res.data?.vacante || null);
      } catch (_) {
        if (!mounted) return;
        setVacante(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    cargar();
    return () => { mounted = false; };
  }, [vacante_id]);

  const nombreFinca = vacante?.nombre_empresa_finca || chat_data?.otro_nombre || 'Finca';
  const nombrePropietario = vacante?.nombre_empleador || chat_data?.otro_nombre || 'Empleador';
  const ubicacion = [vacante?.municipio, vacante?.departamento].filter(Boolean).join(', ');
  const fotoFinca = vacante?.foto_portada || null;

  const beneficios = [
    vacante?.ofrece_alojamiento && 'Alojamiento incluido',
    vacante?.ofrece_alimentacion && 'Alimentacion incluida',
    vacante?.beneficios_extra,
  ].filter(Boolean);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
        <View style={styles.heroWrap}>
          {fotoFinca ? (
            <Image source={{ uri: fotoFinca }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="leaf" size={44} color={COLORS.primaryLight} />
              <Text style={styles.heroPlaceholderText}>Sin foto de finca</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.titulo}>{nombreFinca}</Text>
          <Text style={styles.subtitulo}>{nombrePropietario}</Text>
          {ubicacion ? (
            <View style={styles.rowMeta}>
              <Ionicons name="location-outline" size={16} color={COLORS.primary} />
              <Text style={styles.metaText}>{ubicacion}</Text>
            </View>
          ) : null}

          {vacante?.descripcion ? (
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Descripcion</Text>
              <Text style={styles.seccionTexto}>{vacante.descripcion}</Text>
            </View>
          ) : null}

          {beneficios.length > 0 ? (
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Beneficios</Text>
              {beneficios.map((b, idx) => (
                <View key={idx} style={styles.itemBeneficio}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.beneficioText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity style={styles.btnVolver} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.btnVolverText}>Volver al chat</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  heroWrap: {
    width: '100%',
    height: 230,
    backgroundColor: COLORS.primarySoft,
  },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroPlaceholderText: { fontSize: 13, color: COLORS.textSecondary },
  card: {
    marginTop: -20,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  titulo: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitulo: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  metaText: { fontSize: 13, color: COLORS.textSecondary },
  seccion: { marginTop: SPACING.lg },
  seccionTitulo: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm },
  seccionTexto: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  itemBeneficio: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  beneficioText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  btnVolver: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    paddingVertical: 14,
  },
  btnVolverText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
