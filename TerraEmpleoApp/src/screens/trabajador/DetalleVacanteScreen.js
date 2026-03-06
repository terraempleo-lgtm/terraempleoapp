import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, Dimensions, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 300;

function getSalaryDisplay(vacante) {
  const tp = (vacante.tipo_pago || '').toLowerCase();
  if (tp.includes('jornal') && vacante.valor_jornal) {
    const n = Number(vacante.valor_jornal);
    return { label: 'Pago por jornal', value: `$${n.toLocaleString('es-CO')} /día` };
  }
  if (vacante.salario_min && vacante.salario_max) {
    const fmt = (n) => Number(n) >= 1_000_000
      ? `$${(Number(n) / 1_000_000).toFixed(1)}M`
      : `$${Number(n).toLocaleString('es-CO')}`;
    return { label: 'Sueldo mensual', value: `${fmt(vacante.salario_min)} - ${fmt(vacante.salario_max)}` };
  }
  if (vacante.salario_min) {
    const n = Number(vacante.salario_min);
    return { label: 'Sueldo mensual', value: n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${n.toLocaleString('es-CO')}` };
  }
  return { label: 'Salario', value: 'A convenir' };
}

function getTipoContrato(vacante) {
  const tp = (vacante.tipo_pago || '').toLowerCase();
  if (tp.includes('mensual')) return 'Contrato fijo';
  if (tp.includes('jornal')) return 'Por jornal';
  if (tp.includes('destajo')) return 'Por destajo';
  return vacante.tipo_pago || null;
}

export default function DetalleVacanteScreen({ route, navigation }) {
  const { vacante } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [postulado, setPostulado] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    const cargarDetalle = async () => {
      try {
        const [detalleRes, postulacionesRes] = await Promise.all([
          vacantesAPI.detalle(vacante.id),
          user?.rol === 'trabajador'
            ? vacantesAPI.misPostulaciones()
            : Promise.resolve({ data: { postulaciones: [] } }),
        ]);
        setFotos(detalleRes.data.vacante?.fotos || []);
        const yaPostulado = (postulacionesRes.data.postulaciones || []).some(
          (p) => Number(p.vacante_id) === Number(vacante.id)
        );
        setPostulado(yaPostulado);
      } catch (err) {
        console.error('Error cargando detalle:', err);
      }
    };
    cargarDetalle();
  }, [vacante.id, user?.rol]);

  const handlePostularse = async () => {
    setLoading(true);
    try {
      await vacantesAPI.postularse({ vacante_id: vacante.id });
      setPostulado(true);
      Alert.alert('¡Listo!', 'Te has postulado exitosamente.');
    } catch (err) {
      if (err.response?.status === 409) {
        setPostulado(true);
        Alert.alert('Aviso', 'Ya estás postulado a esta vacante');
        return;
      }
      Alert.alert('Error', err.response?.data?.error || 'Error al postularse');
    } finally {
      setLoading(false);
    }
  };

  const onScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const salary = getSalaryDisplay(vacante);
  const tipoContrato = getTipoContrato(vacante);

  // Beneficios disponibles
  const beneficios = [
    vacante.ofrece_alojamiento && { icon: 'home', label: 'VIVIENDA' },
    vacante.ofrece_alimentacion && { icon: 'restaurant', label: 'COMIDA' },
  ].filter(Boolean);

  // Labores como requisitos
  const requisitos = (vacante.labores || []).map(l => l.labor || l);

  // Imagen hero
  const heroFotos = fotos.length > 0
    ? fotos
    : vacante.foto_portada
      ? [{ url: vacante.foto_portada, id: 'portada' }]
      : [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroWrap}>
          {heroFotos.length > 0 ? (
            <>
              <FlatList
                ref={flatListRef}
                data={heroFotos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={(item, i) => item.id?.toString() || i.toString()}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item.url }}
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                )}
              />
              {heroFotos.length > 1 && (
                <View style={styles.dotsWrap}>
                  {heroFotos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="leaf" size={60} color="rgba(255,255,255,0.5)" />
            </View>
          )}

          {/* Botones sobre la imagen */}
          <View style={[styles.heroButtons, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.heroBtnRight}>
              <TouchableOpacity style={styles.heroBtn}>
                <Ionicons name="share-social-outline" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroBtn} onPress={() => setLiked(l => !l)}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={liked ? '#E53935' : COLORS.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Tarjeta de contenido (superpone la imagen) */}
        <View style={styles.contentCard}>
          {/* Empresa */}
          <View style={styles.companyRow}>
            <View style={styles.companyIcon}>
              <Ionicons name="leaf" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.companyName}>
                {(vacante.nombre_empresa_finca || 'Empleador').toUpperCase()}
              </Text>
              <View style={styles.verifiedRow}>
                <Ionicons name="checkmark-circle" size={13} color="#1976D2" />
                <Text style={styles.verifiedText}>Empresa Verificada</Text>
              </View>
            </View>
          </View>

          {/* Título */}
          <Text style={styles.title}>{vacante.titulo}</Text>

          {/* Urgente + rating + ubicación */}
          <View style={styles.metaRow}>
            {vacante.urgente && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Ionicons name="star" size={13} color="#FFB300" />
              <Text style={styles.metaText}>4.5</Text>
            </View>
            <View style={styles.metaSeparator} />
            <View style={styles.metaItem}>
              <Ionicons name="location" size={13} color={COLORS.primary} />
              <Text style={styles.metaText}>{vacante.departamento || 'Colombia'}</Text>
            </View>
          </View>

          {/* Beneficios */}
          {beneficios.length > 0 && (
            <View style={styles.benefitsRow}>
              {beneficios.map((b, i) => (
                <View key={i} style={styles.benefitItem}>
                  <View style={styles.benefitIconWrap}>
                    <Ionicons name={b.icon} size={22} color={COLORS.primary} />
                  </View>
                  <Text style={styles.benefitLabel}>{b.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Cultivos como chips */}
          {(vacante.cultivos || []).length > 0 && (
            <View style={styles.chipsRow}>
              {vacante.cultivos.map((c, i) => (
                <View key={i} style={styles.chipGreen}>
                  <Ionicons name="leaf" size={11} color={COLORS.primary} />
                  <Text style={styles.chipGreenText}>{c.cultivo || c}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Descripción */}
          {vacante.descripcion && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción</Text>
              <Text style={styles.description}>{vacante.descripcion}</Text>
            </View>
          )}

          {/* Requisitos */}
          {requisitos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Requisitos</Text>
              {requisitos.map((r, i) => (
                <View key={i} style={styles.reqRow}>
                  <View style={styles.reqCheck}>
                    <Ionicons name="checkmark" size={13} color={COLORS.primary} />
                  </View>
                  <Text style={styles.reqText}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ubicación */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ubicación</Text>
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map" size={40} color={COLORS.primaryLight} />
              <View style={styles.mapPin}>
                <Ionicons name="location" size={18} color={COLORS.white} />
              </View>
              <Text style={styles.mapPinLabel}>
                {vacante.nombre_empresa_finca || 'Finca'}
              </Text>
            </View>
            <Text style={styles.locationText}>
              {[vacante.municipio, vacante.departamento].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer sticky */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerLabel}>{salary.label}</Text>
          <Text style={styles.footerSalary}>{salary.value}</Text>
        </View>
        {tipoContrato && (
          <View style={styles.contratoBadge}>
            <Text style={styles.contratoText}>{tipoContrato}</Text>
          </View>
        )}
        {user?.rol === 'trabajador' && (
          <TouchableOpacity
            style={[styles.postBtn, postulado && styles.postBtnDone]}
            onPress={!postulado ? handlePostularse : undefined}
            disabled={loading || postulado}
            activeOpacity={0.85}
          >
            <Text style={styles.postBtnText}>
              {loading ? 'Enviando...' : postulado ? 'Postulado ✓' : 'Postularme  →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F4' },

  /* Hero */
  heroWrap: { width: SCREEN_WIDTH, height: HERO_HEIGHT, backgroundColor: COLORS.primarySoft },
  heroImage: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  heroPlaceholder: {
    width: SCREEN_WIDTH, height: HERO_HEIGHT,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center',
  },
  heroButtons: {
    position: 'absolute', left: SPACING.md, right: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroBtnRight: { flexDirection: 'row', gap: SPACING.sm },
  heroBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.small,
  },
  dotsWrap: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 18 },

  /* Content card */
  contentCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    padding: SPACING.lg,
    minHeight: 400,
  },

  /* Empresa */
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  companyIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  companyName: { fontSize: 13, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  verifiedText: { fontSize: 12, color: '#1976D2' },

  /* Título */
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  /* Meta row */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap' },
  urgentBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  urgentText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  metaSeparator: { width: 1, height: 12, backgroundColor: COLORS.border, marginHorizontal: 2 },

  /* Beneficios */
  benefitsRow: {
    flexDirection: 'row', gap: SPACING.md,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.borderLight,
  },
  benefitItem: { alignItems: 'center', gap: 6 },
  benefitIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  benefitLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 0.3 },

  /* Chips */
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  chipGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  chipGreenText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  /* Secciones */
  section: { marginTop: SPACING.lg },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  description: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 24 },

  /* Requisitos */
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: 10 },
  reqCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 1,
  },
  reqText: { fontSize: 14, color: COLORS.textSecondary, flex: 1, lineHeight: 22 },

  /* Mapa placeholder */
  mapPlaceholder: {
    height: 140, borderRadius: RADIUS.lg,
    backgroundColor: '#C8DFC8',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm, overflow: 'hidden',
  },
  mapPin: {
    position: 'absolute',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  mapPinLabel: {
    position: 'absolute', bottom: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
    fontSize: 13, fontWeight: '600', color: COLORS.textPrimary,
  },
  locationText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1, borderColor: COLORS.borderLight,
    ...SHADOWS.large,
    gap: SPACING.sm,
  },
  footerLeft: { flex: 1 },
  footerLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  footerSalary: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  contratoBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  contratoText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  postBtnDone: { backgroundColor: '#80c9a0' },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
