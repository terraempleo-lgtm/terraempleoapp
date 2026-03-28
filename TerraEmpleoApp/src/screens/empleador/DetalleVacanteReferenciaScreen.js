import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI } from '../../services/api';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';

export default function DetalleVacanteReferenciaScreen({ route, navigation }) {
  const { vacante: vacanteBase } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [vacante, setVacante] = useState(vacanteBase);
  const [loading, setLoading] = useState(true);
  const [fotoActiva, setFotoActiva] = useState(0);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const res = await vacantesAPI.detalle(vacanteBase.id);
        if (!mounted) return;
        setVacante(res.data?.vacante || vacanteBase);
      } catch (_) {
        if (!mounted) return;
        setVacante(vacanteBase);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    cargar();
    return () => { mounted = false; };
  }, [vacanteBase]);

  const heroFotos = useMemo(() => {
    const fotos = (vacante?.fotos || []).map((f) => f?.url).filter(Boolean);
    if (fotos.length > 0) return fotos;
    if (vacante?.foto_portada) return [vacante.foto_portada];
    return [];
  }, [vacante]);

  const onScrollFotos = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width;
    const idx = Math.round(x / w);
    if (!Number.isNaN(idx)) setFotoActiva(idx);
  };

  const pago = getVacancyPayDisplay(vacante || {});
  const fechaInicio = formatVacancyStartDate(vacante?.fecha_inicio, { long: true, fallback: 'Por definir' });
  const ubicacion = [vacante?.municipio, vacante?.departamento].filter(Boolean).join(', ') || 'Colombia';
  const labores = (vacante?.labores || []).map((l) => l.labor || l).filter(Boolean);
  const cultivos = (vacante?.cultivos || []).map((c) => c.cultivo || c).filter(Boolean);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
        <View style={styles.heroWrap}>
          {heroFotos.length > 1 ? (
            <>
              <FlatList
                data={heroFotos}
                keyExtractor={(_, i) => String(i)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollFotos}
                renderItem={({ item }) => <Image source={{ uri: item }} style={styles.heroImg} resizeMode="cover" />}
              />
              <View style={styles.dotsWrap}>
                {heroFotos.map((_, i) => <View key={i} style={[styles.dot, i === fotoActiva && styles.dotActive]} />)}
              </View>
            </>
          ) : heroFotos.length === 1 ? (
            <Image source={{ uri: heroFotos[0] }} style={styles.heroImg} resizeMode="cover" />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="image-outline" size={44} color={COLORS.primaryLight} />
              <Text style={styles.heroPlaceholderText}>Sin fotos disponibles</Text>
            </View>
          )}

          <View style={[styles.topBar, { top: insets.top + 8 }]}> 
            <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.readOnlyBadgeTop}>
              <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
              <Text style={styles.readOnlyBadgeText}>Vista de referencia</Text>
            </View>
          </View>
        </View>

        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{vacante?.titulo}</Text>
          <Text style={[styles.finca, { color: colors.textSecondary }]}>{vacante?.nombre_empresa_finca || 'Finca'}</Text>

          {vacante?.descripcion ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Descripcion</Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>{vacante.descripcion}</Text>
            </View>
          ) : null}

          <View style={[styles.infoCard, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>{ubicacion}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>{pago.valor}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>Inicio: {fechaInicio}</Text>
            </View>
            {vacante?.duracion ? (
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                <Text style={[styles.infoText, { color: colors.textPrimary }]}>Duracion: {vacante.duracion}</Text>
              </View>
            ) : null}
          </View>

          {vacante?.requisitos ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Requisitos</Text>
              <Text style={[styles.blockText, { color: colors.textSecondary }]}>{vacante.requisitos}</Text>
            </View>
          ) : null}

          {labores.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Labores</Text>
              <View style={styles.chipsWrap}>
                {labores.map((l, i) => (
                  <View key={i} style={[styles.chipGray, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]}>
                    <Text style={[styles.chipGrayText, { color: colors.textPrimary }]}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {cultivos.length > 0 ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Cultivos</Text>
              <View style={styles.chipsWrap}>
                {cultivos.map((c, i) => (
                  <View key={i} style={styles.chipGreen}>
                    <Ionicons name="leaf" size={12} color={COLORS.primary} />
                    <Text style={styles.chipGreenText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {(vacante?.ofrece_alojamiento || vacante?.ofrece_alimentacion || vacante?.otros_beneficios) ? (
            <View style={styles.block}>
              <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>Beneficios</Text>
              {vacante?.ofrece_alojamiento ? <Text style={[styles.blockText, { color: colors.textSecondary }]}>• Alojamiento incluido</Text> : null}
              {vacante?.ofrece_alimentacion ? <Text style={[styles.blockText, { color: colors.textSecondary }]}>• Alimentacion incluida</Text> : null}
              {vacante?.otros_beneficios ? <Text style={[styles.blockText, { color: colors.textSecondary }]}>• {vacante.otros_beneficios}</Text> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { height: 300, backgroundColor: COLORS.primarySoft, position: 'relative' },
  heroImg: { width: '100%', height: 300 },
  heroPlaceholder: {
    width: '100%', height: 300,
    justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft,
  },
  heroPlaceholderText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  topBar: {
    position: 'absolute', left: SPACING.md, right: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  readOnlyBadgeTop: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  readOnlyBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  dotsWrap: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 20, backgroundColor: COLORS.white },
  content: {
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  finca: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: SPACING.md },
  infoCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  infoText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  block: { marginBottom: SPACING.md },
  blockTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  blockText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGray: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipGrayText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  chipGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipGreenText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
