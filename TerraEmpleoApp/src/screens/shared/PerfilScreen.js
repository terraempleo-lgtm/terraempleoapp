import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { authAPI, vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import DecorativeBackground from '../../components/ui/DecorativeBackground';

const HERO_H = 260;

const LABELS_EXPERIENCIA = {
  sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años', '3_5': '3 a 5 años',
  '5_10': '5 a 10 años', mas_10: 'Más de 10 años',
};
const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  por_temporada: 'Por temporada / cosecha', fines_semana: 'Fines de semana',
  inmediato: 'Disponible inmediatamente',
};
const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios', primaria_completa: 'Primaria completa', bachiller: 'Bachiller',
  tecnico: 'Técnico / Tecnólogo', tecnico_tecnologo: 'Técnico / Tecnólogo', universitario: 'Universitario',
};
const LABELS_PAGO = {
  jornal: 'Jornal (diario)', semanal: 'Semanal',
  quincenal: 'Quincenal', mensual: 'Mensual', destajo: 'Por tarea / destajo',
};

/* ── Animated count-up for employer stats ── */
function AnimatedNumber({ value, style, prefix = '', suffix = '' }) {
  const animVal = useSharedValue(0);

  useEffect(() => {
    animVal.value = 0;
    animVal.value = withTiming(value, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({ opacity: 1 }));

  // For simplicity, render the final value with entrance animation
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 200 }}
    >
      <Text style={style}>{prefix}{value}{suffix}</Text>
    </MotiView>
  );
}

/* ── Pulsing timeline dot ── */
function PulsingDot({ color = COLORS.primary, size = 14, delay = 0 }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color, marginTop: 4, flexShrink: 0,
        },
        animStyle,
      ]}
    />
  );
}

