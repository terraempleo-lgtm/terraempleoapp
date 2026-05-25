import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity,
  Image, Linking, Modal, ActivityIndicator, ActionSheetIOS, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { authAPI } from '../../services/api';
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
import { showAlert } from '../../utils/alertService';
import { CameraView, useCameraPermissions } from 'expo-camera';

const HERO_H = 260;
const W = Dimensions.get('window').width;
const FOTO_COL = 2;
const FOTO_SIZE = (W - SPACING.md * 2 - SPACING.md * 2 - SPACING.sm) / FOTO_COL;

const EXP_COLORS = [
  { dot: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { dot: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD' },
  { dot: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  { dot: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { dot: '#DC2626', bg: '#FFF1F2', border: '#FECDD3' },
];

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
  por_kilo: 'Por kilo',
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
  const { user, signOut, updateUser } = useAuth();
  const { isDark, toggleMode, colors } = useAppTheme();
  const [perfil, setPerfil] = useState(null);
  const [userData, setUserData] = useState(null);
  const [fotoFincaPrincipal, setFotoFincaPrincipal] = useState(null);
  const insets = useSafeAreaInsets();

  // Cambio de foto de perfil
  const [modalCamara, setModalCamara] = useState(false);
  const [preview, setPreview] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const u = userData || user;
  const esTrabajador = u?.rol === 'trabajador';
  const esEmpleador = u?.rol === 'empleador';
  const [subiendoDocEmpresa, setSubiendoDocEmpresa] = useState(false);

  const subirDocumentoEmpresa = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Elegir de galería'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await _capturarDocEmpresa();
          else if (idx === 2) await _galeriaDocEmpresa();
        }
      );
    } else {
      Alert.alert('Documento de verificación', 'Sube una foto del RUT, RNT o factura de servicios públicos de tu finca.\n\n🔒 Esta información es confidencial y solo la usamos para verificar que todos en TerraEmpleo sean personas y empresas reales, garantizando la seguridad de nuestra comunidad.', [
        { text: 'Tomar foto', onPress: _capturarDocEmpresa },
        { text: 'Elegir de galería', onPress: _galeriaDocEmpresa },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const _galeriaDocEmpresa = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) await _uploadDocEmpresa(result.assets[0].uri);
  };

  const _capturarDocEmpresa = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showAlert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) await _uploadDocEmpresa(result.assets[0].uri);
  };

  const _uploadDocEmpresa = async (uri) => {
    setSubiendoDocEmpresa(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('foto', blob, `doc_empresa_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri, type: 'image/jpeg', name: `doc_empresa_${Date.now()}.jpg` });
      }
      await authAPI.subirFoto('doc_empresa', formData);
      await loadPerfil();
      showAlert('Documento enviado', 'Tu documento fue enviado. El equipo de TerraEmpleo lo revisará pronto.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar el documento.');
    } finally {
      setSubiendoDocEmpresa(false);
    }
  };

  const [subiendoFotoFinca, setSubiendoFotoFinca] = useState(false);

  const subirFotoFinca = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Elegir de galería'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) {
            const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
            if (!r.canceled && r.assets?.[0]) await _uploadFotoFinca(r.assets[0].uri);
          } else if (idx === 2) {
            const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
            if (!r.canceled && r.assets?.[0]) await _uploadFotoFinca(r.assets[0].uri);
          }
        }
      );
    } else {
      Alert.alert('Foto de la finca', 'Elige cómo subir la foto de tu finca', [
        { text: 'Tomar foto', onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!r.canceled && r.assets?.[0]) await _uploadFotoFinca(r.assets[0].uri);
        }},
        { text: 'Elegir de galería', onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
          if (!r.canceled && r.assets?.[0]) await _uploadFotoFinca(r.assets[0].uri);
        }},
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const _uploadFotoFinca = async (uri) => {
    setSubiendoFotoFinca(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        formData.append('foto', blob, `finca_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri, type: 'image/jpeg', name: `finca_${Date.now()}.jpg` });
      }
      const res = await authAPI.subirFoto('finca_fachada', formData);
      setFotoFincaPrincipal(res.data.path);
      showAlert('Foto actualizada', 'La foto de tu finca fue guardada.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendoFotoFinca(false);
    }
  };
  const identidadAprobada = u?.validacion_identidad_estado === 'aprobada';

  const diasDesdeUltimoCambio = u?.foto_selfie_cambiada_at
    ? (Date.now() - new Date(u.foto_selfie_cambiada_at).getTime()) / 86400000
    : null;
  const puedeCambiarFoto = diasDesdeUltimoCambio === null || diasDesdeUltimoCambio >= 7;
  const diasParaCambio = diasDesdeUltimoCambio !== null && diasDesdeUltimoCambio < 7
    ? Math.ceil(7 - diasDesdeUltimoCambio)
    : 0;

  const _abrirCamara = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showAlert('Permiso requerido', 'Necesitamos acceso a la cámara.');
        return;
      }
    }
    setPreview(null);
    setModalCamara(true);
  };

  const abrirCamaraFoto = () => {
    if (!puedeCambiarFoto) {
      showAlert('Cambio no disponible', `Podrás cambiar tu foto en ${diasParaCambio} día(s).`);
      return;
    }
    _abrirCamara();
  };

  const tomarFoto = async () => {
    if (!cameraRef.current) return;
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPreview(foto.uri);
    } catch {
      showAlert('Error', 'No se pudo tomar la foto. Intenta de nuevo.');
    }
  };

  const escogerDeGaleria = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showAlert('Permiso requerido', 'Necesitamos acceso a tu galería.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPreview(result.assets[0].uri);
      }
    } catch {
      showAlert('Error', 'No se pudo abrir la galería.');
    }
  };

  const confirmarCambioFoto = async () => {
    if (!preview) return;
    setSubiendoFoto(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(preview);
        const blob = await response.blob();
        formData.append('foto', blob, `selfie_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri: preview, type: 'image/jpeg', name: `selfie_${Date.now()}.jpg` });
      }
      const res = await authAPI.cambiarFotoPerfil(formData);
      setModalCamara(false);
      setPreview(null);
      updateUser({ foto_selfie: res.data.path, validacion_identidad_estado: 'pendiente', foto_selfie_cambiada_at: new Date().toISOString() });
      setUserData(prev => prev ? { ...prev, foto_selfie: res.data.path, validacion_identidad_estado: 'pendiente', foto_selfie_cambiada_at: new Date().toISOString() } : prev);
      showAlert('Foto actualizada', 'Tu foto fue cambiada. Tu verificación fue enviada a revisión.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar la foto.');
    } finally {
      setSubiendoFoto(false);
    }
  };

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
        setFotoFincaPrincipal(res.data?.perfil?.foto_finca_fachada || null);
      }
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => { signOut(); };

  const esEspecialista = u?.rol === 'especialista';
  const calificacion = parseFloat(u?.calificacion_promedio || 0);
  const totalCalif = u?.total_calificaciones || 0;
  const habilidades = (perfil?.habilidades || []).map(h => h.habilidad);
  const cultivos = (perfil?.cultivos || []).map(c => c.cultivo || c);
  const especialidades = [...habilidades, ...cultivos];

  const abrirDocumento = async (url) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showAlert('No disponible', 'No se pudo abrir el documento.');
        return;
      }
      await Linking.openURL(url);
    } catch (_) {
      showAlert('Error', 'No se pudo abrir el documento.');
    }
  };

  /* ══════════ ESPECIALISTA ══════════ */
  if (esEspecialista) {
    const espEspecialidades = (perfil?.especialidades || []).map(e => e.especialidad || e);
    const espCultivos = (perfil?.cultivos || []).map(c => c.cultivo || c);
    const NIVEL_LABELS = { empirico: 'Empírico / experiencia', tecnico_tecnologo: 'Técnico / Tecnólogo', profesional: 'Profesional' };
    const MODAL_LABELS = { por_proyecto: 'Por proyecto', por_dias: 'Por días', mensual: 'Mensual', asesoria_puntual: 'Asesoría puntual' };
    const RADIO_LABELS = { municipio: 'Solo mi municipio', departamento: 'Mi departamento', eje_cafetero: 'Eje Cafetero', nacional: 'Todo Colombia' };
    const EXP_LABELS = { menos_1: 'Menos de 1 año', '1_3': '1 a 3 años', '3_5': '3 a 5 años', '5_10': '5 a 10 años', mas_10: 'Más de 10 años' };
    const ubicEsp = [u?.municipio, u?.departamento].filter(Boolean).join(', ');
    const infoRows = [
      { icon: 'school-outline', label: 'Formación', value: NIVEL_LABELS[perfil?.nivel_formacion] },
      { icon: 'time-outline', label: 'Experiencia', value: EXP_LABELS[perfil?.anios_experiencia] },
      { icon: 'calendar-outline', label: 'Modalidad', value: MODAL_LABELS[perfil?.modalidad_trabajo] },
      { icon: 'navigate-outline', label: 'Cobertura', value: RADIO_LABELS[perfil?.radio_cobertura] },
      { icon: 'ribbon-outline', label: 'Certificación', value: perfil?.titulo_certificacion },
    ].filter(r => r.value);

    const espExp = EXP_LABELS[perfil?.anios_experiencia]?.split(' ').slice(0,2).join(' ') || '—';

    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

          {/* ── HERO terracota ── */}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 400 }}>
            <LinearGradient colors={['#8B3A2A', '#C0694A', '#D4845A']} style={[tw.hero, { paddingTop: (insets?.top || 0) + 52 }]}>
              <View style={tw.heroTopBar}>
                <View style={{ width: 40 }} />
                <Text style={tw.heroTopTitle}>Mi Perfil</Text>
                <AnimatedPressable style={tw.settingsBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.88} haptic>
                  <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
                </AnimatedPressable>
              </View>

              <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 150 }}>
                <TouchableOpacity onPress={abrirCamaraFoto} activeOpacity={0.8} style={tw.avatarOuter}>
                  {u?.foto_selfie?.startsWith('http') ? (
                    <Image source={{ uri: u.foto_selfie }} style={tw.avatar} />
                  ) : (
                    <View style={[tw.avatarFallback, { backgroundColor: 'rgba(255,255,255,0.2)' }]}><Ionicons name="person" size={44} color="rgba(255,255,255,0.7)" /></View>
                  )}
                  {identidadAprobada && <View style={[tw.verBadge, { backgroundColor: '#C0694A' }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                  <View style={tw.camBadge}><Ionicons name={puedeCambiarFoto ? 'camera' : 'time-outline'} size={11} color="#fff" /></View>
                </TouchableOpacity>
              </MotiView>

              <FadeInView delay={220}><Text style={tw.heroName}>{u?.nombre_completo || 'Especialista'}</Text></FadeInView>
              <FadeInView delay={260}>
                <View style={tw.heroPills}>
                  <View style={[tw.heroPill, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                    <Ionicons name="ribbon-outline" size={12} color="#FFD700" />
                    <Text style={[tw.heroPillTxt, { color: '#FFD700', fontWeight: '700' }]}>Especialista</Text>
                  </View>
                  {ubicEsp ? <View style={tw.heroPill}><Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" /><Text style={tw.heroPillTxt}>{ubicEsp}</Text></View> : null}
                </View>
              </FadeInView>

              <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 320 }} style={tw.statsCard}>
                <View style={tw.statItem}>
                  <Ionicons name="star" size={20} color="#FFB300" />
                  <Text style={tw.statNum}>{calificacion > 0 ? calificacion.toFixed(1) : '—'}</Text>
                  <Text style={tw.statLbl}>Calificación</Text>
                </View>
                <View style={tw.statDivider} />
                <View style={tw.statItem}>
                  <Ionicons name="ribbon-outline" size={20} color="#C0694A" />
                  <Text style={tw.statNum}>{espEspecialidades.length || '—'}</Text>
                  <Text style={tw.statLbl}>Especialidades</Text>
                </View>
                <View style={tw.statDivider} />
                <View style={tw.statItem}>
                  <Ionicons name="briefcase-outline" size={20} color="#43A047" />
                  <Text style={tw.statNum}>{espExp}</Text>
                  <Text style={tw.statLbl}>Experiencia</Text>
                </View>
              </MotiView>
            </LinearGradient>
          </MotiView>

          <View style={{ paddingHorizontal: SPACING.md, paddingTop: 52 }}>

            {/* Banner mejora perfil especialista */}
            {(!perfil?.descripcion_servicio || !(perfil?.fotos_trabajo?.length > 0) || !(perfil?.experiencias?.length > 0) || !perfil?.hoja_vida_url) && (
              <FadeInView delay={80}>
                <AnimatedPressable
                  style={[mejoraStyles.banner, { backgroundColor: isDark ? '#2a1a12' : '#FEF3ED', borderColor: isDark ? '#5c2e1a' : '#F5C4B5' }]}
                  onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })}
                  scaleValue={0.98} haptic
                >
                  <View style={[mejoraStyles.iconWrap, { backgroundColor: '#C0694A' }]}>
                    <Ionicons name="trending-up" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[mejoraStyles.title, { color: isDark ? '#E8A080' : '#8B3A2A' }]}>¡Mejora tu perfil!</Text>
                    <View style={mejoraStyles.itemsRow}>
                      {!perfil?.descripcion_servicio && <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color="#C0694A" /><Text style={[mejoraStyles.itemText, { color: isDark ? '#E8A080' : '#8B3A2A' }]}>Agrega descripción del servicio</Text></View>}
                      {!(perfil?.experiencias?.length > 0) && <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color="#C0694A" /><Text style={[mejoraStyles.itemText, { color: isDark ? '#E8A080' : '#8B3A2A' }]}>Agrega experiencias laborales</Text></View>}
                      {!(perfil?.fotos_trabajo?.length > 0) && <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color="#C0694A" /><Text style={[mejoraStyles.itemText, { color: isDark ? '#E8A080' : '#8B3A2A' }]}>Sube fotos de tu trabajo</Text></View>}
                      {!perfil?.hoja_vida_url && <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color="#C0694A" /><Text style={[mejoraStyles.itemText, { color: isDark ? '#E8A080' : '#8B3A2A' }]}>Adjunta tu hoja de vida</Text></View>}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#C0694A" />
                </AnimatedPressable>
              </FadeInView>
            )}

            {/* Descripción del servicio */}
            {perfil?.descripcion_servicio ? (
              <StaggeredItem index={0}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#8B3A2A','#C0694A']} style={tw.cardIconGrad}>
                      <Ionicons name="document-text-outline" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Sobre el especialista</Text>
                  </View>
                  <Text style={[tw.cardBody, { color: colors.textSecondary }]}>{perfil.descripcion_servicio}</Text>
                </View>
              </StaggeredItem>
            ) : null}

            {/* Hoja de vida */}
            {perfil?.hoja_vida_url ? (
              <StaggeredItem index={1}>
                <AnimatedPressable style={[tw.cvCard, { backgroundColor: isDark ? '#2a1a12' : '#FEF3ED' }]} onPress={() => abrirDocumento(perfil.hoja_vida_url)} scaleValue={0.97} haptic={false}>
                  <LinearGradient colors={['#8B3A2A','#C0694A']} style={tw.cvIconGrad}>
                    <Ionicons name="document-text" size={18} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[tw.cvTitle, { color: colors.textPrimary }]}>Hoja de vida</Text>
                    <Text style={[tw.cvName, { color: colors.textMuted }]} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
                  </View>
                  <View style={[tw.cvBadge, { backgroundColor: '#FEF3ED' }]}><Ionicons name="open-outline" size={14} color="#C0694A" /><Text style={[tw.cvBadgeTxt, { color: '#C0694A' }]}>Abrir</Text></View>
                </AnimatedPressable>
              </StaggeredItem>
            ) : null}

            {/* Especialidades */}
            {espEspecialidades.length > 0 && (
              <StaggeredItem index={2}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#8B3A2A','#C0694A']} style={tw.cardIconGrad}>
                      <Ionicons name="ribbon-outline" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Especialidades</Text>
                  </View>
                  <View style={tw.chipRow}>
                    {espEspecialidades.map((e, i) => (
                      <MotiView key={i} from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 35 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FDEAE5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                          <Ionicons name="star" size={11} color="#C0694A" />
                          <Text style={{ fontSize: 12, color: '#8B3A2A', fontWeight: '600' }}>{e}</Text>
                        </View>
                      </MotiView>
                    ))}
                  </View>
                </View>
              </StaggeredItem>
            )}

            {/* Info profesional */}
            {infoRows.length > 0 && (
              <StaggeredItem index={3}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#1565C0','#1976D2']} style={tw.cardIconGrad}>
                      <Ionicons name="briefcase-outline" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Información profesional</Text>
                  </View>
                  {infoRows.map((row, i) => (
                    <View key={i} style={[tw.expRow, { borderBottomColor: colors.border, borderBottomWidth: i < infoRows.length - 1 ? 1 : 0 }]}>
                      <View style={[tw.expDot, { backgroundColor: '#DBEAFE' }]}><Ionicons name={row.icon} size={15} color="#2563EB" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={[tw.expLbl, { color: colors.textMuted }]}>{row.label.toUpperCase()}</Text>
                        <Text style={[tw.expVal, { color: colors.textPrimary }]}>{row.value}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </StaggeredItem>
            )}

            {/* Cultivos */}
            {espCultivos.length > 0 && (
              <StaggeredItem index={4}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#2E7D32','#66BB6A']} style={tw.cardIconGrad}>
                      <Ionicons name="leaf" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Cultivos y producciones</Text>
                  </View>
                  <View style={tw.chipRow}>
                    {espCultivos.map((c, i) => (
                      <MotiView key={i} from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 35 }}>
                        <View style={tw.chipGreen}><Ionicons name="leaf" size={11} color="#2E7D32" /><Text style={tw.chipGreenTxt}>{c}</Text></View>
                      </MotiView>
                    ))}
                  </View>
                </View>
              </StaggeredItem>
            )}

            {/* Experiencias laborales — timeline */}
            {(perfil?.experiencias || []).length > 0 && (
              <StaggeredItem index={5}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#7C3AED','#6D28D9']} style={tw.cardIconGrad}>
                      <Ionicons name="briefcase" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Experiencias laborales</Text>
                    <Text style={tw.cardCount}>{perfil.experiencias.length}</Text>
                  </View>
                  <View style={tw.tlWrap}>
                    {perfil.experiencias.map((exp, i) => (
                      <MotiView key={exp.id || i} from={{ opacity: 0, translateX: -12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 80 }}>
                        <View style={tw.tlRow}>
                          <View style={tw.tlTrack}>
                            <View style={[tw.tlDot, { backgroundColor: EXP_COLORS[i % EXP_COLORS.length].dot }]}>
                              <Ionicons name="business-outline" size={11} color="#fff" />
                            </View>
                            {i < perfil.experiencias.length - 1 && <View style={[tw.tlLine, { backgroundColor: colors.border }]} />}
                          </View>
                          <View style={[tw.tlCard, { backgroundColor: EXP_COLORS[i % EXP_COLORS.length].bg, borderColor: EXP_COLORS[i % EXP_COLORS.length].border }]}>
                            <Text style={[tw.tlEntidad, { color: colors.textPrimary }]}>{exp.entidad}</Text>
                            {!!exp.duracion && (
                              <View style={tw.tlDuracionRow}>
                                <Ionicons name="time-outline" size={12} color={EXP_COLORS[i % EXP_COLORS.length].dot} />
                                <Text style={[tw.tlDuracion, { color: EXP_COLORS[i % EXP_COLORS.length].dot }]}>{exp.duracion}</Text>
                              </View>
                            )}
                            {!!exp.descripcion && <Text style={[tw.tlDesc, { color: colors.textSecondary }]}>{exp.descripcion}</Text>}
                          </View>
                        </View>
                      </MotiView>
                    ))}
                  </View>
                </View>
              </StaggeredItem>
            )}

            {/* Fotos de trabajo */}
            {(perfil?.fotos_trabajo || []).length > 0 && (
              <StaggeredItem index={6}>
                <View style={[tw.card, { backgroundColor: colors.surface }]}>
                  <View style={tw.cardHeader}>
                    <LinearGradient colors={['#B45309','#D97706']} style={tw.cardIconGrad}>
                      <Ionicons name="images-outline" size={16} color="#fff" />
                    </LinearGradient>
                    <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Fotos de trabajo</Text>
                    <Text style={tw.cardCount}>{perfil.fotos_trabajo.length}</Text>
                  </View>
                  <View style={tw.fotosGrid}>
                    {perfil.fotos_trabajo.map((f, i) => (
                      <MotiView key={f.id || i} from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 60 }}>
                        <View style={tw.fotoWrap}>
                          <Image source={{ uri: f.url }} style={tw.fotoImg} />
                          <LinearGradient colors={['transparent','rgba(0,0,0,0.3)']} style={StyleSheet.absoluteFillObject} />
                        </View>
                      </MotiView>
                    ))}
                  </View>
                </View>
              </StaggeredItem>
            )}

            {/* Documentación */}
            <StaggeredItem index={7}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#0F766E','#0D9488']} style={tw.cardIconGrad}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Documentación</Text>
                </View>
                <View style={tw.verList}>
                  <View style={[tw.verItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={[tw.verIcon, { backgroundColor: '#E8F5E9' }]}><Ionicons name="card-outline" size={17} color="#2E7D32" /></View>
                    <Text style={[tw.verTxt, { color: colors.textPrimary }]}>Cédula de ciudadanía</Text>
                    <Ionicons name={u?.cedula ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.cedula ? '#2E7D32' : '#9CA3AF'} />
                  </View>
                  <View style={[tw.verItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={[tw.verIcon, { backgroundColor: identidadAprobada ? '#E8F5E9' : '#F3F4F6' }]}><Ionicons name="shield-checkmark-outline" size={17} color={identidadAprobada ? '#2E7D32' : '#9CA3AF'} /></View>
                    <Text style={[tw.verTxt, { color: colors.textPrimary }]}>Identidad verificada</Text>
                    <Ionicons name={identidadAprobada ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={identidadAprobada ? '#2E7D32' : '#9CA3AF'} />
                  </View>
                </View>
              </View>
            </StaggeredItem>

            {/* Acciones */}
            <StaggeredItem index={8}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.97} haptic>
                  <View style={[tw.actionIcon, { backgroundColor: '#FEF3ED' }]}><Ionicons name="create-outline" size={17} color="#C0694A" /></View>
                  <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Editar perfil</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </AnimatedPressable>
                <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={toggleMode} scaleValue={0.97} haptic>
                  <View style={[tw.actionIcon, { backgroundColor: isDark ? '#1a1a2e' : '#EFF6FF' }]}><Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color="#2563EB" /></View>
                  <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>{isDark ? 'Modo claro' : 'Modo oscuro'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </AnimatedPressable>
                <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('Pqrs')} scaleValue={0.97} haptic>
                  <View style={[tw.actionIcon, { backgroundColor: '#EFF6FF' }]}><Ionicons name="chatbox-ellipses-outline" size={17} color="#2563EB" /></View>
                  <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Peticiones, Quejas y Sugerencias</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </AnimatedPressable>
                <AnimatedPressable style={tw.actionRow} onPress={handleLogout} scaleValue={0.97} haptic hapticStyle="light">
                  <View style={[tw.actionIcon, { backgroundColor: '#FEE2E2' }]}><Ionicons name="log-out-outline" size={17} color="#EF4444" /></View>
                  <Text style={[tw.actionTxt, { color: '#EF4444' }]}>Cerrar sesión</Text>
                </AnimatedPressable>
              </View>
            </StaggeredItem>

          </View>
        </ScrollView>

        {/* Modal cámara */}
        <Modal visible={modalCamara} animationType="slide" statusBarTranslucent onRequestClose={() => setModalCamara(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={s.camaraHeader}>
              <TouchableOpacity onPress={() => { setModalCamara(false); setPreview(null); }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <Text style={s.camaraHeaderTxt}>Nueva foto de perfil</Text>
              <View style={{ width: 28 }} />
            </View>
            {!preview ? (
              <View style={{ flex: 1 }}>
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
                <View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }]}>
                  <View style={s.camaraGuia} />
                  <Text style={s.camaraGuiaTxt}>Centra tu cara</Text>
                </View>
                <View style={s.camaraBar}>
                  <TouchableOpacity onPress={escogerDeGaleria} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', position: 'absolute', left: 32, bottom: 24 }}>
                    <Ionicons name="images" size={24} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.camaraBtn} onPress={tomarFoto}>
                    <View style={s.camaraBtnInner} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="contain" />
                <View style={s.camaraAcciones}>
                  <TouchableOpacity style={s.camaraBtnRepetir} onPress={() => setPreview(null)}>
                    <Ionicons name="refresh" size={20} color="#fff" /><Text style={s.camaraBtnTxt}>Repetir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.camaraBtnConfirmar, subiendoFoto && { opacity: 0.6 }]} onPress={confirmarCambioFoto} disabled={subiendoFoto}>
                    {subiendoFoto ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={20} color="#fff" /><Text style={s.camaraBtnTxt}>Usar esta foto</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

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
          {/* Banner verificación finca */}
          {perfil?.verificacion_empresa_estado !== 'aprobada' && (
            <AnimatedPressable
              style={[
                s.verBanner,
                perfil?.verificacion_empresa_estado === 'pendiente'
                  ? s.verBannerPendiente
                  : perfil?.verificacion_empresa_estado === 'rechazada'
                  ? s.verBannerRechazada
                  : s.verBannerDefault,
              ]}
              onPress={perfil?.verificacion_empresa_estado !== 'pendiente' ? subirDocumentoEmpresa : undefined}
              activeOpacity={0.85}
              scaleValue={0.98}
            >
              <View style={s.verBannerIconWrap}>
                <Ionicons
                  name={
                    perfil?.verificacion_empresa_estado === 'pendiente' ? 'time-outline'
                    : perfil?.verificacion_empresa_estado === 'rechazada' ? 'alert-circle-outline'
                    : 'shield-outline'
                  }
                  size={26}
                  color={
                    perfil?.verificacion_empresa_estado === 'pendiente' ? '#B45309'
                    : perfil?.verificacion_empresa_estado === 'rechazada' ? '#B91C1C'
                    : COLORS.primary
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[
                  s.verBannerTitle,
                  { color: perfil?.verificacion_empresa_estado === 'pendiente' ? '#92400E'
                    : perfil?.verificacion_empresa_estado === 'rechazada' ? '#991B1B'
                    : '#14532D' }
                ]}>
                  {perfil?.verificacion_empresa_estado === 'pendiente'
                    ? 'Verificación en revisión'
                    : perfil?.verificacion_empresa_estado === 'rechazada'
                    ? 'Verificación rechazada'
                    : 'Verifica tu finca para contratar'}
                </Text>
                <Text style={[
                  s.verBannerSub,
                  { color: perfil?.verificacion_empresa_estado === 'pendiente' ? '#92400E'
                    : perfil?.verificacion_empresa_estado === 'rechazada' ? '#991B1B'
                    : '#166534' }
                ]}>
                  {perfil?.verificacion_empresa_estado === 'pendiente'
                    ? 'Tu documento está siendo revisado por el equipo de TerraEmpleo.'
                    : perfil?.verificacion_empresa_estado === 'rechazada'
                    ? `Motivo: ${perfil.verificacion_empresa_comentario || 'Documento no válido'}. Toca para reenviar.`
                    : 'Por la seguridad de los trabajadores que visitan tu finca, sube tu RUT, RNT o factura de servicios públicos. Esta información es confidencial y solo la usamos para verificar tu empresa. Toca para subir.'}
                </Text>
              </View>
              {perfil?.verificacion_empresa_estado !== 'pendiente' && (
                <Ionicons name="chevron-forward" size={18} color={perfil?.verificacion_empresa_estado === 'rechazada' ? '#B91C1C' : COLORS.primary} />
              )}
            </AnimatedPressable>
          )}

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
                <Text style={s.heroPlaceholderText}>Toca el botón de cámara para subir la foto de tu finca.</Text>
              </View>
            )}
            {esEmpleador && (
              <TouchableOpacity
                onPress={subirFotoFinca}
                disabled={subiendoFotoFinca}
                style={s.heroFotoBtn}
              >
                {subiendoFotoFinca
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="camera" size={18} color="#FFF" />}
              </TouchableOpacity>
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

          <View style={[s.empCard, { backgroundColor: colors.surface }]}>
            {/* Avatar centered above card — spring entrance */}
            <MotiView
              from={{ scale: 0.5, opacity: 0, translateY: 20 }}
              animate={{ scale: 1, opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 100 }}
            >
              <View style={s.empAvatarRow}>
                <View style={s.empAvatarWrap}>
                  {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
                    <Image source={{ uri: u.foto_selfie }} style={[s.empAvatar, { borderColor: colors.surface }]} />
                  ) : (
                    <View style={[s.empAvatarFallback, { borderColor: colors.surface, backgroundColor: isDark ? colors.surface : '#F3F4F6' }]}><Ionicons name="person" size={44} color={COLORS.textLight} /></View>
                  )}
                  {identidadAprobada && <View style={s.empBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>}
                </View>
              </View>
            </MotiView>

            <FadeInView delay={200}>
              <Text style={[s.empName, { color: colors.textPrimary }]}>{u?.nombre_completo}</Text>
            </FadeInView>
            <FadeInView delay={250}>
              <Text style={s.empFinca}>🏠 {empresa}</Text>
            </FadeInView>
            {ubicacion && (
              <FadeInView delay={300}>
                <Text style={[s.empLoc, { color: colors.textSecondary }]}>📍 {ubicacion}</Text>
              </FadeInView>
            )}

            {/* 3 stats with animated numbers */}
            <StaggeredItem index={0}>
              <View style={[s.empStats, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}>
                <View style={s.empStatItem}>
                  <AnimatedNumber
                    value={calificacion > 0 ? `★ ${calificacion.toFixed(1)}` : '—'}
                    style={[s.empStatVal, { color: colors.textPrimary }]}
                  />
                  <Text style={[s.empStatLabel, { color: colors.textSecondary }]}>RATING</Text>
                </View>
                <View style={[s.empStatDiv, { backgroundColor: colors.border }]} />
                <View style={s.empStatItem}>
                  <AnimatedNumber value={u?.total_vacantes || 0} style={[s.empStatVal, { color: colors.textPrimary }]} />
                  <Text style={[s.empStatLabel, { color: colors.textSecondary }]}>VACANTES</Text>
                </View>
                <View style={[s.empStatDiv, { backgroundColor: colors.border }]} />
                <View style={s.empStatItem}>
                  <AnimatedNumber
                    value={u?.verificado_sms ? '✓' : '—'}
                    style={[s.empStatVal, { color: COLORS.primary }]}
                  />
                  <Text style={[s.empStatLabel, { color: colors.textSecondary }]}>VERIFICADO</Text>
                </View>
              </View>
            </StaggeredItem>

            {/* Sobre la finca */}
            {perfil?.nombre_empresa_finca && (
              <StaggeredItem index={1}>
                <View style={s.secWrap}>
                  <View style={s.secHead}><View style={s.secIcon}><Ionicons name="leaf-outline" size={16} color={COLORS.primary} /></View><Text style={[s.secTitle, { color: colors.textPrimary }]}>Sobre la Finca</Text></View>
                  {acercaDeEmpleador ? (
                    <Text style={[s.secText, { color: colors.textSecondary }]}>{acercaDeEmpleador}</Text>
                  ) : (
                    <Text style={[s.secTextMuted, { color: colors.textMuted }]}>
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
                  <Text style={[s.secTitle, { color: colors.textPrimary }]}>Cultivos Principales</Text>
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
                <Text style={[s.secTitle, { color: colors.textPrimary }]}>Información Verificada</Text>
                <View style={s.verList}>
                  {(() => {
                    const ve = perfil?.verificacion_empresa_estado || 'sin_enviar';
                    const veAprobada = ve === 'aprobada';
                    const vePendiente = ve === 'pendiente';
                    const veRechazada = ve === 'rechazada';
                    const veIcon = veAprobada ? 'checkmark-circle' : vePendiente ? 'time-outline' : veRechazada ? 'close-circle' : 'cloud-upload-outline';
                    const veColor = veAprobada ? COLORS.primary : vePendiente ? '#F59E0B' : veRechazada ? '#EF4444' : COLORS.textLight;
                    return (
                      <TouchableOpacity
                        style={[s.verItem, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}
                        onPress={!veAprobada && !vePendiente ? subirDocumentoEmpresa : undefined}
                        activeOpacity={!veAprobada && !vePendiente ? 0.7 : 1}
                        disabled={subiendoDocEmpresa}
                      >
                        <View style={s.verIcon}><Ionicons name="document-text-outline" size={18} color={COLORS.primary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.verText, { color: colors.textPrimary }]}>Registro Empresarial</Text>
                          {!veAprobada && (
                            <Text style={{ fontSize: 11, color: veColor, marginTop: 1 }}>
                              {vePendiente ? 'En revisión...' : veRechazada ? `Rechazado: ${perfil.verificacion_empresa_comentario || 'Ver detalles'}` : 'Toca para subir RUT, RNT o factura de servicios públicos'}
                            </Text>
                          )}
                        </View>
                        {subiendoDocEmpresa
                          ? <ActivityIndicator size="small" color={COLORS.primary} />
                          : <Ionicons name={veIcon} size={20} color={veColor} />}
                      </TouchableOpacity>
                    );
                  })()}
                  <View style={[s.verItem, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}>
                    <View style={s.verIcon}><Ionicons name="call-outline" size={18} color={COLORS.primary} /></View>
                    <Text style={[s.verText, { color: colors.textPrimary }]}>Teléfono Verificado</Text>
                    <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <View style={[s.verItem, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}>
                    <View style={s.verIcon}><Ionicons name="location-outline" size={18} color={COLORS.primary} /></View>
                    <Text style={[s.verText, { color: colors.textPrimary }]}>Ubicación de la Finca</Text>
                    <Ionicons name={ubicacion ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={ubicacion ? COLORS.primary : COLORS.textLight} />
                  </View>
                </View>
              </View>
            </StaggeredItem>

            {/* Editar Perfil */}
            <StaggeredItem index={4}>
              <AnimatedPressable style={s.ctaBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.96} haptic>
                <Ionicons name="create-outline" size={20} color={COLORS.primary} />
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
              <AnimatedPressable style={s.pqrsRow} onPress={() => navigation.navigate('Pqrs')} scaleValue={0.97} haptic>
                <Ionicons name="chatbox-ellipses-outline" size={16} color={COLORS.textSecondary} />
                <Text style={s.pqrsRowTxt}>Peticiones, Quejas y Sugerencias</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
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
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── HERO ── */}
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 400 }}>
          <LinearGradient colors={['#1B5E20', '#2E7D32', '#43A047']} style={[tw.hero, { paddingTop: (insets?.top || 0) + 52 }]}>
            {/* Top bar sobre el gradiente */}
            <View style={tw.heroTopBar}>
              <View style={{ width: 40 }} />
              <Text style={tw.heroTopTitle}>Mi Perfil</Text>
              <AnimatedPressable style={tw.settingsBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.88} haptic>
                <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
              </AnimatedPressable>
            </View>

            {/* Avatar */}
            <MotiView from={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 150 }}>
              <TouchableOpacity onPress={abrirCamaraFoto} activeOpacity={0.8} style={tw.avatarOuter}>
                {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
                  <Image source={{ uri: u.foto_selfie }} style={tw.avatar} />
                ) : (
                  <View style={tw.avatarFallback}><Ionicons name="person" size={44} color="rgba(255,255,255,0.7)" /></View>
                )}
                {identidadAprobada && <View style={tw.verBadge}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                <View style={tw.camBadge}><Ionicons name={puedeCambiarFoto ? 'camera' : 'time-outline'} size={11} color="#fff" /></View>
              </TouchableOpacity>
            </MotiView>

            <FadeInView delay={220}>
              <Text style={tw.heroName}>{u?.nombre_completo || 'Tu nombre'}</Text>
            </FadeInView>
            <FadeInView delay={260}>
              <View style={tw.heroPills}>
                {ubicacionT ? (
                  <View style={tw.heroPill}><Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.85)" /><Text style={tw.heroPillTxt}>{ubicacionT}</Text></View>
                ) : null}
                {disponibilidad ? (
                  <View style={[tw.heroPill, { backgroundColor: 'rgba(255,255,255,0.18)' }]}><Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.85)" /><Text style={tw.heroPillTxt}>{disponibilidad}</Text></View>
                ) : null}
              </View>
            </FadeInView>

            {/* Floating stats card */}
            <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 320 }} style={tw.statsCard}>
              <View style={tw.statItem}>
                <Ionicons name="star" size={20} color="#FFB300" />
                <Text style={tw.statNum}>{calificacion > 0 ? calificacion.toFixed(1) : '—'}</Text>
                <Text style={tw.statLbl}>Calificación</Text>
              </View>
              <View style={tw.statDivider} />
              <View style={tw.statItem}>
                <Ionicons name="chatbubble-outline" size={20} color="#2196F3" />
                <Text style={tw.statNum}>{totalCalif}</Text>
                <Text style={tw.statLbl}>Reseñas</Text>
              </View>
              <View style={tw.statDivider} />
              <View style={tw.statItem}>
                <Ionicons name="briefcase-outline" size={20} color="#43A047" />
                <Text style={tw.statNum}>{experiencia ? experiencia.split(' ').slice(0,2).join(' ') : '—'}</Text>
                <Text style={tw.statLbl}>Experiencia</Text>
              </View>
            </MotiView>
          </LinearGradient>
        </MotiView>

        <View style={{ paddingHorizontal: SPACING.md, paddingTop: 52 }}>

          {/* Banner mejora tu perfil */}
          {(!acercaDeTrabajador || !perfil?.hoja_vida_url || !(perfil?.fotos_trabajo?.length > 0) || !(perfil?.experiencias?.length > 0)) && (
            <FadeInView delay={80}>
              <AnimatedPressable
                style={[mejoraStyles.banner, { backgroundColor: isDark ? '#1a2f22' : '#EBF5ED', borderColor: isDark ? '#2a4c3a' : '#B8DFBC' }]}
                onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })}
                scaleValue={0.98} haptic
              >
                <View style={[mejoraStyles.iconWrap, { backgroundColor: COLORS.primary }]}>
                  <Ionicons name="trending-up" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[mejoraStyles.title, { color: isDark ? '#7CCC8A' : COLORS.primary }]}>¡Mejora tu perfil!</Text>
                  <View style={mejoraStyles.itemsRow}>
                    {!acercaDeTrabajador && (
                      <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color={COLORS.primary} /><Text style={[mejoraStyles.itemText, { color: isDark ? '#9DCBA6' : '#2E7D32' }]}>Agrega un "Acerca de ti"</Text></View>
                    )}
                    {!(perfil?.fotos_trabajo?.length > 0) && (
                      <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color={COLORS.primary} /><Text style={[mejoraStyles.itemText, { color: isDark ? '#9DCBA6' : '#2E7D32' }]}>Sube fotos de tu trabajo</Text></View>
                    )}
                    {!(perfil?.experiencias?.length > 0) && (
                      <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color={COLORS.primary} /><Text style={[mejoraStyles.itemText, { color: isDark ? '#9DCBA6' : '#2E7D32' }]}>Agrega experiencias laborales</Text></View>
                    )}
                    {!perfil?.hoja_vida_url && (
                      <View style={mejoraStyles.item}><Ionicons name="ellipse" size={6} color={COLORS.primary} /><Text style={[mejoraStyles.itemText, { color: isDark ? '#9DCBA6' : '#2E7D32' }]}>Adjunta tu hoja de vida</Text></View>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </AnimatedPressable>
            </FadeInView>
          )}

          {/* ── ACERCA DE ── */}
          {acercaDeTrabajador ? (
            <StaggeredItem index={0}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#1565C0','#1E88E5']} style={tw.cardIconGrad}>
                    <Ionicons name="document-text-outline" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Acerca de mí</Text>
                </View>
                <Text style={[tw.cardBody, { color: colors.textSecondary }]}>{acercaDeTrabajador}</Text>
              </View>
            </StaggeredItem>
          ) : null}

          {/* ── HOJA DE VIDA ── */}
          {perfil?.hoja_vida_url ? (
            <StaggeredItem index={1}>
              <AnimatedPressable style={[tw.cvCard, { backgroundColor: isDark ? '#1a3c2c' : '#E8F5E9' }]} onPress={() => abrirDocumento(perfil.hoja_vida_url)} scaleValue={0.97} haptic={false}>
                <LinearGradient colors={['#2E7D32','#43A047']} style={tw.cvIconGrad}>
                  <Ionicons name="document-text" size={18} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[tw.cvTitle, { color: colors.textPrimary }]}>Hoja de vida</Text>
                  <Text style={[tw.cvName, { color: colors.textMuted }]} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
                </View>
                <View style={tw.cvBadge}><Ionicons name="open-outline" size={14} color="#2E7D32" /><Text style={tw.cvBadgeTxt}>Abrir</Text></View>
              </AnimatedPressable>
            </StaggeredItem>
          ) : null}

          {/* ── CULTIVOS Y HABILIDADES ── */}
          {(cultivos.length > 0 || habilidades.length > 0) && (
            <StaggeredItem index={2}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#2E7D32','#66BB6A']} style={tw.cardIconGrad}>
                    <Ionicons name="leaf" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Cultivos y Habilidades</Text>
                </View>
                {cultivos.length > 0 && (
                  <>
                    <Text style={[tw.chipGroupLbl, { color: colors.textMuted }]}>CULTIVOS</Text>
                    <View style={tw.chipRow}>
                      {cultivos.map((c, i) => (
                        <MotiView key={i} from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 35 }}>
                          <View style={tw.chipGreen}><Ionicons name="leaf" size={11} color="#2E7D32" /><Text style={tw.chipGreenTxt}>{c}</Text></View>
                        </MotiView>
                      ))}
                    </View>
                  </>
                )}
                {habilidades.length > 0 && (
                  <>
                    <Text style={[tw.chipGroupLbl, { color: colors.textMuted, marginTop: cultivos.length > 0 ? 10 : 0 }]}>HABILIDADES</Text>
                    <View style={tw.chipRow}>
                      {habilidades.map((h, i) => (
                        <MotiView key={i} from={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: (cultivos.length + i) * 35 }}>
                          <View style={[tw.chipOutline, { borderColor: colors.border, backgroundColor: colors.background }]}><Ionicons name="construct-outline" size={11} color={colors.textMuted} /><Text style={[tw.chipOutlineTxt, { color: colors.textSecondary }]}>{h}</Text></View>
                        </MotiView>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </StaggeredItem>
          )}

          {/* ── EXPERIENCIA GENERAL Y FORMACIÓN ── */}
          {(experiencia || estudios || perfil?.titulo_estudio) && (
            <StaggeredItem index={3}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#1565C0','#1976D2']} style={tw.cardIconGrad}>
                    <Ionicons name="school-outline" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Experiencia y Formación</Text>
                </View>
                {experiencia && (
                  <View style={[tw.expRow, { borderBottomColor: colors.border, borderBottomWidth: estudios || perfil?.titulo_estudio ? 1 : 0 }]}>
                    <View style={[tw.expDot, { backgroundColor: '#D1FAE5' }]}><Ionicons name="time-outline" size={15} color="#059669" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tw.expLbl, { color: colors.textMuted }]}>Experiencia agrícola</Text>
                      <Text style={[tw.expVal, { color: colors.textPrimary }]}>{experiencia}</Text>
                    </View>
                  </View>
                )}
                {estudios && (
                  <View style={[tw.expRow, { borderBottomColor: colors.border, borderBottomWidth: perfil?.titulo_estudio ? 1 : 0 }]}>
                    <View style={[tw.expDot, { backgroundColor: '#DBEAFE' }]}><Ionicons name="school-outline" size={15} color="#2563EB" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tw.expLbl, { color: colors.textMuted }]}>Nivel de estudios</Text>
                      <Text style={[tw.expVal, { color: colors.textPrimary }]}>{estudios}</Text>
                    </View>
                  </View>
                )}
                {perfil?.titulo_estudio && (
                  <View style={[tw.expRow, { borderBottomWidth: 0 }]}>
                    <View style={[tw.expDot, { backgroundColor: '#F3E8FF' }]}><Ionicons name="ribbon-outline" size={15} color="#7C3AED" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[tw.expLbl, { color: colors.textMuted }]}>Título</Text>
                      <Text style={[tw.expVal, { color: colors.textPrimary }]}>{perfil.titulo_estudio}</Text>
                    </View>
                  </View>
                )}
              </View>
            </StaggeredItem>
          )}

          {/* ── EXPERIENCIAS LABORALES — TIMELINE ── */}
          {(perfil?.experiencias || []).length > 0 && (
            <StaggeredItem index={4}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#7C3AED','#6D28D9']} style={tw.cardIconGrad}>
                    <Ionicons name="briefcase" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Experiencias laborales</Text>
                  <Text style={[tw.cardCount, { color: colors.textMuted }]}>{perfil.experiencias.length}</Text>
                </View>
                {/* Timeline vertical */}
                <View style={tw.tlWrap}>
                  {perfil.experiencias.map((exp, i) => (
                    <MotiView key={exp.id || i} from={{ opacity: 0, translateX: -12 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 80 }}>
                      <View style={tw.tlRow}>
                        {/* Línea + dot */}
                        <View style={tw.tlTrack}>
                          <View style={[tw.tlDot, { backgroundColor: EXP_COLORS[i % EXP_COLORS.length].dot }]}>
                            <Ionicons name="business-outline" size={11} color="#fff" />
                          </View>
                          {i < perfil.experiencias.length - 1 && <View style={[tw.tlLine, { backgroundColor: colors.border }]} />}
                        </View>
                        {/* Contenido */}
                        <View style={[tw.tlCard, { backgroundColor: EXP_COLORS[i % EXP_COLORS.length].bg, borderColor: EXP_COLORS[i % EXP_COLORS.length].border }]}>
                          <Text style={[tw.tlEntidad, { color: colors.textPrimary }]}>{exp.entidad}</Text>
                          {!!exp.duracion && (
                            <View style={tw.tlDuracionRow}>
                              <Ionicons name="time-outline" size={12} color={EXP_COLORS[i % EXP_COLORS.length].dot} />
                              <Text style={[tw.tlDuracion, { color: EXP_COLORS[i % EXP_COLORS.length].dot }]}>{exp.duracion}</Text>
                            </View>
                          )}
                          {!!exp.descripcion && <Text style={[tw.tlDesc, { color: colors.textSecondary }]}>{exp.descripcion}</Text>}
                        </View>
                      </View>
                    </MotiView>
                  ))}
                </View>
              </View>
            </StaggeredItem>
          )}

          {/* ── FOTOS DE TRABAJO ── */}
          {(perfil?.fotos_trabajo || []).length > 0 && (
            <StaggeredItem index={5}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#B45309','#D97706']} style={tw.cardIconGrad}>
                    <Ionicons name="images-outline" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Fotos de trabajo</Text>
                  <Text style={[tw.cardCount, { color: colors.textMuted }]}>{perfil.fotos_trabajo.length}</Text>
                </View>
                <View style={tw.fotosGrid}>
                  {perfil.fotos_trabajo.map((f, i) => (
                    <MotiView key={f.id || i} from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 60 }}>
                      <View style={tw.fotoWrap}>
                        <Image source={{ uri: f.url }} style={tw.fotoImg} />
                        <LinearGradient colors={['transparent','rgba(0,0,0,0.3)']} style={StyleSheet.absoluteFillObject} />
                      </View>
                    </MotiView>
                  ))}
                </View>
              </View>
            </StaggeredItem>
          )}

          {/* ── DOCUMENTACIÓN ── */}
          <StaggeredItem index={6}>
            <View style={[tw.card, { backgroundColor: colors.surface }]}>
              <View style={tw.cardHeader}>
                <LinearGradient colors={['#0F766E','#0D9488']} style={tw.cardIconGrad}>
                  <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Documentación</Text>
              </View>
              <View style={tw.verList}>
                <View style={[tw.verItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[tw.verIcon, { backgroundColor: '#E8F5E9' }]}><Ionicons name="card-outline" size={17} color="#2E7D32" /></View>
                  <Text style={[tw.verTxt, { color: colors.textPrimary }]}>Cédula de ciudadanía</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                </View>
                <View style={[tw.verItem, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={[tw.verIcon, { backgroundColor: u?.verificado_sms ? '#E8F5E9' : '#F3F4F6' }]}><Ionicons name="call-outline" size={17} color={u?.verificado_sms ? '#2E7D32' : '#9CA3AF'} /></View>
                  <Text style={[tw.verTxt, { color: colors.textPrimary }]}>Teléfono verificado</Text>
                  <Ionicons name={u?.verificado_sms ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={u?.verificado_sms ? '#2E7D32' : '#9CA3AF'} />
                </View>
              </View>
            </View>
          </StaggeredItem>

          {/* ── ACCIONES ── */}
          <StaggeredItem index={7}>
            <View style={[tw.card, { backgroundColor: colors.surface }]}>
              <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} scaleValue={0.97} haptic>
                <View style={[tw.actionIcon, { backgroundColor: '#E8F5E9' }]}><Ionicons name="create-outline" size={17} color="#2E7D32" /></View>
                <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Editar perfil</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
              <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={toggleMode} scaleValue={0.97} haptic>
                <View style={[tw.actionIcon, { backgroundColor: isDark ? '#1a2f22' : '#E8F5E9' }]}><Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={17} color="#2E7D32" /></View>
                <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>{isDark ? 'Modo claro' : 'Modo oscuro'}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
              <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('Pqrs')} scaleValue={0.97} haptic>
                <View style={[tw.actionIcon, { backgroundColor: '#EFF6FF' }]}><Ionicons name="chatbox-ellipses-outline" size={17} color="#2563EB" /></View>
                <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Peticiones, Quejas y Sugerencias</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
              <AnimatedPressable style={tw.actionRow} onPress={handleLogout} scaleValue={0.97} haptic hapticStyle="light">
                <View style={[tw.actionIcon, { backgroundColor: '#FEE2E2' }]}><Ionicons name="log-out-outline" size={17} color="#EF4444" /></View>
                <Text style={[tw.actionTxt, { color: '#EF4444' }]}>Cerrar sesión</Text>
              </AnimatedPressable>
            </View>
          </StaggeredItem>

        </View>
      </ScrollView>

      {/* Modal cámara para cambio de foto de perfil */}
      <Modal visible={modalCamara} animationType="slide" statusBarTranslucent onRequestClose={() => setModalCamara(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={s.camaraHeader}>
            <TouchableOpacity onPress={() => { setModalCamara(false); setPreview(null); }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={s.camaraHeaderTxt}>Nueva foto de perfil</Text>
            <View style={{ width: 28 }} />
          </View>

          {!preview ? (
            <View style={{ flex: 1 }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
              <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
                <View style={s.camaraGuia} />
                <Text style={s.camaraGuiaTxt}>Centra tu cara</Text>
              </View>
              <View style={s.camaraBar}>
                <TouchableOpacity
                  onPress={escogerDeGaleria}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'absolute',
                    left: 32,
                    bottom: 24,
                  }}
                  accessibilityLabel="Subir desde galería"
                >
                  <Ionicons name="images" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.camaraBtn} onPress={tomarFoto}>
                  <View style={s.camaraBtnInner} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="contain" />
              <View style={s.camaraAcciones}>
                <TouchableOpacity style={s.camaraBtnRepetir} onPress={() => setPreview(null)}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <Text style={s.camaraBtnTxt}>Repetir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.camaraBtnConfirmar, subiendoFoto && { opacity: 0.6 }]} onPress={confirmarCambioFoto} disabled={subiendoFoto}>
                  {subiendoFoto ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                      <Text style={s.camaraBtnTxt}>Usar esta foto</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

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
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.primarySoft },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.primarySoft, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 2, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  camaraBadge: { position: 'absolute', bottom: 2, left: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#555', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  camaraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.8)' },
  camaraHeaderTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  camaraGuia: { width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: '#fff', backgroundColor: 'transparent' },
  camaraGuiaTxt: { color: '#fff', marginTop: 12, fontSize: 14, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  camaraBar: { paddingVertical: 32, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  camaraBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  camaraBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  camaraAcciones: { flexDirection: 'row', padding: 20, gap: 12, backgroundColor: 'rgba(0,0,0,0.8)' },
  camaraBtnRepetir: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  camaraBtnConfirmar: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.primary },
  camaraBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '600' },
  fullName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 6 },
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
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.full },
  ctaBtnTxt: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
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
  pqrsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: SPACING.md, marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, backgroundColor: 'transparent' },
  pqrsRowTxt: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textSecondary },
  logoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.error, borderRadius: RADIUS.full },
  logoutTxt: { fontSize: 14, fontWeight: '600', color: COLORS.error },

  /* ── EMPLEADOR ── */
  verBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 4,
    borderRadius: RADIUS.lg, padding: SPACING.md,
    borderWidth: 1.5,
  },
  verBannerDefault: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  verBannerPendiente: { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  verBannerRechazada: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  verBannerIconWrap: { paddingTop: 2 },
  verBannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  verBannerSub: { fontSize: 12, lineHeight: 17 },

  heroWrap: { width: '100%', height: HERO_H, position: 'relative' },
  heroImg: { width: '100%', height: HERO_H },
  heroPlaceholder: { width: '100%', height: HERO_H, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  heroLeaf: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryMuted, justifyContent: 'center', alignItems: 'center' },
  heroPlaceholderText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  heroFotoBtn: { position: 'absolute', bottom: 12, right: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  heroBar: { position: 'absolute', left: SPACING.md, right: SPACING.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  heroCircleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', ...SHADOWS.medium },

  empCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -32, paddingHorizontal: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.lg },
  empAvatarRow: { alignItems: 'center', marginTop: -40 },
  empAvatarWrap: { position: 'relative' },
  empAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.white },
  empAvatarFallback: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.white, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  empBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  empName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginTop: SPACING.sm },
  empFinca: { fontSize: 15, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginTop: 4 },
  empLoc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: SPACING.md },

  empStats: { flexDirection: 'row', backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: SPACING.lg },
  empStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  empStatVal: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  empStatLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  empStatDiv: { width: 1, backgroundColor: COLORS.borderLight },

  espRolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: 6 },
  espRolePillTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  // ── Especialista styles ──
  avatarFallbackLg: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  profileName: { fontSize: 22, fontWeight: '800', marginTop: SPACING.sm, textAlign: 'center' },
  profileRole: { fontSize: 14, marginTop: 2, textAlign: 'center' },
  verBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: RADIUS.full, marginTop: SPACING.sm },
  verBadgeTxt: { fontSize: 12, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  bioText: { fontSize: 14, lineHeight: 22 },
  infoRowText: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderBottomWidth: 1 },
  docLabel: { flex: 1, fontSize: 14 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1.5, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, marginBottom: SPACING.sm },
  editBtnTxt: { fontSize: 15, fontWeight: '700' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderWidth: 1.5, borderRadius: RADIUS.lg, paddingVertical: SPACING.md },
  logoutBtnTxt: { fontSize: 15, fontWeight: '700' },
});


const mejoraStyles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  itemsRow: { gap: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemText: { fontSize: 12, fontWeight: '500' },
});

const tw = StyleSheet.create({
  // Hero
  hero: { paddingTop: 52, paddingBottom: 90, alignItems: 'center', paddingHorizontal: SPACING.md },
  heroTopBar: { position: 'absolute', top: 14, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md },
  heroTopTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  avatarOuter: { width: 94, height: 94, borderRadius: 47, borderWidth: 3, borderColor: 'rgba(255,255,255,0.6)', overflow: 'visible', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  verBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#43A047', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  camBadge: { position: 'absolute', bottom: 2, left: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6, textAlign: 'center' },
  heroPills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroPillTxt: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  statsCard: { position: 'absolute', bottom: -44, left: SPACING.md, right: SPACING.md, backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', paddingVertical: 14, ...SHADOWS.medium },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statNum: { fontSize: 16, fontWeight: '800', color: '#111827' },
  statLbl: { fontSize: 10, color: '#6B7280', fontWeight: '600', letterSpacing: 0.3 },
  statDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },
  // Cards
  card: { borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.light },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardIconGrad: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardCount: { fontSize: 12, fontWeight: '600', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  cardBody: { fontSize: 14, lineHeight: 21 },
  // CV
  cvCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: SPACING.md, marginBottom: SPACING.sm, gap: 12, ...SHADOWS.light },
  cvIconGrad: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cvTitle: { fontSize: 14, fontWeight: '700' },
  cvName: { fontSize: 12, marginTop: 2 },
  cvBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cvBadgeTxt: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  // Chips
  chipGroupLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipGreen: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipGreenTxt: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  chipOutline: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipOutlineTxt: { fontSize: 12, fontWeight: '500' },
  // Experiencia formación
  expRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  expDot: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  expLbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2 },
  expVal: { fontSize: 14, fontWeight: '700' },
  // Timeline experiencias laborales
  tlWrap: { paddingTop: 4 },
  tlRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  tlTrack: { alignItems: 'center', width: 28 },
  tlDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tlLine: { width: 2, flex: 1, minHeight: 16, borderRadius: 1, marginTop: 4 },
  tlCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 8 },
  tlEntidad: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  tlDuracionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  tlDuracion: { fontSize: 12, fontWeight: '600' },
  tlDesc: { fontSize: 12, lineHeight: 17 },
  // Fotos
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  fotoWrap: { width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: 12, overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%' },
  // Documentación
  verList: { gap: 8 },
  verItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  verIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  verTxt: { flex: 1, fontSize: 14, fontWeight: '500' },
  // Acciones
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { flex: 1, fontSize: 14, fontWeight: '500' },
});
