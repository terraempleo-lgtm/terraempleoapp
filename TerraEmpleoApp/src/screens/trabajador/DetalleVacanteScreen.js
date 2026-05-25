import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Modal,
  Image, Dimensions, FlatList, ActivityIndicator,
  Platform, TextInput, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, TouchableOpacity, Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withSequence,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI, empleadoresAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedPressable, StaggeredItem } from '../../components/animated';
import { showAlert } from '../../utils/alertService';
import { encolarPostulacion } from '../../utils/postulacionesQueue';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 320;

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function DetalleVacanteScreen({ route, navigation }) {
  const { vacante: vacanteParam } = route.params;
  const { user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [postulado, setPostulado] = useState(false);
  const [fotos, setFotos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [vacanteDetalle, setVacanteDetalle] = useState(null);
  const [perfilEmpleador, setPerfilEmpleador] = useState(null);
  // Usar datos completos del API cuando estén disponibles, sino el objeto parcial del param
  const vacante = vacanteDetalle || vacanteParam;
  const flatListRef = useRef(null);

  // Modal de postulación
  const [showPostModal, setShowPostModal] = useState(false);
  const [mensajePost, setMensajePost] = useState('');
  const [postExitosa, setPostExitosa] = useState(false);

  // Parallax
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Heart animation
  const heartScale = useSharedValue(1);
  const heartAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  useEffect(() => {
    const cargarDetalle = async () => {
      try {
        const [detalleRes, postulacionesRes] = await Promise.all([
          vacantesAPI.detalle(vacanteParam.id),
          (user?.rol === 'trabajador' || user?.rol === 'especialista')
            ? vacantesAPI.misPostulaciones()
            : Promise.resolve({ data: { postulaciones: [] } }),
        ]);
        const detalle = detalleRes.data.vacante;
        if (detalle) setVacanteDetalle(detalle);
        setFotos(detalle?.fotos || []);
        if (detalle?.empleador_id) {
          try {
            const empRes = await empleadoresAPI.perfilPublico(detalle.empleador_id);
            if (empRes.data?.empleador) setPerfilEmpleador(empRes.data.empleador);
          } catch (_) {}
        }
        const yaPostulado = (postulacionesRes.data.postulaciones || []).some(
          (p) => Number(p.vacante_id) === Number(vacanteParam.id)
        );
        setPostulado(yaPostulado);
      } catch (err) {
        console.error('Error cargando detalle:', err);
      }
    };
    cargarDetalle();
  }, [vacanteParam.id, user?.rol]);

  const handlePostularse = async () => {
    if (!isOnline) {
      await encolarPostulacion(vacante.id, mensajePost || null);
      setPostulado(true);
      setPostExitosa(true);
      return;
    }
    setLoading(true);
    try {
      await vacantesAPI.postularse({ vacante_id: vacante.id, mensaje: mensajePost || null });
      setPostulado(true);
      setPostExitosa(true);
    } catch (err) {
      if (err.response?.status === 409) {
        setPostulado(true);
        setShowPostModal(false);
        showAlert('Aviso', 'Ya estás postulado a esta vacante');
        return;
      }
      showAlert('Error', err.response?.data?.error || 'Error al postularse');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = () => {
    setLiked(l => !l);
    heartScale.value = withSequence(
      withSpring(ANIMATION.scale.heartPop, ANIMATION.spring.bouncy),
      withSpring(1, ANIMATION.spring.gentle)
    );
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const onScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const pago = getVacancyPayDisplay(vacante);
  const fechaInicioTexto = formatVacancyStartDate(vacante.fecha_inicio, {
    long: true,
    fallback: 'Por definir',
  });

  const beneficios = [
    vacante.ofrece_alojamiento && { icon: 'home-outline', label: 'Vivienda', desc: 'Alojamiento incluido' },
    vacante.ofrece_alimentacion && { icon: 'restaurant-outline', label: 'Comida', desc: 'Alimentación incluida' },
  ].filter(Boolean);

  const requisitosTexto = vacante.requisitos?.trim();
  const labores = (vacante.labores || []).map((l) => l.labor || l).filter(Boolean);

  const heroFotos = fotos.length > 0
    ? fotos
    : vacante.foto_portada
      ? [{ url: vacante.foto_portada, id: 'portada' }]
      : [];

  // Parallax hero style
  const heroAnimStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [-100, 0, HERO_HEIGHT],
      [-50, 0, HERO_HEIGHT * 0.3],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [-100, 0],
      [1.2, 1],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AnimatedScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={styles.heroWrap}>
          <Animated.View style={[{ width: '100%', height: HERO_HEIGHT }, heroAnimStyle]}>
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
                    <View style={styles.dotsBar}>
                      {heroFotos.map((_, i) => (
                        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.heroPlaceholder}>
                <View style={styles.heroPlaceholderIcon}>
                  <Ionicons name="leaf" size={48} color={COLORS.primaryLight} />
                </View>
                <Text style={styles.heroPlaceholderText}>Sin fotos disponibles</Text>
              </View>
            )}
          </Animated.View>

          {/* Gradient + título sobre el hero */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.65)']}
            style={styles.heroGradient}
            pointerEvents="none"
          />
          <View style={styles.heroTitleBar} pointerEvents="none">
            {Boolean(vacante.urgente) && (
              <View style={styles.heroUrgentPill}>
                <Ionicons name="flash" size={11} color="#fff" />
                <Text style={styles.heroUrgentTxt}>URGENTE</Text>
              </View>
            )}
            <Text style={styles.heroTitle} numberOfLines={2}>{vacante.titulo}</Text>
            {vacante.nombre_empresa_finca ? (
              <Text style={styles.heroSubtitle}>{vacante.nombre_empresa_finca}</Text>
            ) : null}
          </View>

          {/* Botones sobre la imagen */}
          <View style={[styles.heroButtons, { top: insets.top + 8 }]}>
            <AnimatedPressable style={styles.heroBtn} onPress={() => navigation.goBack()} scaleValue={0.9} haptic={true}>
              <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
            </AnimatedPressable>
            <View style={styles.heroBtnRight}>
              <AnimatedPressable style={styles.heroBtn} scaleValue={0.9} haptic={true} onPress={() => {
                const titulo = vacante?.titulo || 'Vacante';
                const finca = vacante?.nombre_empresa_finca || '';
                const ubicacion = [vacante?.municipio, vacante?.departamento].filter(Boolean).join(', ');
                Share.share({
                  message: `🌱 ${titulo}${finca ? ` en ${finca}` : ''}${ubicacion ? ` — ${ubicacion}` : ''}\nEncuéntrala en TerraEmpleo: https://app.terrampleo.com`,
                  title: titulo,
                });
              }}>
                <Ionicons name="share-social-outline" size={20} color={COLORS.textPrimary} />
              </AnimatedPressable>
              <AnimatedPressable style={styles.heroBtn} onPress={toggleLike} scaleValue={0.9} haptic={false}>
                <Animated.View style={heartAnimStyle}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={20}
                    color={liked ? '#E53935' : COLORS.textPrimary}
                  />
                </Animated.View>
              </AnimatedPressable>
            </View>
          </View>

          {heroFotos.length > 0 && (
            <View style={styles.photoCounter}>
              <Ionicons name="images-outline" size={14} color={COLORS.white} />
              <Text style={styles.photoCounterText}>{activeIndex + 1}/{heroFotos.length}</Text>
            </View>
          )}
        </View>

        {/* ── CONTENIDO ── */}
        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 160, delay: 150 }}
        >
          {/* Cabecera flotante sobre el hero */}
          <View style={[styles.contentCard, { backgroundColor: colors.background }]}>

            {/* Badge row */}
            <View style={styles.badgeRow}>
              {Boolean(vacante.urgente) && (
                <View style={styles.urgentBadge}>
                  <Ionicons name="flash" size={11} color={COLORS.primary} />
                  <Text style={styles.urgentText}>URGENTE</Text>
                </View>
              )}
              {vacante.created_at && (
                <Text style={[styles.timeText, { color: colors.textMuted }]}>
                  {(() => {
                    const d = Math.floor((Date.now() - new Date(vacante.created_at)) / 86400000);
                    return d === 0 ? 'Publicado hoy' : d === 1 ? 'Hace 1 día' : `Hace ${d} días`;
                  })()}
                </Text>
              )}
            </View>

            {/* Título prominente */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>{vacante.titulo}</Text>

            {/* Tarjeta pago — destaca el salario */}
            <StaggeredItem index={0}>
              <LinearGradient
                colors={isDark ? ['#1a3a1a', '#1e4620'] : ['#2E7D32', '#43A047']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.pagoCard}
              >
                <View style={styles.pagoLeft}>
                  <Text style={styles.pagoLabel}>SALARIO</Text>
                  <Text style={styles.pagoValor}>{pago.valor}</Text>
                  {pago.modo ? <Text style={styles.pagoModo}>{pago.modo}</Text> : null}
                </View>
                <View style={styles.pagoIconCircle}>
                  <Ionicons name="cash" size={28} color="rgba(255,255,255,0.9)" />
                </View>
              </LinearGradient>
            </StaggeredItem>

            {/* Empresa info card — clickable */}
            {Boolean(vacante.nombre_empresa_finca || perfilEmpleador) && (
              <StaggeredItem index={1}>
                <AnimatedPressable
                  style={[styles.empresaCard, { backgroundColor: isDark ? colors.card : '#F8FAF8', borderColor: isDark ? colors.border : '#C8E6C9' }]}
                  onPress={() => perfilEmpleador && navigation.navigate('PerfilPublicoEmpleador', { empleador_id: vacante.empleador_id, vacante_id: vacante.id })}
                  scaleValue={0.97} haptic
                >
                  {perfilEmpleador?.foto_selfie ? (
                    <Image source={{ uri: perfilEmpleador.foto_selfie }} style={styles.empresaAvatar} resizeMode="cover" />
                  ) : (
                    <View style={styles.empresaIconWrap}>
                      <Ionicons name="leaf" size={22} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.empresaNombre, { color: colors.textPrimary }]}>{vacante.nombre_empresa_finca || 'Finca'}</Text>
                    {(vacante.municipio || vacante.departamento) && (
                      <View style={styles.empresaLocRow}>
                        <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                        <Text style={[styles.empresaLocText, { color: colors.textMuted }]}>{[vacante.municipio, vacante.departamento].filter(Boolean).join(', ')}</Text>
                      </View>
                    )}
                    {perfilEmpleador?.calificacion_promedio > 0 && (
                      <View style={styles.empresaStarsRow}>
                        {[1,2,3,4,5].map(i => (
                          <Ionicons key={i} name={i <= Math.round(perfilEmpleador.calificacion_promedio) ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                        ))}
                        <Text style={styles.empresaStarsTxt}>{Number(perfilEmpleador.calificacion_promedio).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    {perfilEmpleador && (
                      <View style={styles.empresaVerPill}>
                        <Text style={styles.empresaVerTxt}>Ver perfil</Text>
                        <Ionicons name="chevron-forward" size={12} color={COLORS.primary} />
                      </View>
                    )}
                  </View>
                </AnimatedPressable>
              </StaggeredItem>
            )}

            {/* Quick info pills */}
            <StaggeredItem index={2}>
              <View style={styles.quickPillsWrap}>
                <View style={[styles.quickPill, { backgroundColor: isDark ? colors.card : '#EFF6FF', borderColor: isDark ? colors.border : '#BFDBFE' }]}>
                  <Ionicons name="location" size={15} color="#3B82F6" />
                  <Text style={[styles.quickPillTxt, { color: isDark ? colors.textSecondary : '#1D4ED8' }]}>{[vacante.municipio, vacante.departamento].filter(Boolean).join(', ') || 'Colombia'}</Text>
                </View>
                <View style={[styles.quickPill, { backgroundColor: isDark ? colors.card : '#FEF3C7', borderColor: isDark ? colors.border : '#FDE68A' }]}>
                  <Ionicons name="calendar-clear" size={15} color="#D97706" />
                  <Text style={[styles.quickPillTxt, { color: isDark ? colors.textSecondary : '#92400E' }]}>{fechaInicioTexto}</Text>
                </View>
                {vacante.duracion ? (
                  <View style={[styles.quickPill, { backgroundColor: isDark ? colors.card : '#F3E8FF', borderColor: isDark ? colors.border : '#DDD6FE' }]}>
                    <Ionicons name="time" size={15} color="#7C3AED" />
                    <Text style={[styles.quickPillTxt, { color: isDark ? colors.textSecondary : '#5B21B6' }]}>{vacante.duracion}</Text>
                  </View>
                ) : null}
              </View>
            </StaggeredItem>

            {/* Fotos de la finca */}
            {(perfilEmpleador?.fotos_finca || []).length > 0 && (
              <StaggeredItem index={3}>
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIconBg, { backgroundColor: COLORS.primarySoft }]}>
                      <Ionicons name="images-outline" size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Fotos de la Finca</Text>
                  </View>
                  <FlatList
                    data={perfilEmpleador.fotos_finca}
                    horizontal showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, i) => item.id?.toString() || i.toString()}
                    contentContainerStyle={{ gap: 10 }}
                    renderItem={({ item, index: i }) => (
                      <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 16, stiffness: 130, delay: i * 60 }}>
                        <Image source={{ uri: item.url }} style={styles.fincaThumb} resizeMode="cover" />
                      </MotiView>
                    )}
                  />
                </View>
              </StaggeredItem>
            )}

            {/* Descripción vacante */}
            {vacante.descripcion && (
              <StaggeredItem index={4}>
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIconBg, { backgroundColor: COLORS.primarySoft }]}>
                      <Ionicons name="document-text-outline" size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Descripción del trabajo</Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>{vacante.descripcion}</Text>
                </View>
              </StaggeredItem>
            )}

            {/* Sobre la Finca */}
            {perfilEmpleador?.acerca_de && (
              <StaggeredItem index={4}>
                <View style={[styles.sectionBlock, { backgroundColor: isDark ? colors.card : '#F0FDF4', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIconBg, { backgroundColor: COLORS.primarySoft }]}>
                      <Ionicons name="leaf-outline" size={17} color={colors.primary} />
                    </View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Sobre la Finca</Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>{perfilEmpleador.acerca_de}</Text>
                </View>
              </StaggeredItem>
            )}

            {/* Cultivos + Labores en fila */}
            {((vacante.cultivos || []).length > 0 || labores.length > 0) && (
              <StaggeredItem index={5}>
                <View style={styles.sectionBlock}>
                  {(vacante.cultivos || []).length > 0 && (
                    <>
                      <View style={styles.sectionHeaderRow}>
                        <View style={[styles.sectionIconBg, { backgroundColor: COLORS.primarySoft }]}>
                          <Ionicons name="leaf-outline" size={17} color={colors.primary} />
                        </View>
                        <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Cultivos</Text>
                      </View>
                      <View style={[styles.chipsRow, { marginBottom: SPACING.md }]}>
                        {(vacante.cultivos || []).map((c, i) => (
                          <View key={`c${i}`} style={styles.chipGreen}>
                            <Ionicons name="leaf" size={12} color={colors.primary} />
                            <Text style={[styles.chipGreenText, { color: colors.primary }]}>{c.cultivo || c}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {labores.length > 0 && (
                    <>
                      <View style={styles.sectionHeaderRow}>
                        <View style={[styles.sectionIconBg, { backgroundColor: isDark ? colors.card : '#F1F5F9' }]}>
                          <Ionicons name="construct-outline" size={17} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Labores</Text>
                      </View>
                      <View style={styles.chipsRow}>
                        {labores.map((r, i) => (
                          <View key={i} style={[styles.reqChip, { backgroundColor: isDark ? colors.card : '#F8FAFC', borderColor: colors.border }]}>
                            <Ionicons name="construct-outline" size={13} color={colors.textSecondary} />
                            <Text style={[styles.reqChipText, { color: colors.textSecondary }]}>{r}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </StaggeredItem>
            )}

            {/* Requisitos */}
            {requisitosTexto && (
              <StaggeredItem index={6}>
                <View style={[styles.sectionBlock, { backgroundColor: isDark ? colors.card : '#FFFBEB', borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIconBg, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="clipboard-outline" size={17} color="#D97706" />
                    </View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Requisitos</Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSecondary }]}>{requisitosTexto}</Text>
                </View>
              </StaggeredItem>
            )}

            {/* Beneficios — cards coloridas */}
            {(beneficios.length > 0 || vacante.otros_beneficios) && (
              <StaggeredItem index={7}>
                <View style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={[styles.sectionIconBg, { backgroundColor: '#FEE2E2' }]}>
                      <Ionicons name="gift-outline" size={17} color="#DC2626" />
                    </View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.textPrimary }]}>Beneficios incluidos</Text>
                  </View>
                  <View style={styles.benefGrid}>
                    {beneficios.map((b, i) => (
                      <MotiView key={i}
                        from={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 14, stiffness: 120, delay: i * 80 }}
                      >
                        <View style={[styles.benefGridCard, { backgroundColor: isDark ? colors.card : (i === 0 ? '#F0FDF4' : '#EFF6FF'), borderColor: isDark ? colors.border : (i === 0 ? '#BBF7D0' : '#BFDBFE') }]}>
                          <View style={[styles.benefGridIcon, { backgroundColor: i === 0 ? '#DCFCE7' : '#DBEAFE' }]}>
                            <Ionicons name={b.icon} size={22} color={i === 0 ? '#16A34A' : '#2563EB'} />
                          </View>
                          <Text style={[styles.benefGridLabel, { color: colors.textPrimary }]}>{b.label}</Text>
                          <Text style={[styles.benefGridDesc, { color: colors.textMuted }]}>{b.desc}</Text>
                        </View>
                      </MotiView>
                    ))}
                    {vacante.otros_beneficios && (
                      <View style={[styles.benefGridCard, { backgroundColor: isDark ? colors.card : '#FFF7ED', borderColor: isDark ? colors.border : '#FED7AA' }]}>
                        <View style={[styles.benefGridIcon, { backgroundColor: '#FFEDD5' }]}>
                          <Ionicons name="star-outline" size={22} color="#EA580C" />
                        </View>
                        <Text style={[styles.benefGridLabel, { color: colors.textPrimary }]}>Extra</Text>
                        <Text style={[styles.benefGridDesc, { color: colors.textMuted }]}>{vacante.otros_beneficios}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </StaggeredItem>
            )}
          </View>
        </MotiView>
      </AnimatedScrollView>

      {/* Footer sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.background, borderColor: colors.border }]}>
        {postulado ? (
          <View style={styles.postBtnDoneWrap}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
            <Text style={styles.postBtnDoneText}>Ya estás postulado</Text>
          </View>
        ) : vacante?.activa === false || vacante?.activa === 0 ? (
          <View style={styles.postBtnDoneWrap}>
            <Ionicons name="lock-closed-outline" size={22} color="#9CA3AF" />
            <Text style={[styles.postBtnDoneText, { color: '#9CA3AF' }]}>Vacante cerrada</Text>
          </View>
        ) : (
          (user?.rol === 'trabajador' || user?.rol === 'especialista') && (
            <TouchableOpacity
              style={styles.postBtn}
              onPress={() => setShowPostModal(true)}
              disabled={loading}
              activeOpacity={0.82}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                  <Text style={styles.postBtnText}>Postularme</Text>
                </>
              )}
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Modal: Confirmar postulación */}
      <Modal visible={showPostModal} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); setShowPostModal(false); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <MotiView
            from={{ translateY: 100, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            {!postExitosa ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="paper-plane-outline" size={36} color={COLORS.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Postularte a esta vacante</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {vacante.titulo} en {vacante.nombre_empresa_finca || 'la empresa'}
                </Text>

                <Text style={[styles.modalFieldLabel, { color: colors.textPrimary }]}>Mensaje al empleador (opcional)</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="Cuéntale por qué eres ideal para este cargo..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={mensajePost}
                  onChangeText={setMensajePost}
                  textAlignVertical="top"
                />

                <AnimatedPressable
                  style={styles.modalPostBtn}
                  onPress={handlePostularse}
                  disabled={loading}
                  scaleValue={ANIMATION.scale.pressed}
                  haptic={true}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                      <Text style={styles.modalPostBtnText}>Enviar postulación</Text>
                    </>
                  )}
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.modalCancelBtn}
                  onPress={() => setShowPostModal(false)}
                  scaleValue={0.97}
                  haptic={false}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
                </AnimatedPressable>
              </>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHandle} />
                </View>
                <MotiView
                  from={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 150, delay: 100 }}
                  style={styles.successIconWrap}
                >
                  <Ionicons name="checkmark-circle" size={64} color={COLORS.primary} />
                </MotiView>
                <Text style={[styles.successTitle, { color: colors.textPrimary }]}>¡Postulación enviada!</Text>
                <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                  Tu perfil fue enviado a {vacante.nombre_empresa_finca || 'la empresa'}.
                  Te notificaremos cuando respondan.
                </Text>
                <View style={styles.successInfoRow}>
                  <View style={styles.successInfoItem}>
                    <View style={styles.successInfoIcon}>
                      <Ionicons name="briefcase-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={[styles.successInfoText, { color: colors.textPrimary }]}>{vacante.titulo}</Text>
                  </View>
                  <View style={styles.successInfoItem}>
                    <View style={styles.successInfoIcon}>
                      <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={[styles.successInfoText, { color: colors.textPrimary }]}>
                      {[vacante.municipio, vacante.departamento].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                </View>
                <AnimatedPressable
                  style={styles.modalPostBtn}
                  onPress={() => { setShowPostModal(false); setPostExitosa(false); }}
                  scaleValue={ANIMATION.scale.pressed}
                  haptic={true}
                >
                  <Text style={styles.modalPostBtnText}>Entendido</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  style={styles.modalCancelBtn}
                  onPress={() => { setShowPostModal(false); setPostExitosa(false); navigation.goBack(); }}
                  scaleValue={0.97}
                  haptic={false}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Volver a vacantes</Text>
                </AnimatedPressable>
              </>
            )}
          </MotiView>
        </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  /* Hero */
  heroWrap: { width: '100%', height: HERO_HEIGHT, backgroundColor: COLORS.primarySoft, overflow: 'hidden' },
  heroImage: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  heroPlaceholder: {
    width: '100%', height: HERO_HEIGHT,
    backgroundColor: COLORS.primaryDark,
    justifyContent: 'center', alignItems: 'center', gap: SPACING.md,
  },
  heroPlaceholderIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroPlaceholderText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  heroTitleBar: { position: 'absolute', bottom: 44, left: SPACING.lg, right: SPACING.lg },
  heroUrgentPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  heroUrgentTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 28, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  heroButtons: {
    position: 'absolute', left: SPACING.md, right: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroBtnRight: { flexDirection: 'row', gap: SPACING.sm },
  heroBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.medium,
  },
  photoCounter: {
    position: 'absolute', bottom: 36, right: SPACING.md,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  photoCounterText: { fontSize: 12, fontWeight: '600', color: COLORS.white },
  dotsWrap: {
    position: 'absolute', bottom: 36, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center',
  },
  dotsBar: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: COLORS.white, width: 20 },

  /* Content card */
  contentCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg + 4,
    paddingBottom: SPACING.lg,
    minHeight: 400,
  },

  /* Badge row */
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  urgentText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3 },

  /* Pago destacado */
  pagoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.medium },
  pagoLeft: { flex: 1 },
  pagoLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 4 },
  pagoValor: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  pagoModo: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  pagoIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  /* Quick pills */
  quickPillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.lg },
  quickPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 7 },
  quickPillTxt: { fontSize: 13, fontWeight: '600' },

  /* Empresa ver perfil */
  empresaVerPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  empresaVerTxt: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  /* Benefits grid */
  benefGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  benefGridCard: { flex: 1, minWidth: 130, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6 },
  benefGridIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  benefGridLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  benefGridDesc: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  timeText: { fontSize: 13 },

  title: { fontSize: 24, fontWeight: '800', marginBottom: SPACING.lg, lineHeight: 32 },

  /* Empresa card */
  empresaCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  empresaIconWrap: {
    width: 42, height: 42, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  empresaAvatar: { width: 48, height: 48, borderRadius: RADIUS.md, flexShrink: 0 },
  empresaNombre: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  empresaLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  empresaLocText: { fontSize: 13 },
  empresaStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  empresaStarsTxt: { fontSize: 12, fontWeight: '700', color: '#F59E0B', marginLeft: 3 },
  empresaVerBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  fincaThumb: { width: 150, height: 100, borderRadius: RADIUS.lg },

  /* Section headers */
  sectionBlock: { marginBottom: SPACING.lg },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  sectionIconBg: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '700' },

  infoBlock: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: SPACING.lg },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 4, borderBottomWidth: 1 },
  infoCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  infoLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  infoValue: { fontSize: 15, fontWeight: '700', marginTop: 1 },

  description: { fontSize: 15, lineHeight: 24 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reqChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  reqChipText: { fontSize: 13, fontWeight: '600' },
  chipGreen: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primarySoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full },
  chipGreenText: { fontSize: 13, fontWeight: '600' },

  benefCard: { borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  benefTitle: { fontSize: 15, fontWeight: '700' },
  benefRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  benefText: { fontSize: 14, fontWeight: '500' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    ...SHADOWS.large,
  },
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary,
    height: 52,
    width: '100%',
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  postBtnDoneWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, height: 52, backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.full, width: '100%',
  },
  postBtnDoneText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },

  modalOverlay: {
    flex: 1, backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl,
    maxHeight: '85%',
  },
  modalHeader: { alignItems: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 22, fontWeight: '800',
    textAlign: 'center', marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    fontSize: 14, textAlign: 'center',
    marginBottom: SPACING.lg, lineHeight: 20,
  },
  modalFieldLabel: {
    fontSize: 13, fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  modalInput: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.md, fontSize: 15,
    minHeight: 100, marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  modalPostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    height: 52, width: '100%', marginBottom: SPACING.sm,
    ...SHADOWS.button,
  },
  modalPostBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  modalCancelBtn: {
    alignItems: 'center', paddingVertical: 14,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },

  successIconWrap: { alignItems: 'center', marginBottom: SPACING.md },
  successTitle: {
    fontSize: 24, fontWeight: '800',
    textAlign: 'center', marginBottom: SPACING.xs,
  },
  successSubtitle: {
    fontSize: 14, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.lg,
  },
  successInfoRow: { gap: SPACING.sm, marginBottom: SPACING.lg },
  successInfoItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primaryMuted, borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  successInfoIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  successInfoText: { fontSize: 14, fontWeight: '600', flex: 1 },
});