export default function PerfilScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { isDark, toggleMode, colors } = useAppTheme();
  const [perfil, setPerfil] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fotoFincaPrincipal, setFotoFincaPrincipal] = useState(null);
  const insets = useSafeAreaInsets();

  const u = userData || user;
  const esTrabajador = u?.rol === 'trabajador';
  const esEmpleador = u?.rol === 'empleador';

  useFocusEffect(
    useCallback(() => {
      loadPerfil();
    }, [])
  );
  useEffect(() => {
    if (!user || user.rol === 'admin') return;
    navigation.setOptions({ headerShown: false });
  }, [navigation, user]);

  const loadPerfil = async () => {
    try {
      const res = await authAPI.getPerfil();
      setUserData(res.data.user);
      setPerfil(res.data.perfil);

      if (res.data?.user?.rol === 'empleador') {
        try {
          const vacantesRes = await vacantesAPI.misVacantes();
          const primeraConFoto = (vacantesRes.data?.vacantes || []).find(v => !!v.foto_portada);
          setFotoFincaPrincipal(primeraConFoto?.foto_portada || null);
        } catch (_) {
          setFotoFincaPrincipal(null);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    signOut();
  };

  const calificacion = parseFloat(u?.calificacion_promedio || 0);
  const totalCalif = u?.total_calificaciones || 0;
  const habilidades = (perfil?.habilidades || []).map(h => h.habilidad);
  const cultivos = (perfil?.cultivos || []).map(c => c.cultivo);
  const especialidades = [...habilidades, ...cultivos];

  const abrirDocumento = async (url) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('No disponible', 'No se pudo abrir el documento.');
        return;
      }
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert('Error', 'No se pudo abrir el documento.');
    }
  };

  /* ══════════ EMPLEADOR ══════════ */
  if (esEmpleador) {
    const empresa = perfil?.nombre_empresa_finca || u?.nombre_completo || 'Mi Empresa';
    const tipoPago = perfil?.tipo_pago ? (LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago) : null;
    const ubicacion = [u?.municipio, u?.departamento].filter(Boolean).join(', ') || null;
    const cultivosEmp = (perfil?.cultivos || []).map(c => c.cultivo || c);
    const labores = (perfil?.labores || []).map(l => l.labor || l);
    const beneficios = [
      perfil?.ofrece_alojamiento && 'Alojamiento incluido',
      perfil?.ofrece_alimentacion && 'Alimentación incluida',
    ].filter(Boolean);
    const acercaDeEmpleador = perfil?.acerca_de?.trim();

    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <DecorativeBackground intensity="strong" />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
          <View style={s.heroWrap}>
            {fotoFincaPrincipal ? (
              <Image source={{ uri: fotoFincaPrincipal }} style={s.heroImg} resizeMode="cover" />
            ) : (
              <View style={s.heroPlaceholder}>
                <MotiView
                  from={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 200 }}
                >
                  <View style={s.heroLeaf}><Ionicons name="leaf" size={44} color={COLORS.primaryLight} /></View>
                </MotiView>
                <Text style={s.heroPlaceholderText}>Agrega fotos en tus vacantes para mostrar tu finca aqui.</Text>
              </View>
            )}
            <View style={[s.heroBar, { top: insets.top + 8 }]}>
              <View style={{ width: 40 }} />
              <FadeInView delay={100} translateY={-5}>
                <Text style={s.heroBarTitle}>Perfil del Empleador</Text>
              </FadeInView>
              <AnimatedPressable style={s.heroCircleBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.9} haptic>
                <Ionicons name="settings-outline" size={20} color={COLORS.textPrimary} />
              </AnimatedPressable>
            </View>
          </View>

          <View style={s.empCard}>
            {/* Avatar centered above card — spring entrance */}
            <MotiView
              from={{ scale: 0.5, opacity: 0, translateY: 20 }}
              animate={{ scale: 1, opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 100 }}
            >
              <View style={s.empAvatarRow}>
                <View style={s.empAvatarWrap}>
                  {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
                    <Image source={{ uri: u.foto_selfie }} style={s.empAvatar} />
                  ) : (
                    <View style={s.empAvatarFallback}><Ionicons name="person" size={44} color={COLORS.textLight} /></View>
                  )}
                  <View style={s.empBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>
                </View>
              </View>
            </MotiView>

            <FadeInView delay={200}>
              <Text style={s.empName}>{u?.nombre_completo}</Text>
            </FadeInView>
            <FadeInView delay={250}>
              <Text style={s.empFinca}>🏠 {empresa}</Text>
            </FadeInView>
            {ubicacion && (
              <FadeInView delay={300}>
                <Text style={s.empLoc}>📍 {ubicacion}</Text>
              </FadeInView>
            )}

            {/* 3 stats with animated numbers */}
            <StaggeredItem index={0}>
              <View style={s.empStats}>
                <View style={s.empStatItem}>
                  <AnimatedNumber
                    value={calificacion > 0 ? `★ ${calificacion.toFixed(1)}` : '—'}
                    style={s.empStatVal}
                  />
                  <Text style={s.empStatLabel}>RATING</Text>
                </View>
                <View style={s.empStatDiv} />
                <View style={s.empStatItem}>
                  <AnimatedNumber value={u?.total_vacantes || 0} style={s.empStatVal} />
                  <Text style={s.empStatLabel}>VACANTES</Text>
                </View>
                <View style={s.empStatDiv} />
                <View style={s.empStatItem}>
                  <AnimatedNumber
                    value={u?.verificado_sms ? '✓' : '—'}
                    style={[s.empStatVal, { color: COLORS.primary }]}
                  />
                  <Text style={s.empStatLabel}>VERIFICADO</Text>
                </View>
              </View>
            </StaggeredItem>

            {/* Sobre la finca */}
            {perfil?.nombre_empresa_finca && (
              <StaggeredItem index={1}>
                <View style={s.secWrap}>
                  <View style={s.secHead}><View style={s.secIcon}><Ionicons name="leaf-outline" size={16} color={COLORS.primary} /></View><Text style={s.secTitle}>Sobre la Finca</Text></View>
                  {acercaDeEmpleador ? (
                    <Text style={s.secText}>{acercaDeEmpleador}</Text>
                  ) : (
                    <Text style={s.secTextMuted}>
                      {`Finca ${empresa}`}{ubicacion ? `, ubicada en ${ubicacion}` : ''}.
                      {tipoPago ? ` Modalidad de pago: ${tipoPago}.` : ''}
                      {beneficios.length > 0 ? ` Ofrecemos ${beneficios.join(' y ').toLowerCase()}.` : ''}
                    </Text>
                  )}
                </View>
              </StaggeredItem>
            )}

            {/* Cultivos */}
            {cultivosEmp.length > 0 && (
              <StaggeredItem index={2}>
                <View style={s.secWrap}>
                  <Text style={s.secTitle}>Cultivos Principales</Text>
                  <View style={s.chipWrap}>
                    {cultivosEmp.map((c, i) => (
                      <MotiView
                        key={i}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 40 }}
                      >
                        <View style={s.chipColor}><Ionicons name="leaf" size={12} color={COLORS.primary} /><Text style={s.chipColorTxt}>{c}</Text></View>
                      </MotiView>
                    ))}
                    {labores.map((l, i) => (
                      <MotiView
                        key={`l${i}`}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: (cultivosEmp.length + i) * 40 }}
                      >
                        <View style={[s.chipColor, { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}><Text style={[s.chipColorTxt, { color: '#F59E0B' }]}>{l}</Text></View>
                      </MotiView>
                    ))}
                  </View>
                </View>
              </StaggeredItem>
            )}

            {/* Verificación */}
            <StaggeredItem index={3}>
              <View style={s.secWrap}>
                <Text style={s.secTitle}>Información Verificada</Text>
                <View style={s.verList}>
                  <View style={s.verItem}>
                    <View style={s.verIcon}><Ionicons name="document-text-outline" size={18} color={COLORS.primary} /></View>
                    <Text style={s.verText}>Registro Empresarial</Text>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  </View>
                  <View style={s.verItem}>
                    <View style={s.verIcon}><Ionicons name="call-outline" size={18} color={COLORS.primary} /></View>
                    <Text style={s.verText}>Teléfono Verificado</Text>
                    <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <View style={s.verItem}>
                    <View style={s.verIcon}><Ionicons name="location-outline" size={18} color={COLORS.primary} /></View>
                    <Text style={s.verText}>Ubicación de la Finca</Text>
                    <Ionicons name={ubicacion ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ubicacion ? COLORS.primary : COLORS.textLight} />
                  </View>
                </View>
              </View>
            </StaggeredItem>

            {/* Editar Perfil */}
            <StaggeredItem index={4}>
              <AnimatedPressable style={s.ctaBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.96} haptic>
                <Ionicons name="create-outline" size={20} color={COLORS.white} />
                <Text style={s.ctaBtnTxt}>Editar Perfil</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[s.themeRow, { backgroundColor: isDark ? '#1a322a' : '#F8FAF9', borderColor: isDark ? '#2a4c41' : COLORS.borderLight }]}
                onPress={toggleMode}
                scaleValue={0.97}
                haptic
              >
                <View style={[s.themeIcon, { backgroundColor: isDark ? '#244238' : COLORS.primarySoft }]}>
                  <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={colors.primary} />
                </View>
                <Text style={[s.themeTxt, { color: colors.textPrimary }]}>
                  {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </AnimatedPressable>
              <AnimatedPressable style={s.logoutRow} onPress={handleLogout} scaleValue={0.97} haptic hapticStyle="light">
                <Ionicons name="log-out-outline" size={16} color={COLORS.error} /><Text style={s.logoutTxt}>Cerrar sesión</Text>
              </AnimatedPressable>
            </StaggeredItem>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ══════════ TRABAJADOR ══════════ */
  const disponibilidad = perfil?.disponibilidad ? (LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad) : null;
  const experiencia = perfil?.anios_experiencia ? (LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia) : null;
  const estudios = perfil?.nivel_estudios ? (LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios) : null;
  const ubicacionT = [u?.municipio, u?.departamento].filter(Boolean).join(', ') || null;
  const acercaDeTrabajador = perfil?.acerca_de?.trim();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <DecorativeBackground intensity="strong" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={{ width: 40 }} />
          <FadeInView delay={100} translateY={-5}>
            <Text style={[s.topBarTitle, { color: colors.textPrimary }]}>Perfil del Trabajador</Text>
          </FadeInView>
          <AnimatedPressable style={s.shareBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.9} haptic>
            <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>

        {/* Avatar — spring bouncy entrance */}
        <View style={s.profileCenter}>
          <MotiView
            from={{ scale: 0.4, opacity: 0, translateY: 30 }}
            animate={{ scale: 1, opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 150 }}
          >
            <View style={s.avatarWrap}>
              {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
                <Image source={{ uri: u.foto_selfie }} style={s.avatar} />
              ) : (
                <View style={s.avatarFallback}><Ionicons name="person" size={52} color={COLORS.textLight} /></View>
              )}
              <View style={s.verifiedBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>
            </View>
          </MotiView>

          <FadeInView delay={250}>
            <Text style={[s.fullName, { color: colors.textPrimary }]}>{u?.nombre_completo || 'Usuario'}</Text>
          </FadeInView>

          {calificacion > 0 ? (
            <FadeInView delay={300}>
              <View style={s.ratingRow}>
                <Ionicons name="star" size={16} color="#FFB300" />
                <Text style={[s.ratingVal, { color: colors.textPrimary }]}>{calificacion.toFixed(1)}</Text>
                <Text style={[s.ratingCnt, { color: colors.textSecondary }]}>({totalCalif} reseñas)</Text>
              </View>
            </FadeInView>
          ) : (
            <FadeInView delay={300}>
              <Text style={[s.noRating, { color: colors.textMuted }]}>Sin reseñas aún</Text>
            </FadeInView>
          )}

          {u?.verificado_sms && (
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 350 }}
            >
              <View style={s.verPill}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} /><Text style={s.verPillTxt}>VERIFICADO</Text>
              </View>
            </MotiView>
          )}
        </View>

        {/* ACERCA DE */}
        <StaggeredItem index={0}>
          <View style={s.secWrap}>
            <Text style={[s.secLabel, { color: colors.primary }]}>ACERCA DE</Text>
            {acercaDeTrabajador ? (
              <Text style={[s.secText, { color: colors.textSecondary }]}>{acercaDeTrabajador}</Text>
            ) : (
              <Text style={[s.secTextMuted, { color: colors.textMuted }]}>Aún no has agregado tu sección "Acerca de".</Text>
            )}
          </View>
        </StaggeredItem>

        {perfil?.hoja_vida_url ? (
          <StaggeredItem index={1}>
            <View style={s.secWrap}>
              <Text style={s.secLabel}>HOJA DE VIDA</Text>
              <AnimatedPressable
                style={[
                  s.cvCard,
                  { backgroundColor: isDark ? '#1a322a' : COLORS.primarySoft, borderColor: isDark ? '#2a4c41' : COLORS.borderLight },
                ]}
                onPress={() => abrirDocumento(perfil.hoja_vida_url)}
                scaleValue={0.98}
                haptic={false}
              >
                <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.cvCardTitle, { color: colors.textPrimary }]}>Hoja de vida cargada</Text>
                  <Text style={[s.cvCardName, { color: colors.textSecondary }]} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={COLORS.primary} />
              </AnimatedPressable>
            </View>
          </StaggeredItem>
        ) : null}

        {/* HABILIDADES */}
        {especialidades.length > 0 && (
          <StaggeredItem index={2}>
            <View style={s.secWrap}>
              <Text style={[s.secLabel, { color: colors.primary }]}>HABILIDADES Y ESPECIALIDADES</Text>
              <View style={s.chipWrap}>
                {especialidades.map((e, i) => (
                  <MotiView
                    key={i}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 40 }}
                  >
                    <View style={[s.chipOutline, { borderColor: colors.border }]}><Text style={[s.chipOutlineTxt, { color: colors.textSecondary }]}>{e}</Text></View>
                  </MotiView>
                ))}
              </View>
            </View>
          </StaggeredItem>
        )}

        {/* EXPERIENCIA — with pulsing timeline dots */}
        {experiencia && (
          <StaggeredItem index={3}>
            <View style={s.secWrap}>
              <Text style={[s.secLabel, { color: colors.primary }]}>EXPERIENCIA LABORAL</Text>
              <View style={s.timeline}>
                <View style={s.tlItem}>
                  <PulsingDot color={COLORS.primary} />
                  <View style={s.tlLine} />
                  <View style={s.tlContent}>
                    <Text style={[s.tlTitle, { color: colors.textPrimary }]}>Experiencia Agrícola</Text>
                    <Text style={[s.tlSub, { color: colors.primary }]}>{experiencia}</Text>
                    <Text style={[s.tlDesc, { color: colors.textSecondary }]}>Trabajo en campo, cultivos y cosecha</Text>
                  </View>
                </View>
                {estudios && (
                  <View style={s.tlItem}>
                    <PulsingDot color={COLORS.primaryLight} delay={300} />
                    <View style={s.tlContent}>
                      <Text style={[s.tlTitle, { color: colors.textPrimary }]}>Formación</Text>
                      <Text style={[s.tlSub, { color: colors.primary }]}>{estudios}</Text>
                      {perfil?.titulo_estudio && <Text style={[s.tlDesc, { color: colors.textSecondary }]}>{perfil.titulo_estudio}</Text>}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </StaggeredItem>
        )}

        {/* Stat cards — staggered */}
        <StaggeredItem index={4}>
          <View style={s.statRow}>
            <MotiView
              from={{ opacity: 0, translateY: 20, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 250 }}
              style={{ flex: 1 }}
            >
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }] }>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={[s.statLabel, { color: colors.textMuted }]}>UBICACIÓN</Text>
                <Text style={[s.statVal, { color: colors.textPrimary }]}>{ubicacionT || 'Colombia'}</Text>
              </View>
            </MotiView>
            <MotiView
              from={{ opacity: 0, translateY: 20, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 350 }}
              style={{ flex: 1 }}
            >
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }] }>
                <Ionicons name="calendar" size={20} color={COLORS.primary} />
                <Text style={[s.statLabel, { color: colors.textMuted }]}>DISPONIBILIDAD</Text>
                <Text style={[s.statVal, { color: colors.textPrimary }]}>{disponibilidad || 'No indicada'}</Text>
              </View>
            </MotiView>
          </View>
        </StaggeredItem>

        {/* DOCUMENTACIÓN */}
        <StaggeredItem index={5}>
          <View style={s.secWrap}>
            <Text style={[s.secLabel, { color: colors.primary }]}>DOCUMENTACIÓN VERIFICADA</Text>
            <View style={s.verList}>
              <View style={[s.verItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.verIcon, { backgroundColor: isDark ? '#223a32' : COLORS.primarySoft }]}><Ionicons name="card-outline" size={18} color={COLORS.primary} /></View>
                <Text style={[s.verText, { color: colors.textPrimary }]}>Cédula de Ciudadanía</Text>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              </View>
              <View style={[s.verItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.verIcon, { backgroundColor: isDark ? '#223a32' : COLORS.primarySoft }]}><Ionicons name="call-outline" size={18} color={COLORS.primary} /></View>
                <Text style={[s.verText, { color: colors.textPrimary }]}>Teléfono Verificado</Text>
                <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? COLORS.primary : COLORS.textLight} />
              </View>
            </View>
          </View>
        </StaggeredItem>

        {/* Editar Perfil */}
        <StaggeredItem index={6}>
          <View style={s.secWrap}>
            <AnimatedPressable style={s.ctaBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.96} haptic>
              <Ionicons name="create-outline" size={20} color={COLORS.white} /><Text style={s.ctaBtnTxt}>Editar Perfil</Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={[s.themeRow, { backgroundColor: isDark ? '#1a322a' : '#F8FAF9', borderColor: isDark ? '#2a4c41' : COLORS.borderLight }]}
              onPress={toggleMode}
              scaleValue={0.97}
              haptic
            >
              <View style={[s.themeIcon, { backgroundColor: isDark ? '#244238' : COLORS.primarySoft }]}>
                <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color={colors.primary} />
              </View>
              <Text style={[s.themeTxt, { color: colors.textPrimary }]}>
                {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </AnimatedPressable>
            <AnimatedPressable style={[s.logoutRow, { backgroundColor: isDark ? '#2a1717' : 'transparent' }]} onPress={handleLogout} scaleValue={0.97} haptic hapticStyle="light">
              <Ionicons name="log-out-outline" size={16} color={COLORS.error} /><Text style={s.logoutTxt}>Cerrar sesión</Text>
            </AnimatedPressable>
          </View>
        </StaggeredItem>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },

  /* Top bar */
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  shareBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  /* Profile center */
  profileCenter: { alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
  fullName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  ratingVal: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  ratingCnt: { fontSize: 14, color: COLORS.textSecondary },
  noRating: { fontSize: 14, color: COLORS.textLight, marginBottom: 8 },
  verPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5 },
  verPillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },

  /* Sections shared */
  secWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  secLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 1, marginBottom: SPACING.sm },
  secText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  secTextMuted: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  secIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  secTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOutline: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  chipOutlineTxt: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipColor: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: COLORS.primarySoft },
  chipColorTxt: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  /* Timeline */
  timeline: { paddingLeft: 4 },
  tlItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  tlLine: { position: 'absolute', left: 6, top: 20, width: 2, height: 50, backgroundColor: COLORS.primarySoft },
  tlContent: { flex: 1 },
  tlTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  tlSub: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
  tlDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },

  /* Stat cards */
  statRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.borderLight },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  statVal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  /* Verified list */
  verList: { gap: SPACING.sm },
  verItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight },
  verIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  verText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  /* CV card */
  cvCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  cvCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cvCardName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  /* CTA */
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.full, ...SHADOWS.button },
  ctaBtnTxt: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  themeRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  themeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeTxt: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: RADIUS.full },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  /* ── EMPLEADOR ── */
  heroWrap: { width: '100%', height: HERO_H, position: 'relative' },
  heroImg: { width: '100%', height: HERO_H },
  heroPlaceholder: { width: '100%', height: HERO_H, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  heroLeaf: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  heroPlaceholderText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  heroBar: { position: 'absolute', left: SPACING.md, right: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  heroCircleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },

  empCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -32, paddingHorizontal: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.lg },
  empAvatarRow: { alignItems: 'center', marginTop: -50 },
  empAvatarWrap: { position: 'relative' },
  empAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.white },
  empAvatarFallback: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: COLORS.white, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  empBadge: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
  empName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginTop: SPACING.sm },
  empFinca: { fontSize: 15, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginTop: 4 },
  empLoc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: SPACING.md },

  empStats: { flexDirection: 'row', backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.lg },
  empStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  empStatVal: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  empStatLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  empStatDiv: { width: 1, backgroundColor: COLORS.borderLight },
});
