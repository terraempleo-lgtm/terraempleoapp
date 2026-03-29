import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Animated, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI, calificacionesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Input, StarRating } from '../../components/ui';
import { showAlert } from '../../utils/alertService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function AnimatedPressable({ style, onPress, disabled, children, activeOpacity = 0.85 }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]}
    >
      {children}
    </Pressable>
  );
}

function SectionHeader({ icon, title, colors }) {
  return (
    <View style={sh.headerRow}>
      <View style={[sh.iconBox, { backgroundColor: colors.primary + '1A' }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[sh.headerTitle, { color: colors.textPrimary }]}>{title}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  iconBox: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
});

export default function PerfilPublicoEmpleadorScreen({ route, navigation }) {
  const { vacante_id, chat_data } = route.params || {};
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(true);
  const [vacante, setVacante] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

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
  const empleadorId = Number(route?.params?.empleador_id || chat_data?.otro_usuario_id || vacante?.empleador_id);
  const ubicacion = [vacante?.municipio, vacante?.departamento].filter(Boolean).join(', ');
  
  const fotosArray = vacante?.fotos?.length > 0 
    ? vacante.fotos.map(f => f.url) 
    : (vacante?.foto_portada ? [vacante.foto_portada] : []);

  const avatarFoto = vacante?.foto_empleador || chat_data?.otro_foto;
  
  const tieneFotos = fotosArray.length > 0;

  const beneficios = [
    vacante?.ofrece_alojamiento && 'Alojamiento incluido',
    vacante?.ofrece_alimentacion && 'Alimentación incluida',
    vacante?.beneficios_extra,
  ].filter(Boolean);

  const enviarCalificacion = async () => {
    if (!vacante_id || !empleadorId) {
      showAlert('No disponible', 'No hay contexto suficiente para calificar a este empleador.');
      return;
    }
    if (estrellas < 1 || estrellas > 5) {
      showAlert('Calificación', 'Selecciona de 1 a 5 estrellas.');
      return;
    }

    try {
      setEnviandoCalificacion(true);
      await calificacionesAPI.calificar({
        calificado_id: empleadorId,
        vacante_id,
        estrellas,
        comentario,
      });
      showAlert('Gracias', 'Calificación enviada correctamente.');
      setEstrellas(0);
      setComentario('');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la calificación.');
    } finally {
      setEnviandoCalificacion(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const initials = (nombreFinca || 'F').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleScrollPhoto = (event) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    setActivePhotoIndex(Math.round(index));
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* HERO / FOTOS */}
        <View style={s.heroWrap}>
          {avatarFoto || tieneFotos ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScrollPhoto}
                style={{ flex: 1 }}
              >
                {fotosArray.map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={s.heroImg} resizeMode="cover" />
                ))}
              </ScrollView>
              {fotosArray.length > 1 && (
                <View style={s.paginationWrap}>
                  {fotosArray.map((_, i) => (
                    <View key={i} style={[s.dot, i === activePhotoIndex ? { backgroundColor: '#fff', width: 14 } : { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <LinearGradient
              colors={[colors.primary + 'CC', colors.primaryDark || '#1B5E20']}
              style={s.heroPlaceholder}
            >
              <Ionicons name="leaf" size={70} color="rgba(255,255,255,0.15)" />
            </LinearGradient>
          )}

          {/* Fade Superior para el botón back */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={[s.heroGradient, { paddingTop: insets.top + 8 }]}
            pointerEvents="none"
          />
          <AnimatedPressable
            style={[s.heroBackBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <View style={s.blurCircle}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </View>
          </AnimatedPressable>
        </View>

        {/* INFO PRINCIPAL */}
        <View style={[s.identityCard, { backgroundColor: colors.surface, ...SHADOWS.card }]}>
          {/* Avatar superpuesto */}
          <View style={[s.avatarWrap, { borderColor: colors.surface }]}>
            {avatarFoto || tieneFotos ? (
              <Image source={{ uri: avatarFoto || fotosArray[0] }} style={[s.avatar, { borderColor: colors.primary }]} />
            ) : (
              <View style={[s.avatarFallback, { backgroundColor: colors.primary + '18', borderColor: colors.primary }]}>
                <Text style={[s.avatarInitials, { color: colors.primary }]}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={s.identityHeader}>
            <Text style={[s.nombreFinca, { color: colors.textPrimary }]} numberOfLines={2}>
              {nombreFinca}
            </Text>
            <View style={s.propietarioRow}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={[s.nombrePropietario, { color: colors.textSecondary }]}>{nombrePropietario}</Text>
            </View>
            {ubicacion ? (
              <View style={s.metaRow}>
                <Ionicons name="location" size={14} color={COLORS.error || '#D32F2F'} />
                <Text style={[s.metaText, { color: colors.textMuted }]}>{ubicacion}</Text>
              </View>
            ) : null}
          </View>

          {/* STATS */}
          <View style={[s.statsRow, { borderColor: colors.border }]}>
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>{vacante?.activa ? '1' : '0'}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Vacante{vacante?.activa ? '' : 's'}</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>{vacante?.cultivos?.length || 0}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Cultivos</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>{beneficios.length}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Beneficios</Text>
            </View>
          </View>
        </View>

        {/* VACANTE ACTUAL */}
        {vacante?.titulo && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="briefcase-outline" title="Vacante Publicada" colors={colors} />
            <View style={[s.vacanteItem, { borderColor: colors.border, backgroundColor: isDark ? colors.background : '#F8FAFC' }]}>
              <View style={s.vacanteLeft}>
                <View style={[s.dotContainer, { backgroundColor: vacante.activa ? '#E8F5E9' : '#FFEBEE' }]}>
                  <View style={[s.dotStatus, { backgroundColor: vacante.activa ? COLORS.success : COLORS.error }]} />
                </View>
                <Text style={[s.vacanteItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {vacante.titulo}
                </Text>
              </View>
              <View style={[s.vacanteBadge, { backgroundColor: vacante.activa ? COLORS.success + '15' : COLORS.error + '15' }]}>
                <Text style={[s.vacanteBadgeTxt, { color: vacante.activa ? COLORS.success : COLORS.error }]}>
                  {vacante.activa ? 'Activa' : 'Cerrada'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* CULTIVOS */}
        {vacante?.cultivos?.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="leaf-outline" title="Cultivos de la Finca" colors={colors} />
            <View style={s.chipWrap}>
              {vacante.cultivos.map((c, i) => (
                <View key={i} style={[s.chip, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[s.chipTxt, { color: colors.primaryDark || colors.primary }]}>{c.cultivo}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* BENEFICIOS */}
        {beneficios.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="gift-outline" title="Beneficios que Ofrece" colors={colors} />
            <View style={s.listWrap}>
              {beneficios.map((b, i) => (
                <View key={i} style={s.listItemRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  <Text style={[s.listItemTxt, { color: colors.textSecondary }]}>{b}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CALIFICAR EMPLEADOR (Si el trabajador aplica a vacante) */}
        {user?.rol === 'trabajador' && vacante?.estado === 'cerrada' ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="star-half-outline" title="Calificar Empleador" colors={colors} />
            <Text style={[s.helpText, { color: colors.textSecondary }]}>
              Ayuda a otros trabajadores compartiendo cómo fue trabajar con {nombrePropietario}.
            </Text>
            <View style={{ marginVertical: SPACING.md }}>
              <StarRating rating={estrellas} onChange={setEstrellas} size={36} />
            </View>
            <Input
              value={comentario}
              onChangeText={setComentario}
              placeholder="Describe tu experiencia (opcional)..."
              multiline
              numberOfLines={3}
              style={{ backgroundColor: colors.background }}
            />
            <AnimatedPressable
              style={[s.btnCalificar, { backgroundColor: colors.primary, opacity: enviandoCalificacion ? 0.7 : 1 }]}
              onPress={enviarCalificacion}
              disabled={enviandoCalificacion}
            >
              <Ionicons name={enviandoCalificacion ? 'hourglass-outline' : 'star'} size={18} color="#fff" />
              <Text style={s.btnCalificarText}>
                {enviandoCalificacion ? 'Enviando...' : 'Enviar calificación'}
              </Text>
            </AnimatedPressable>
          </View>
        ) : null}

        {/* VolVER */}
        <View style={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, marginTop: SPACING.md }}>
          <AnimatedPressable
            style={[s.btnVolver, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.btnVolverText, { color: colors.textSecondary }]}>Volver al chat</Text>
          </AnimatedPressable>
        </View>

      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* HERO */
  heroWrap: { width: '100%', height: 260, position: 'relative', backgroundColor: '#e2e8f0' },
  heroImg: { width: SCREEN_WIDTH, height: 260 },
  heroPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  heroBackBtn: { position: 'absolute', left: SPACING.md, zIndex: 10 },
  blurCircle: {
    width: 40, height: 40, borderRadius: 20, 
    backgroundColor: 'rgba(0,0,0,0.3)', 
    justifyContent: 'center', alignItems: 'center'
  },
  paginationWrap: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  /* INFO PRINCIPAL */
  identityCard: {
    marginHorizontal: SPACING.lg,
    marginTop: -20,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingTop: 45, // espacio para el avatar
    marginBottom: SPACING.lg,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  avatarWrap: {
    position: 'absolute', top: -36, left: SPACING.lg,
    borderWidth: 4, borderRadius: 40,
    ...SHADOWS.small,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: { fontSize: 24, fontWeight: '800' },
  identityHeader: { gap: 6 },
  nombreFinca: { fontSize: 24, fontWeight: '800', lineHeight: 28, letterSpacing: -0.5 },
  propietarioRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nombrePropietario: { fontSize: 16, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 14, fontWeight: '500' },

  /* ESTADÍSTICAS */
  statsRow: {
    flexDirection: 'row', borderTopWidth: 1.5,
    marginTop: SPACING.lg, paddingTop: SPACING.md,
    justifyContent: 'space-around'
  },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, marginVertical: 6, opacity: 0.6 },

  /* CARDS GLOBALES */
  card: {
    marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl, padding: SPACING.lg,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
    ...SHADOWS.small,
  },
  
  /* VACANTES */
  vacanteItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1,
  },
  vacanteLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  dotContainer: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dotStatus: { width: 8, height: 8, borderRadius: 4, margin: 0 },
  vacanteItemTitle: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  vacanteBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.full },
  vacanteBadgeTxt: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },

  /* CULTIVOS CHIPS */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  chipTxt: { fontSize: 14, fontWeight: '700' },

  /* LISTAS GENÉRICAS */
  listWrap: { gap: 12 },
  listItemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listItemTxt: { fontSize: 15, fontWeight: '500' },

  /* EXTRAS */
  helpText: { fontSize: 14, lineHeight: 20 },
  btnCalificar: {
    marginTop: SPACING.md, borderRadius: RADIUS.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 14, ...SHADOWS.button,
  },
  btnCalificarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnVolver: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: RADIUS.full, paddingVertical: 14, gap: 8,
    ...SHADOWS.small
  },
  btnVolverText: { fontSize: 16, fontWeight: '600' },
});
