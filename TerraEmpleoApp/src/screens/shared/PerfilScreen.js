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
import { authAPI, calificacionesAPI, certificadosAPI } from '../../services/api';
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

  const [fotoPortada, setFotoPortada] = useState(null);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [resenias, setResenias] = useState([]);
  const [certificados, setCertificados] = useState([]);

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

  const subirFotoFinca = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) await _uploadFotoFinca(r.assets[0].uri);
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
      let path;
      if (Platform.OS === 'web') {
        const { api } = require('../../services/api');
        const token = api.defaults.headers.common['Authorization']?.replace('Bearer ', '');
        const fetchRes = await fetch(`${api.defaults.baseURL}/auth/fotos/finca_fachada`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const json = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(json.error || 'Error al subir');
        path = json.path;
      } else {
        const res = await authAPI.subirFoto('finca_fachada', formData);
        path = res.data.path;
      }
      setFotoFincaPrincipal(path);
      showAlert('Foto actualizada', 'La foto de tu finca fue guardada.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendoFotoFinca(false);
    }
  };
  const subirPortadaTrabajador = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, aspect: [16, 9], allowsEditing: true });
    if (r.canceled || !r.assets?.[0]) return;
    setSubiendoPortada(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(r.assets[0].uri)).blob();
        formData.append('foto', blob, `portada_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri: r.assets[0].uri, type: 'image/jpeg', name: `portada_${Date.now()}.jpg` });
      }
      let path;
      if (Platform.OS === 'web') {
        const { api } = require('../../services/api');
        const token = api.defaults.headers.common['Authorization']?.replace('Bearer ', '');
        const fetchRes = await fetch(`${api.defaults.baseURL}/auth/fotos/portada`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        const json = await fetchRes.json();
        if (!fetchRes.ok) throw new Error(json.error || 'Error al subir');
        path = json.path;
      } else {
        const res = await authAPI.subirFoto('portada', formData);
        path = res.data.path;
      }
      setFotoPortada(path);
      showAlert('¡Listo!', 'Foto de portada actualizada.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendoPortada(false);
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
      if (res.data?.user?.foto_portada) {
        setFotoPortada(res.data.user.foto_portada);
      }
      const uid = res.data?.user?.id;
      if (uid) {
        try {
          const rRes = await calificacionesAPI.obtener(uid);
          setResenias(rRes.data?.calificaciones || []);
        } catch (_) {}
        try {
          const cRes = await certificadosAPI.listar();
          setCertificados(cRes.data?.certificados || []);
        } catch (_) {}
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
            <View style={[tw.hero, { paddingTop: (insets?.top || 0) + 52, overflow: 'hidden' }]}>
              {/* Portada */}
              {fotoPortada
                ? <Image source={{ uri: fotoPortada }} style={tw.heroPortadaImg} resizeMode="cover" />
                : <LinearGradient colors={['#8B3A2A', '#C0694A', '#D4845A']} style={StyleSheet.absoluteFill} />
              }
              <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <View style={tw.heroTopBar}>
                <View style={{ width: 40 }} />
                <Text style={tw.heroTopTitle}>Mi Perfil</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={[tw.settingsBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={subirPortadaTrabajador} disabled={subiendoPortada} activeOpacity={0.75}>
                    {subiendoPortada ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="image-outline" size={18} color="#fff" />}
                  </TouchableOpacity>
                  <TouchableOpacity style={tw.settingsBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.75}>
                    <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                </View>
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

            </View>
          </MotiView>

          {/* Stats card especialista */}
          <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 320 }}
            style={[tw.statsCard, { marginHorizontal: SPACING.md, marginTop: -28, zIndex: 10 }]}>
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

          <View style={{ paddingHorizontal: SPACING.md, paddingTop: 16 }}>

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
                <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('MisServicios')} scaleValue={0.97} haptic>
                  <View style={[tw.actionIcon, { backgroundColor: '#FFF7ED' }]}><Ionicons name="briefcase-outline" size={17} color="#D97706" /></View>
                  <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Mis Servicios</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </AnimatedPressable>
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
    const empresa = perfil?.nombre_empresa_finca || u?.nombre_completo || 'Mi Finca';
    const tipoPago = perfil?.tipo_pago ? (LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago) : null;
    const ubicacion = [u?.municipio, u?.departamento].filter(Boolean).join(', ') || null;
    const cultivosEmp = (perfil?.cultivos || []).map(c => c.cultivo || c);
    const labores = (perfil?.labores || []).map(l => l.labor || l);
    const beneficios = [
      perfil?.ofrece_alojamiento && 'Alojamiento incluido',
      perfil?.ofrece_alimentacion && 'Alimentación incluida',
    ].filter(Boolean);
    const acercaDeEmpleador = perfil?.acerca_de?.trim();
    const veEmp = perfil?.verificacion_empresa_estado || 'sin_enviar';

    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

          {/* ── HERO ── */}
          <View style={[empS.hero, { paddingTop: (insets?.top || 0) + 52, overflow: 'hidden' }]}>
            {fotoFincaPrincipal
              ? <Image source={{ uri: fotoFincaPrincipal }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              : <LinearGradient colors={['#1B5E20','#2E7D32','#43A047']} style={StyleSheet.absoluteFillObject} />
            }
            <LinearGradient colors={['rgba(0,0,0,0.15)','rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

            {/* Top bar */}
            <View style={empS.heroTopBar}>
              <View style={{ width: 44 }} />
              <Text style={empS.heroTitle}>Mi Perfil</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={empS.heroBtn} onPress={subirFotoFinca} disabled={subiendoFotoFinca} activeOpacity={0.8}>
                  {subiendoFotoFinca ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera-outline" size={18} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity style={empS.heroBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.8}>
                  <Ionicons name="settings-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Avatar + info dentro del hero — centrado */}
            <View style={empS.heroBody}>
              <TouchableOpacity onPress={abrirCamaraFoto} activeOpacity={0.85} style={empS.avatarWrap}>
                {u?.foto_selfie?.startsWith('http')
                  ? <Image source={{ uri: u.foto_selfie }} style={empS.avatar} />
                  : <View style={empS.avatarFallback}><Ionicons name="person" size={36} color="rgba(255,255,255,0.7)" /></View>
                }
                {identidadAprobada && <View style={empS.verBadgeSmall}><Ionicons name="checkmark" size={10} color="#fff" /></View>}
                <View style={empS.camIcon}><Ionicons name="camera" size={10} color="#fff" /></View>
              </TouchableOpacity>
              <Text style={empS.heroName}>{u?.nombre_completo}</Text>
              {empresa ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Ionicons name="home-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={empS.heroSub}>{empresa}</Text>
                </View>
              ) : null}
              {ubicacion ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={empS.heroLoc} numberOfLines={1}>{ubicacion}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Stats fuera del hero ── */}
          <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', damping: 18, delay: 150 }}
            style={[empS.statsRow, { marginHorizontal: SPACING.md, marginTop: -22, zIndex: 10 }]}>
            <View style={[empS.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[empS.statVal, { color: COLORS.primary }]}>{calificacion > 0 ? calificacion.toFixed(1) : '—'}</Text>
              <View style={{ flexDirection: 'row', gap: 1, marginVertical: 3 }}>
                {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= Math.round(calificacion) ? 'star' : 'star-outline'} size={10} color="#F59E0B" />)}
              </View>
              <Text style={[empS.statLbl, { color: colors.textMuted }]}>Calificación</Text>
            </View>
            <View style={[empS.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[empS.statVal, { color: '#2563EB' }]}>{u?.total_vacantes || 0}</Text>
              <Ionicons name="briefcase-outline" size={16} color="#2563EB" style={{ marginVertical: 3 }} />
              <Text style={[empS.statLbl, { color: colors.textMuted }]}>Vacantes</Text>
            </View>
            <View style={[empS.statCard, { backgroundColor: colors.surface }]}>
              <Text style={[empS.statVal, { color: '#EA580C' }]}>{beneficios.length}</Text>
              <Ionicons name="gift-outline" size={16} color="#EA580C" style={{ marginVertical: 3 }} />
              <Text style={[empS.statLbl, { color: colors.textMuted }]}>Beneficios</Text>
            </View>
          </MotiView>

          <View style={{ paddingHorizontal: SPACING.md, paddingTop: 16, gap: 12 }}>

            {/* Banner verificación */}
            {veEmp !== 'aprobada' && (
              <TouchableOpacity
                onPress={veEmp !== 'pendiente' ? subirDocumentoEmpresa : undefined}
                activeOpacity={0.85}
                style={[empS.alertCard, {
                  backgroundColor: veEmp === 'pendiente' ? '#FFFBEB' : veEmp === 'rechazada' ? '#FEF2F2' : '#F0FDF4',
                  borderColor: veEmp === 'pendiente' ? '#FDE68A' : veEmp === 'rechazada' ? '#FECACA' : '#BBF7D0',
                }]}
              >
                <Ionicons name={veEmp === 'pendiente' ? 'time-outline' : veEmp === 'rechazada' ? 'alert-circle-outline' : 'shield-checkmark-outline'} size={22}
                  color={veEmp === 'pendiente' ? '#D97706' : veEmp === 'rechazada' ? '#DC2626' : COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[empS.alertTitle, { color: veEmp === 'pendiente' ? '#92400E' : veEmp === 'rechazada' ? '#991B1B' : '#14532D' }]}>
                    {veEmp === 'pendiente' ? 'Verificación en revisión' : veEmp === 'rechazada' ? 'Verificación rechazada' : 'Verifica tu finca'}
                  </Text>
                  <Text style={[empS.alertSub, { color: veEmp === 'pendiente' ? '#B45309' : veEmp === 'rechazada' ? '#B91C1C' : '#166534' }]}>
                    {veEmp === 'pendiente' ? 'Tu documento está siendo revisado.' : veEmp === 'rechazada' ? `${perfil.verificacion_empresa_comentario || 'Documento no válido'}. Toca para reenviar.` : 'Sube tu RUT o RNT para mayor confianza.'}
                  </Text>
                </View>
                {veEmp !== 'pendiente' && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
              </TouchableOpacity>
            )}

            {/* Banner completa perfil */}
            {(!perfil?.acerca_de || !perfil?.fotos_finca?.length) && (
              <TouchableOpacity onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.85}
                style={[empS.alertCard, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                <View style={empS.alertIconWrap}>
                  <Ionicons name="rocket-outline" size={20} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[empS.alertTitle, { color: '#9A3412' }]}>¡Completa tu perfil!</Text>
                  <Text style={[empS.alertSub, { color: '#C2410C' }]}>
                    {!perfil?.acerca_de && !perfil?.fotos_finca?.length ? 'Agrega descripción y fotos para atraer más trabajadores' : !perfil?.acerca_de ? 'Agrega una descripción de tu finca' : 'Sube fotos de tu finca para destacar'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#EA580C" />
              </TouchableOpacity>
            )}

            {/* Beneficios */}
            {beneficios.length > 0 && (
              <View style={[empS.card, { backgroundColor: colors.surface }]}>
                <View style={empS.cardHeader}>
                  <LinearGradient colors={[COLORS.primary,'#43A047']} style={empS.cardIconGrad}><Ionicons name="gift-outline" size={15} color="#fff" /></LinearGradient>
                  <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Beneficios incluidos</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {beneficios.map((b, i) => (
                    <View key={i} style={empS.benefChip}>
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                      <Text style={[empS.benefChipTxt, { color: isDark ? '#7CCC8A' : '#166534' }]}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Sobre la finca */}
            <View style={[empS.card, { backgroundColor: colors.surface }]}>
              <View style={empS.cardHeader}>
                <LinearGradient colors={['#059669','#10B981']} style={empS.cardIconGrad}><Ionicons name="leaf-outline" size={15} color="#fff" /></LinearGradient>
                <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Sobre la Finca</Text>
              </View>
              {acercaDeEmpleador
                ? <Text style={[empS.cardBody, { color: colors.textSecondary }]}>{acercaDeEmpleador}</Text>
                : <Text style={[empS.cardBody, { color: colors.textMuted, fontStyle: 'italic' }]}>
                    {empresa}{ubicacion ? `, ubicada en ${ubicacion}` : ''}{tipoPago ? `. Pago: ${tipoPago}` : ''}.
                  </Text>
              }
            </View>

            {/* Cultivos + Labores */}
            {(cultivosEmp.length > 0 || labores.length > 0) && (
              <View style={[empS.card, { backgroundColor: colors.surface }]}>
                <View style={empS.cardHeader}>
                  <LinearGradient colors={['#16A34A','#22C55E']} style={empS.cardIconGrad}><Ionicons name="leaf" size={15} color="#fff" /></LinearGradient>
                  <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Cultivos y Labores</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {cultivosEmp.map((c, i) => (
                    <View key={i} style={empS.chipGreen}><Ionicons name="leaf" size={12} color={COLORS.primary} /><Text style={empS.chipGreenTxt}>{c}</Text></View>
                  ))}
                  {labores.map((l, i) => (
                    <View key={`l${i}`} style={empS.chipAmber}><Text style={empS.chipAmberTxt}>{l}</Text></View>
                  ))}
                </View>
              </View>
            )}

            {/* Galería */}
            {(perfil?.fotos_finca || []).length > 0 && (
              <View style={[empS.card, { backgroundColor: colors.surface }]}>
                <View style={empS.cardHeader}>
                  <LinearGradient colors={['#0284C7','#0EA5E9']} style={empS.cardIconGrad}><Ionicons name="images-outline" size={15} color="#fff" /></LinearGradient>
                  <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Fotos de la Finca</Text>
                  <Text style={[empS.cardCount, { color: colors.textMuted }]}>{perfil.fotos_finca.length}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -SPACING.md }}>
                  <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.md }}>
                    {perfil.fotos_finca.map((f, i) => (
                      <View key={f.id || i} style={empS.fotoWrap}>
                        <Image source={{ uri: f.url }} style={empS.foto} resizeMode="cover" />
                        <LinearGradient colors={['transparent','rgba(0,0,0,0.25)']} style={StyleSheet.absoluteFillObject} />
                        <View style={empS.fotoNum}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{i + 1}</Text></View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Certificados / badges */}
            {certificados.length > 0 && (
              <View style={[empS.card, { backgroundColor: colors.surface }]}>
                <View style={empS.cardHeader}>
                  <LinearGradient colors={['#D97706','#F59E0B']} style={empS.cardIconGrad}><Ionicons name="ribbon" size={15} color="#fff" /></LinearGradient>
                  <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Certificaciones</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {certificados.map((c, i) => (
                    <View key={c.id || i} style={tw.certBadge}>
                      <LinearGradient colors={['#D97706','#F59E0B']} style={tw.certBadgeIconWrap}><Ionicons name="ribbon" size={22} color="#fff" /></LinearGradient>
                      <Text style={[tw.certBadgeNombre, { color: colors.textPrimary }]} numberOfLines={2}>{c.nombre}</Text>
                      {!!c.entidad && <Text style={[tw.certBadgeEntidad, { color: colors.textMuted }]} numberOfLines={1}>{c.entidad}</Text>}
                      {!!c.anio && <Text style={tw.certBadgeAnio}>{c.anio}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Verificación */}
            <View style={[empS.card, { backgroundColor: colors.surface }]}>
              <View style={empS.cardHeader}>
                <LinearGradient colors={['#0F766E','#0D9488']} style={empS.cardIconGrad}><Ionicons name="shield-checkmark-outline" size={15} color="#fff" /></LinearGradient>
                <Text style={[empS.cardTitle, { color: colors.textPrimary }]}>Verificación</Text>
              </View>
              {[
                { icon: 'document-text-outline', label: 'Registro Empresarial', ok: veEmp === 'aprobada', onPress: veEmp !== 'aprobada' && veEmp !== 'pendiente' ? subirDocumentoEmpresa : null, sub: veEmp === 'pendiente' ? 'En revisión...' : veEmp === 'rechazada' ? 'Rechazado — toca para reenviar' : veEmp === 'sin_enviar' ? 'Toca para subir RUT / RNT' : null },
                { icon: 'call-outline', label: 'Teléfono verificado', ok: !!u?.verificado_sms },
                { icon: 'location-outline', label: 'Ubicación registrada', ok: !!ubicacion },
              ].map((row, i) => (
                <TouchableOpacity key={i} onPress={row.onPress || undefined} activeOpacity={row.onPress ? 0.7 : 1}
                  style={[empS.verRow, { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }]}>
                  <View style={[empS.verIconWrap, { backgroundColor: row.ok ? '#F0FDF4' : '#F9FAFB' }]}>
                    <Ionicons name={row.icon} size={16} color={row.ok ? COLORS.primary : colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[empS.verLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                    {!!row.sub && <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>{row.sub}</Text>}
                  </View>
                  <Ionicons name={row.ok ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={row.ok ? COLORS.primary : colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Acciones */}
            <View style={[empS.card, { backgroundColor: colors.surface }]}>
              {[
                { icon: 'create-outline', label: 'Editar perfil', color: COLORS.primary, bg: '#F0FDF4', onPress: () => navigation.navigate('EditarPerfil', { userData, perfil }) },
                { icon: isDark ? 'sunny-outline' : 'moon-outline', label: isDark ? 'Modo claro' : 'Modo oscuro', color: colors.primary, bg: isDark ? '#1a2f22' : '#F0FDF4', onPress: toggleMode },
                { icon: 'chatbox-ellipses-outline', label: 'Peticiones y Quejas', color: '#2563EB', bg: '#EFF6FF', onPress: () => navigation.navigate('Pqrs') },
              ].map((row, i) => (
                <TouchableOpacity key={i} onPress={row.onPress} activeOpacity={0.75}
                  style={[empS.actionRow, { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }]}>
                  <View style={[empS.actionIcon, { backgroundColor: row.bg }]}><Ionicons name={row.icon} size={17} color={row.color} /></View>
                  <Text style={[empS.actionLabel, { color: colors.textPrimary }]}>{row.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={handleLogout} activeOpacity={0.75}
                style={[empS.actionRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[empS.actionIcon, { backgroundColor: '#FEF2F2' }]}><Ionicons name="log-out-outline" size={17} color="#EF4444" /></View>
                <Text style={[empS.actionLabel, { color: '#EF4444' }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </SafeAreaView>
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
          <View style={[tw.hero, { paddingTop: (insets?.top || 0) + 52, overflow: 'hidden' }]}>
            {/* Portada */}
            {fotoPortada
              ? <Image source={{ uri: fotoPortada }} style={tw.heroPortadaImg} resizeMode="cover" />
              : <LinearGradient colors={['#1B5E20', '#2E7D32', '#43A047']} style={StyleSheet.absoluteFill} />
            }
            <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} pointerEvents="none" />

            {/* Top bar sobre el gradiente */}
            <View style={tw.heroTopBar}>
              <View style={{ width: 40 }} />
              <Text style={tw.heroTopTitle}>Mi Perfil</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={[tw.settingsBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]} onPress={subirPortadaTrabajador} disabled={subiendoPortada} activeOpacity={0.75}>
                  {subiendoPortada ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="image-outline" size={18} color="#fff" />}
                </TouchableOpacity>
                <TouchableOpacity style={tw.settingsBtn} onPress={() => navigation.navigate('EditarPerfil', { userData, perfil })} activeOpacity={0.75}>
                  <Ionicons name="settings-outline" size={20} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              </View>
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

          </View>
        </MotiView>

        {/* Stats card — fuera del hero, solapada con margen negativo */}
        <MotiView from={{ opacity: 0, translateY: 20 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: 320 }}
          style={[tw.statsCard, { marginHorizontal: SPACING.md, marginTop: -28, zIndex: 10 }]}>
          <View style={tw.statItem}>
            <Ionicons name="star" size={20} color="#FFB300" />
            <Text style={tw.statNum}>{calificacion > 0 ? calificacion.toFixed(1) : '—'}</Text>
            <Text style={tw.statLbl}>Calificación</Text>
          </View>
          <View style={tw.statDivider} />
          <View style={tw.statItem}>
            <Ionicons name="people-outline" size={20} color="#2196F3" />
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

        <View style={{ paddingHorizontal: SPACING.md, paddingTop: 16 }}>

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

          {/* ── CERTIFICADOS / BADGES ── */}
          {certificados.length > 0 && (
            <StaggeredItem index={5}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#D97706','#F59E0B']} style={tw.cardIconGrad}>
                    <Ionicons name="ribbon" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Certificados y Logros</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {certificados.map((c, i) => (
                    <MotiView key={c.id || i} from={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 16, delay: i * 60 }}>
                      <View style={tw.certBadge}>
                        <LinearGradient colors={['#D97706','#F59E0B']} style={tw.certBadgeIconWrap}>
                          <Ionicons name="ribbon" size={22} color="#fff" />
                        </LinearGradient>
                        <Text style={[tw.certBadgeNombre, { color: colors.textPrimary }]} numberOfLines={2}>{c.nombre}</Text>
                        {!!c.entidad && <Text style={[tw.certBadgeEntidad, { color: colors.textMuted }]} numberOfLines={1}>{c.entidad}</Text>}
                        {!!c.anio && <Text style={[tw.certBadgeAnio]}>{c.anio}</Text>}
                      </View>
                    </MotiView>
                  ))}
                </View>
              </View>
            </StaggeredItem>
          )}

          {/* ── RESEÑAS ── */}
          {resenias.length > 0 && (
            <StaggeredItem index={5}>
              <View style={[tw.card, { backgroundColor: colors.surface }]}>
                <View style={tw.cardHeader}>
                  <LinearGradient colors={['#F59E0B','#D97706']} style={tw.cardIconGrad}>
                    <Ionicons name="star" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[tw.cardTitle, { color: colors.textPrimary }]}>Reseñas</Text>
                  <Text style={[tw.cardCount, { color: colors.textMuted }]}>{resenias.length}</Text>
                </View>
                {resenias.slice(0, 5).map((r, i) => (
                  <View key={r.id || i} style={[tw.reseniaRow, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 }]}>
                    <View style={tw.reseniaHeader}>
                      <View style={tw.reseniaAvatar}>
                        <Text style={tw.reseniaAvatarTxt}>{(r.nombre_calificador || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[tw.reseniaNombre, { color: colors.textPrimary }]}>{r.nombre_calificador || 'Anónimo'}</Text>
                        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                          {[1,2,3,4,5].map(s => (
                            <Ionicons key={s} name={s <= r.estrellas ? 'star' : 'star-outline'} size={12} color="#FFB300" />
                          ))}
                        </View>
                      </View>
                      <Text style={[tw.reseniaFecha, { color: colors.textMuted }]}>
                        {new Date(r.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))}
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
              <AnimatedPressable style={[tw.actionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]} onPress={() => navigation.navigate('MisServicios')} scaleValue={0.97} haptic>
                <View style={[tw.actionIcon, { backgroundColor: '#FFF7ED' }]}><Ionicons name="briefcase-outline" size={17} color="#D97706" /></View>
                <Text style={[tw.actionTxt, { color: colors.textPrimary }]}>Mis Servicios</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
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
  secCount: { fontSize: 12, fontWeight: '600', marginLeft: 'auto' },

  /* Finca photo gallery */
  fincaFotoWrap: { width: 160, height: 110, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOWS.medium },
  fincaFoto: { width: 160, height: 110 },
  fincaFotoOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.08)' },
  fincaFotoNumWrap: { position: 'absolute', bottom: 6, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  fincaFotoNum: { color: '#fff', fontSize: 11, fontWeight: '700' },

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

  /* Mejora perfil banner (empleador) */
  empMejoraGrad: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.medium },
  empMejoraLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  empMejoraIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  empMejoraTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  empMejoraSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16 },
  empMejoraArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },

  /* Stats grid cards */
  empStatsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  empStatCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm, alignItems: 'center' },
  empStatCardVal: { fontSize: 20, fontWeight: '900' },
  empStatCardLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },

  /* Beneficios row */
  empBenefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md },
  empBenefItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  empBenefTxt: { fontSize: 13, fontWeight: '600' },

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
  heroPortadaImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
  statsCard: { backgroundColor: '#fff', borderRadius: 18, flexDirection: 'row', paddingVertical: 14, ...SHADOWS.medium },
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
  certBadge: { width: 100, alignItems: 'center', padding: 10, backgroundColor: '#FFFBEB', borderRadius: 16, borderWidth: 1.5, borderColor: '#FDE68A' },
  certBadgeIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  certBadgeNombre: { fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  certBadgeEntidad: { fontSize: 10, textAlign: 'center', marginTop: 2 },
  certBadgeAnio: { fontSize: 10, color: '#D97706', fontWeight: '600', marginTop: 2 },
  reseniaRow: { paddingVertical: 12 },
  reseniaHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reseniaAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  reseniaAvatarTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reseniaNombre: { fontSize: 13, fontWeight: '600' },
  reseniaFecha: { fontSize: 11 },
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

/* ══════════ EMPLOYER STYLES ══════════ */
const empS = StyleSheet.create({
  // Hero
  hero: { height: 300, justifyContent: 'flex-end' },
  heroTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 8 },
  heroTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff', textAlign: 'center' },
  heroBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroBody: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg, gap: 2, alignItems: 'center' },
  // Avatar
  avatarWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#fff', overflow: 'visible', marginBottom: 8 },
  avatar: { width: 74, height: 74, borderRadius: 37 },
  avatarFallback: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  verBadgeSmall: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  camIcon: { position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  // Hero text
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.3, textAlign: 'center' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500', textAlign: 'center' },
  heroLoc: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', flexShrink: 1 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.sm },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: 'center', ...SHADOWS.medium },
  statVal: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  statLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4, marginTop: 2 },
  // Alerts
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: SPACING.sm },
  alertIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: 13, fontWeight: '700' },
  alertSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  // Cards
  card: { borderRadius: 16, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.light },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  cardIconGrad: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  cardCount: { fontSize: 12, fontWeight: '600', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  cardBody: { fontSize: 14, lineHeight: 21 },
  // Chips
  benefChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  benefChipTxt: { fontSize: 12, fontWeight: '600' },
  chipGreen: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipGreenTxt: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
  chipAmber: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipAmberTxt: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  // Fotos
  fotoWrap: { width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: 12, overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoNum: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  // Verification
  verRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  verIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  verLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
});
