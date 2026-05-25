import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable,
  ActivityIndicator, Animated, Dimensions, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI, calificacionesAPI, empleadoresAPI } from '../../services/api';
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
  const [perfilEmpleador, setPerfilEmpleador] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviandoCalificacion, setEnviandoCalificacion] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const empleadorIdParam = Number(route?.params?.empleador_id || chat_data?.otro_usuario_id);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const [vacanteRes, empleadorRes] = await Promise.allSettled([
          vacante_id ? vacantesAPI.detalle(vacante_id) : Promise.resolve(null),
          empleadorIdParam ? empleadoresAPI.perfilPublico(empleadorIdParam) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        if (vacanteRes.status === 'fulfilled' && vacanteRes.value) setVacante(vacanteRes.value.data?.vacante || null);
        if (empleadorRes.status === 'fulfilled' && empleadorRes.value) setPerfilEmpleador(empleadorRes.value.data?.empleador || null);
      } catch (_) {} finally {
        if (mounted) setLoading(false);
      }
    };
    cargar();
    return () => { mounted = false; };
  }, [vacante_id, empleadorIdParam]);

  const nombreFinca = perfilEmpleador?.nombre_empresa_finca || vacante?.nombre_empresa_finca || chat_data?.otro_nombre || 'Finca';
  const nombrePropietario = perfilEmpleador?.nombre_completo || vacante?.nombre_empleador || chat_data?.otro_nombre || 'Empleador';
  const empleadorId = Number(empleadorIdParam || vacante?.empleador_id);
  const calificacionPromedio = Number(perfilEmpleador?.calificacion_promedio || vacante?.calificacion_promedio || 0);
  const totalCalificaciones = Number(perfilEmpleador?.total_calificaciones || vacante?.total_calificaciones || 0);
  const ubicacion = [perfilEmpleador?.municipio || vacante?.municipio, perfilEmpleador?.departamento || vacante?.departamento].filter(Boolean).join(', ');

  // Fotos: primero fotos de finca del perfil, luego fotos de vacante
  const fotosFinca = perfilEmpleador?.fotos_finca?.filter(f => f.url).map(f => f.url) || [];
  const fotosVacante = vacante?.fotos?.length > 0 ? vacante.fotos.map(f => f.url) : (vacante?.foto_portada ? [vacante.foto_portada] : []);
  const fotosArray = fotosFinca.length > 0 ? fotosFinca : fotosVacante;

  const avatarFoto = perfilEmpleador?.foto_selfie || vacante?.foto_empleador || chat_data?.otro_foto;
  const acercaDe = perfilEmpleador?.acerca_de || vacante?.acerca_de;

  const tieneFotos = fotosArray.length > 0;

  const beneficios = [
    (perfilEmpleador?.ofrece_alojamiento || vacante?.ofrece_alojamiento) && 'Alojamiento incluido',
    (perfilEmpleador?.ofrece_alimentacion || vacante?.ofrece_alimentacion) && 'Alimentación incluida',
    perfilEmpleador?.beneficios_extra || vacante?.beneficios_extra,
  ].filter(Boolean);

  const enviarCalificacion = async () => {
    if (!vacante_id || !empleadorId) {
      Alert.alert('No disponible', 'No hay contexto suficiente para calificar a este empleador.');
      return;
    }
    if (estrellas < 1 || estrellas > 5) {
      Alert.alert('Calificación', 'Selecciona de 1 a 5 estrellas.');
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
      Alert.alert('¡Gracias!', 'Calificación enviada correctamente.');
      setEstrellas(0);
      setComentario('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la calificación.');
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

  const cultivosFinca = perfilEmpleador?.cultivos?.length > 0 ? perfilEmpleador.cultivos : (vacante?.cultivos || []);
  const laboresFinca = perfilEmpleador?.labores?.length > 0 ? perfilEmpleador.labores : (vacante?.labores || []);
  const tieneAlojamiento = perfilEmpleador?.ofrece_alojamiento || vacante?.ofrece_alojamiento;
  const tieneAlimentacion = perfilEmpleador?.ofrece_alimentacion || vacante?.ofrece_alimentacion;
  const otrosBeneficios = perfilEmpleador?.beneficios_extra || vacante?.beneficios_extra;
  const tipoPago = perfilEmpleador?.tipo_pago || vacante?.tipo_pago;

  const TIPO_PAGO_LABEL = { jornal: 'Jornal (diario)', quincenal: 'Quincenal', mensual: 'Mensual', destajo: 'Por destajo', a_convenir: 'A convenir' };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── HERO ── */}
        <View style={s.heroWrap}>
          {tieneFotos ? (
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScrollPhoto}
              style={{ width: SCREEN_WIDTH, height: 280 }}
            >
              {fotosArray.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={{ width: SCREEN_WIDTH, height: 280 }} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : avatarFoto ? (
            <Image source={{ uri: avatarFoto }} style={{ width: SCREEN_WIDTH, height: 280 }} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#43A047']} style={{ width: SCREEN_WIDTH, height: 280, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="leaf" size={80} color="rgba(255,255,255,0.12)" />
            </LinearGradient>
          )}

          {/* Gradiente inferior */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.heroBottomGradient} pointerEvents="none" />

          {/* Nombre finca sobre hero */}
          <View style={s.heroTitleBar} pointerEvents="none">
            <Text style={s.heroTitle} numberOfLines={1}>{nombreFinca}</Text>
            {ubicacion ? (
              <View style={s.heroSubRow}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={s.heroSub}>{ubicacion}</Text>
              </View>
            ) : null}
            {tipoPago ? (
              <View style={s.heroPagoPill}>
                <Ionicons name="cash-outline" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={s.heroPagoPillTxt}>{TIPO_PAGO_LABEL[tipoPago] || tipoPago}</Text>
              </View>
            ) : null}
          </View>

          {/* Dots paginación */}
          {fotosArray.length > 1 && (
            <View style={s.paginationWrap}>
              {fotosArray.map((_, i) => (
                <View key={i} style={[s.dot, i === activePhotoIndex ? { backgroundColor: '#fff', width: 14 } : { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
              ))}
            </View>
          )}

          {/* Top gradient + back */}
          <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={s.heroTopGradient} pointerEvents="none" />
          <AnimatedPressable style={[s.heroBackBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
            <View style={s.blurCircle}><Ionicons name="arrow-back" size={22} color="#fff" /></View>
          </AnimatedPressable>
        </View>

        {/* ── IDENTITY CARD ── */}
        <View style={[s.identityCard, { backgroundColor: colors.surface }]}>
          <View style={s.identityTop}>
            <View style={[s.avatarWrap, { borderColor: colors.surface }]}>
              {avatarFoto ? (
                <Image source={{ uri: avatarFoto }} style={s.avatar} />
              ) : (
                <LinearGradient colors={['#2E7D32', '#43A047']} style={s.avatarFallback}>
                  <Text style={s.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1, paddingLeft: 14 }}>
              <Text style={[s.nombreFinca, { color: colors.textPrimary }]} numberOfLines={1}>{nombreFinca}</Text>
              <View style={s.propietarioRow}>
                <Ionicons name="person-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={[s.nombrePropietario, { color: colors.textSecondary }]} numberOfLines={1}>{nombrePropietario}</Text>
              </View>

              {/* Rating inline */}
              <View style={s.ratingInline}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i} name={i < Math.round(calificacionPromedio) ? 'star' : 'star-outline'} size={13} color="#F59E0B" />
                ))}
                <Text style={[s.ratingVal, { color: colors.textPrimary }]}>
                  {calificacionPromedio > 0 ? calificacionPromedio.toFixed(1) : '—'}
                </Text>
                {totalCalificaciones > 0 && (
                  <Text style={[s.ratingCount, { color: colors.textMuted }]}>({totalCalificaciones})</Text>
                )}
              </View>
            </View>
          </View>

          {/* STATS GRID */}
          <View style={s.statsGrid}>
            <View style={[s.statCard, { backgroundColor: '#E8F5E9' }]}>
              <View style={[s.statCardIcon, { backgroundColor: '#2E7D32' }]}><Ionicons name="briefcase-outline" size={15} color="#fff" /></View>
              <Text style={[s.statCardNum, { color: '#2E7D32' }]}>{vacante?.activa ? '1' : '0'}</Text>
              <Text style={[s.statCardLabel, { color: '#2E7D32' }]}>Vacantes</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#E3F2FD' }]}>
              <View style={[s.statCardIcon, { backgroundColor: '#1565C0' }]}><Ionicons name="leaf-outline" size={15} color="#fff" /></View>
              <Text style={[s.statCardNum, { color: '#1565C0' }]}>{cultivosFinca.length}</Text>
              <Text style={[s.statCardLabel, { color: '#1565C0' }]}>Cultivos</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: '#FFF3E0' }]}>
              <View style={[s.statCardIcon, { backgroundColor: '#E65100' }]}><Ionicons name="gift-outline" size={15} color="#fff" /></View>
              <Text style={[s.statCardNum, { color: '#E65100' }]}>{beneficios.length}</Text>
              <Text style={[s.statCardLabel, { color: '#E65100' }]}>Beneficios</Text>
            </View>
          </View>
        </View>

        {/* ── DESCRIPCIÓN ── */}
        {acercaDe ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="document-text-outline" title="Sobre la Finca" colors={colors} />
            <Text style={[s.descTxt, { color: colors.textSecondary }]}>{acercaDe}</Text>
          </View>
        ) : null}

        {/* ── VACANTE ACTUAL ── */}
        {vacante?.titulo && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="briefcase-outline" title="Vacante Publicada" colors={colors} />
            <AnimatedPressable
              onPress={() => navigation.navigate('DetalleVacante', { vacante: { id: vacante.id, titulo: vacante.titulo } })}
              style={[s.vacanteItem, { borderColor: vacante.activa ? COLORS.primary + '40' : colors.border, backgroundColor: vacante.activa ? COLORS.primary + '08' : (isDark ? colors.background : '#F8FAFC') }]}
            >
              <LinearGradient
                colors={vacante.activa ? ['#2E7D32', '#43A047'] : ['#9E9E9E', '#757575']}
                style={s.vacanteIconGrad}
              >
                <Ionicons name="briefcase" size={14} color="#fff" />
              </LinearGradient>
              <Text style={[s.vacanteItemTitle, { color: colors.textPrimary }]} numberOfLines={1}>{vacante.titulo}</Text>
              <View style={[s.vacanteBadge, { backgroundColor: vacante.activa ? '#D1FAE5' : '#FEE2E2' }]}>
                <Text style={[s.vacanteBadgeTxt, { color: vacante.activa ? COLORS.primary : COLORS.error }]}>
                  {vacante.activa ? 'Activa' : 'Cerrada'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </AnimatedPressable>
          </View>
        )}

        {/* ── CULTIVOS Y LABORES ── */}
        {(cultivosFinca.length > 0 || laboresFinca.length > 0) && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="leaf-outline" title="Cultivos y Labores" colors={colors} />
            {cultivosFinca.length > 0 && (
              <View style={s.chipWrap}>
                {cultivosFinca.map((c, i) => (
                  <View key={i} style={s.chipGreen}>
                    <Ionicons name="leaf" size={11} color="#2E7D32" />
                    <Text style={s.chipGreenTxt}>{c.cultivo || c}</Text>
                  </View>
                ))}
              </View>
            )}
            {laboresFinca.length > 0 && (
              <View style={[s.chipWrap, { marginTop: cultivosFinca.length > 0 ? 8 : 0 }]}>
                {laboresFinca.map((l, i) => (
                  <View key={i} style={[s.chipGreen, { backgroundColor: '#FFF3E0', borderColor: '#FFE0B2' }]}>
                    <Ionicons name="construct-outline" size={11} color="#E65100" />
                    <Text style={[s.chipGreenTxt, { color: '#E65100' }]}>{l.labor || l}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── FOTOS DE FINCA ── */}
        {fotosFinca.length > 1 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="images-outline" title="Galería de la Finca" colors={colors} />
            <View style={s.galeria}>
              {fotosFinca.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={s.galeriaImg} resizeMode="cover" />
              ))}
            </View>
          </View>
        )}

        {/* ── BENEFICIOS ── */}
        {(tieneAlojamiento || tieneAlimentacion || otrosBeneficios) && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="gift-outline" title="Beneficios que Ofrece" colors={colors} />
            <View style={s.benefGrid}>
              {tieneAlojamiento && (
                <View style={[s.benefCard, { backgroundColor: '#E8F5E9' }]}>
                  <View style={[s.benefIcon, { backgroundColor: '#2E7D32' }]}><Ionicons name="home" size={18} color="#fff" /></View>
                  <Text style={[s.benefLabel, { color: '#1B5E20' }]}>Alojamiento</Text>
                  <Text style={[s.benefSub, { color: '#2E7D32' }]}>Incluido</Text>
                </View>
              )}
              {tieneAlimentacion && (
                <View style={[s.benefCard, { backgroundColor: '#E3F2FD' }]}>
                  <View style={[s.benefIcon, { backgroundColor: '#1565C0' }]}><Ionicons name="restaurant" size={18} color="#fff" /></View>
                  <Text style={[s.benefLabel, { color: '#0D47A1' }]}>Alimentación</Text>
                  <Text style={[s.benefSub, { color: '#1565C0' }]}>Incluida</Text>
                </View>
              )}
              {otrosBeneficios && (
                <View style={[s.benefCard, { backgroundColor: '#FFF3E0' }]}>
                  <View style={[s.benefIcon, { backgroundColor: '#E65100' }]}><Ionicons name="star" size={18} color="#fff" /></View>
                  <Text style={[s.benefLabel, { color: '#BF360C' }]}>Extras</Text>
                  <Text style={[s.benefSub, { color: '#E65100' }]} numberOfLines={2}>{otrosBeneficios}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── CALIFICAR ── */}
        {user?.rol === 'trabajador' && empleadorId ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="star-half-outline" title="Calificar al Empleador" colors={colors} />
            <View style={s.ratingCard}>
              <Text style={[s.ratingHint, { color: colors.textMuted }]}>
                Tu puntuación pública. El comentario es privado para revisión.
              </Text>
              <View style={s.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Pressable key={i} onPress={() => setEstrellas(i + 1)} style={{ padding: 4 }}>
                    <Ionicons name={i < estrellas ? 'star' : 'star-outline'} size={34} color={i < estrellas ? '#F59E0B' : '#D1D5DB'} />
                  </Pressable>
                ))}
              </View>
              {estrellas > 0 && (
                <Text style={[s.ratingLabel, { color: colors.textSecondary }]}>
                  {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][estrellas]}
                </Text>
              )}
            </View>
            <Input
              value={comentario}
              onChangeText={setComentario}
              placeholder="Comentario privado (opcional)..."
              multiline numberOfLines={3}
              style={{ backgroundColor: colors.background, marginTop: SPACING.md }}
            />
            <AnimatedPressable
              style={[s.btnCalificar, { backgroundColor: estrellas > 0 ? colors.primary : '#9CA3AF', opacity: enviandoCalificacion ? 0.7 : 1 }]}
              onPress={enviarCalificacion}
              disabled={enviandoCalificacion || estrellas === 0}
            >
              <Ionicons name={enviandoCalificacion ? 'hourglass-outline' : 'star'} size={18} color="#fff" />
              <Text style={s.btnCalificarText}>{enviandoCalificacion ? 'Enviando...' : 'Enviar calificación'}</Text>
            </AnimatedPressable>
          </View>
        ) : null}

      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* HERO */
  heroWrap: { width: '100%', height: 280, position: 'relative' },
  heroTopGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, zIndex: 2 },
  heroBottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 130, zIndex: 2 },
  heroTitleBar: { position: 'absolute', bottom: 18, left: SPACING.md, right: SPACING.md, zIndex: 3, gap: 4 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '500' },
  heroPagoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: 4 },
  heroPagoPillTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  heroBackBtn: { position: 'absolute', left: SPACING.md, zIndex: 10 },
  blurCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  paginationWrap: { position: 'absolute', bottom: 52, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, zIndex: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  /* IDENTITY CARD */
  identityCard: {
    marginHorizontal: SPACING.md, marginTop: -24,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    marginBottom: SPACING.md, zIndex: 10,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
    ...SHADOWS.medium,
  },
  identityTop: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { borderWidth: 3, borderRadius: 38, ...SHADOWS.small },
  avatar: { width: 68, height: 68, borderRadius: 34 },
  avatarFallback: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontSize: 22, fontWeight: '900' },
  nombreFinca: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  propietarioRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  nombrePropietario: { fontSize: 13, fontWeight: '500' },
  ratingInline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingVal: { fontSize: 13, fontWeight: '700', marginLeft: 4 },
  ratingCount: { fontSize: 12 },

  /* STATS GRID */
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: SPACING.md },
  statCard: { flex: 1, borderRadius: RADIUS.lg, padding: 10, alignItems: 'center', gap: 4 },
  statCardIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statCardNum: { fontSize: 20, fontWeight: '900' },
  statCardLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

  /* CARDS GLOBALES */
  card: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.md,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    ...SHADOWS.small,
  },
  descTxt: { fontSize: 14, lineHeight: 22 },

  /* VACANTE */
  vacanteItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1,
  },
  vacanteIconGrad: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  vacanteItemTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  vacanteBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  vacanteBadgeTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  /* CHIPS */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGreen: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#C8E6C9' },
  chipGreenTxt: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },

  /* GALERÍA */
  galeria: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galeriaImg: { width: '47.5%', aspectRatio: 1, borderRadius: RADIUS.md },

  /* BENEFICIOS */
  benefGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  benefCard: { flex: 1, minWidth: '44%', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'flex-start', gap: 6 },
  benefIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  benefLabel: { fontSize: 13, fontWeight: '800' },
  benefSub: { fontSize: 12, fontWeight: '500' },

  /* CALIFICAR */
  ratingCard: { backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 8 },
  ratingHint: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  starsRow: { flexDirection: 'row', gap: 4 },
  ratingLabel: { fontSize: 13, fontWeight: '700' },
  btnCalificar: {
    marginTop: SPACING.md, borderRadius: RADIUS.full,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 14, ...SHADOWS.button,
  },
  btnCalificarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
