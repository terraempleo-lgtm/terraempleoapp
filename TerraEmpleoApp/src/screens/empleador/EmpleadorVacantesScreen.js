import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, Modal, ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { vacantesAPI, notificacionesAPI, authAPI, trabajadoresAPI, especialistasAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import CamaraFoto from '../../components/CamaraFoto';
import { Ionicons } from '@expo/vector-icons';
import { useDisenoResponsive } from '../../hooks/useDisenoResponsive';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';

const AVATAR_COLORS = ['#C8A882','#A8B8D0','#B8C8A0','#D0A8A8','#A8C8C8','#C8B8A0','#B0A8C8','#C0B0B8'];
function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ').filter(Boolean);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[1][0]).toUpperCase();
}
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const DISP_LABELS = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  temporada_cosecha: 'Temporada', fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Disponible ya',
};
const EXP_LABELS = {
  sin: 'Sin exp.', menos_1: '<1 año', '1_3': '1-3 años',
  '3_5': '3-5 años', '5_10': '5-10 años', mas_10: '+10 años',
};
const MODALIDAD_LABELS = {
  por_proyecto: 'Por proyecto', por_dias: 'Por días',
  mensual: 'Mensual', asesoria_puntual: 'Asesoría',
};

function SocialWorkerCard({ item, onPress, onContact, loadingContacto, estadoContacto, colors, isDark }) {
  const avatarBg = getAvatarColor(item.nombre_completo);
  const initials = getInitials(item.nombre_completo);
  const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
  const dispLabel = DISP_LABELS[item.disponibilidad];
  const expLabel = EXP_LABELS[item.anios_experiencia];
  const matchNum = Number(item.puntaje_match || 0);
  const cal = parseFloat(item.calificacion_promedio || 0);
  const cultivos = (item.cultivos || []).slice(0, 2);
  const habilidades = (item.habilidades || []).slice(0, 2);
  const extraSkills = (item.cultivos?.length || 0) + (item.habilidades?.length || 0) - 4;

  return (
    <AnimatedPressable style={[socialStyles.card, { backgroundColor: colors.surface }]} onPress={() => onPress(item)} scaleValue={0.985} haptic={false}>
      {/* Banner + avatar */}
      <LinearGradient colors={matchNum >= 60 ? ['#1b5e20','#2e7d32'] : ['#37474F','#546E7A']} start={{x:0,y:0}} end={{x:1,y:1}} style={socialStyles.banner}>
        {matchNum > 0 && (
          <View style={socialStyles.matchBadge}>
            <Ionicons name="flash" size={11} color="#fff" />
            <Text style={socialStyles.matchBadgeText}>{matchNum}% match</Text>
          </View>
        )}
      </LinearGradient>
      <View style={socialStyles.avatarWrap}>
        <View style={[socialStyles.avatarRing, { borderColor: colors.surface }]}>
          <View style={[socialStyles.avatarCircle, { backgroundColor: avatarBg }]}>
            {item.foto_selfie ? <Image source={{ uri: item.foto_selfie }} style={socialStyles.avatar} /> : <Text style={socialStyles.avatarInitials}>{initials}</Text>}
          </View>
        </View>
        {dispLabel === 'Disponible ya' && <View style={socialStyles.onlineDot} />}
      </View>

      <View style={socialStyles.body}>
        {/* Name + stars */}
        <Text style={[socialStyles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>{item.nombre_completo}</Text>
        {cal > 0 && (
          <View style={socialStyles.starsRow}>
            {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= Math.round(cal) ? 'star' : 'star-outline'} size={11} color={i <= Math.round(cal) ? '#F59E0B' : '#D1D5DB'} />)}
            <Text style={[socialStyles.calText, { color: colors.textMuted }]}>{cal.toFixed(1)}</Text>
          </View>
        )}

        {/* Location + exp */}
        <View style={socialStyles.metaRow}>
          {ubicacion ? <><Ionicons name="location-outline" size={11} color={colors.textMuted} /><Text style={[socialStyles.metaText, { color: colors.textMuted }]} numberOfLines={1}>{ubicacion}</Text></> : null}
          {expLabel ? <><View style={[socialStyles.metaDot, { backgroundColor: colors.border }]} /><Text style={[socialStyles.metaText, { color: colors.textMuted }]}>{expLabel}</Text></> : null}
        </View>

        {/* Bio */}
        {item.acerca_de ? <Text style={[socialStyles.bio, { color: colors.textSecondary }]} numberOfLines={2}>{item.acerca_de}</Text> : null}

        {/* Skills chips */}
        <View style={socialStyles.chipsWrap}>
          {cultivos.map((c, i) => (
            <View key={`c${i}`} style={[socialStyles.chip, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
              <Ionicons name="leaf-outline" size={10} color="#16A34A" />
              <Text style={[socialStyles.chipText, { color: '#15803D' }]}>{c}</Text>
            </View>
          ))}
          {habilidades.map((h, i) => (
            <View key={`h${i}`} style={[socialStyles.chip, { backgroundColor: isDark ? colors.border : '#F1F5F9', borderColor: isDark ? colors.border : '#E2E8F0' }]}>
              <Text style={[socialStyles.chipText, { color: colors.textSecondary }]}>{h}</Text>
            </View>
          ))}
          {extraSkills > 0 && (
            <View style={[socialStyles.chip, { backgroundColor: COLORS.primary, borderColor: 'transparent' }]}>
              <Text style={[socialStyles.chipText, { color: '#fff', fontWeight: '800' }]}>+{extraSkills}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={socialStyles.actions}>
          {estadoContacto === 'aceptada' ? (
            <AnimatedPressable style={[socialStyles.btnPrimary, { backgroundColor: '#16A34A', flex: 1 }]} onPress={() => onContact(item)} scaleValue={0.96} haptic>
              <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>Ir al chat</Text>
            </AnimatedPressable>
          ) : estadoContacto === 'contacto_solicitado' ? (
            <View style={[socialStyles.btnPrimary, { backgroundColor: '#F59E0B', flex: 1 }]}>
              <Ionicons name="hourglass-outline" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>En espera</Text>
            </View>
          ) : (
            <AnimatedPressable style={[socialStyles.btnPrimary, { flex: 1 }, loadingContacto && { opacity: 0.6 }]} onPress={() => onContact(item)} disabled={loadingContacto} scaleValue={0.96} haptic>
              <Ionicons name="paper-plane-outline" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>{loadingContacto ? 'Enviando...' : 'Contactar'}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable style={[socialStyles.btnSecondary, { borderColor: COLORS.primary }]} onPress={() => onPress(item)} scaleValue={0.96} haptic>
            <Ionicons name="person-circle-outline" size={15} color={COLORS.primary} />
            <Text style={[socialStyles.btnSecondaryText, { color: COLORS.primary }]}>Perfil</Text>
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

function EspCard({ item, onPress, onContact, loadingId, estadoContacto, colors, isDark }) {
  const avatarBg = getAvatarColor(item.nombre_completo);
  const initials = getInitials(item.nombre_completo);
  const cal = parseFloat(item.calificacion_promedio || 0);
  const modalidad = MODALIDAD_LABELS[item.modalidad_trabajo];
  const esp = (item.especialidades || []).slice(0, 2);
  const isLoading = loadingId === Number(item.id);
  const estado = estadoContacto || null;

  return (
    <AnimatedPressable style={[socialStyles.espCard, { backgroundColor: colors.surface }]} onPress={() => onPress(item)} scaleValue={0.97} haptic={false}>
      <LinearGradient colors={['#8B3A2A','#C0694A']} start={{x:0,y:0}} end={{x:1,y:1}} style={socialStyles.espBanner}>
        <View style={socialStyles.espRibbon}>
          <Ionicons name="ribbon" size={11} color="#fff" />
          <Text style={socialStyles.espRibbonText}>Especialista</Text>
        </View>
      </LinearGradient>
      <View style={socialStyles.avatarWrap}>
        <View style={[socialStyles.avatarRing, { borderColor: colors.surface }]}>
          <View style={[socialStyles.avatarCircle, { backgroundColor: avatarBg }]}>
            {item.foto_selfie ? <Image source={{ uri: item.foto_selfie }} style={socialStyles.avatar} /> : <Text style={socialStyles.avatarInitials}>{initials}</Text>}
          </View>
        </View>
      </View>
      <View style={socialStyles.body}>
        <Text style={[socialStyles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>{item.nombre_completo}</Text>
        {cal > 0 && (
          <View style={socialStyles.starsRow}>
            {[1,2,3,4,5].map(i => <Ionicons key={i} name={i <= Math.round(cal) ? 'star' : 'star-outline'} size={11} color={i <= Math.round(cal) ? '#F59E0B' : '#D1D5DB'} />)}
            <Text style={[socialStyles.calText, { color: colors.textMuted }]}>{cal.toFixed(1)}</Text>
          </View>
        )}
        {item.descripcion_servicio ? <Text style={[socialStyles.bio, { color: colors.textSecondary }]} numberOfLines={2}>{item.descripcion_servicio}</Text> : null}
        {modalidad && <View style={[socialStyles.chip, { backgroundColor: '#FDEAE5', borderColor: '#F5C4B5', alignSelf: 'flex-start', marginBottom: 6 }]}><Text style={[socialStyles.chipText, { color: '#C0694A' }]}>{modalidad}</Text></View>}
        {esp.length > 0 && (
          <View style={socialStyles.chipsWrap}>
            {esp.map((e, i) => <View key={i} style={[socialStyles.chip, { backgroundColor: '#FDEAE5', borderColor: '#F5C4B5' }]}><Text style={[socialStyles.chipText, { color: '#C0694A' }]}>{e}</Text></View>)}
          </View>
        )}
        <View style={socialStyles.actions}>
          {estado === 'aceptada' ? (
            <AnimatedPressable style={[socialStyles.btnPrimary, { backgroundColor: '#16A34A', flex: 1 }]} onPress={() => onContact(item)} scaleValue={0.96} haptic>
              <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>Ir al chat</Text>
            </AnimatedPressable>
          ) : estado === 'contacto_solicitado' ? (
            <View style={[socialStyles.btnPrimary, { backgroundColor: '#F59E0B', flex: 1 }]}>
              <Ionicons name="time-outline" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>En espera</Text>
            </View>
          ) : (
            <AnimatedPressable style={[socialStyles.btnPrimary, { backgroundColor: '#C0694A', flex: 1 }, isLoading && { opacity: 0.6 }]} onPress={() => onContact(item)} disabled={isLoading} scaleValue={0.96} haptic>
              <Ionicons name="paper-plane-outline" size={14} color="#fff" />
              <Text style={socialStyles.btnPrimaryText}>{isLoading ? '...' : 'Contactar'}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable style={[socialStyles.btnSecondary, { borderColor: '#C0694A' }]} onPress={() => onPress(item)} scaleValue={0.96} haptic>
            <Ionicons name="person-circle-outline" size={15} color="#C0694A" />
            <Text style={[socialStyles.btnSecondaryText, { color: '#C0694A' }]}>Perfil</Text>
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const socialStyles = StyleSheet.create({
  card: { borderRadius: 20, marginBottom: SPACING.sm, overflow: 'hidden', borderWidth: 1, borderColor: '#E8EDE8', ...SHADOWS.card },
  espCard: { borderRadius: 20, marginBottom: SPACING.sm, overflow: 'hidden', borderWidth: 1, borderColor: '#F5C4B5', ...SHADOWS.card },
  banner: { height: 72 },
  espBanner: { height: 72 },
  espRibbon: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  espRibbonText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  matchBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  matchBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  avatarWrap: { marginTop: -28, paddingHorizontal: SPACING.md, position: 'relative' },
  avatarRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, overflow: 'hidden' },
  avatarCircle: { width: '100%', height: '100%', borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 30 },
  avatarInitials: { fontSize: 18, fontWeight: '800', color: '#fff' },
  onlineDot: { position: 'absolute', bottom: 3, left: 46, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#fff' },
  body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, paddingTop: 6 },
  nombre: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  calText: { fontSize: 11, fontWeight: '600', marginLeft: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5 },
  metaText: { fontSize: 12 },
  bio: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 4 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6, marginBottom: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  chipText: { fontSize: 11.5, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 11, borderRadius: RADIUS.full },
  btnPrimaryText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1.5 },
  btnSecondaryText: { fontSize: 13, fontWeight: '700' },
});

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'hace 1 día';
  return `hace ${diff} días`;
}

function AvatarStack({ count }) {
  const circles = Math.min(count, 3);
  const extra = count > 3 ? count - 3 : 0;
  return (
    <View style={stackStyles.wrap}>
      {Array.from({ length: circles }).map((_, i) => (
        <View
          key={i}
          style={[stackStyles.circle, { marginLeft: i === 0 ? 0 : -8, zIndex: circles - i }]}
        >
          <Ionicons name="person" size={11} color={COLORS.white} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[stackStyles.circle, stackStyles.extra, { marginLeft: -8 }]}>
          <Text style={stackStyles.extraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  extra: { backgroundColor: COLORS.primaryLight },
  extraText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
});

/* ── Pulsing notification badge ── */
function PulsingBadge({ count }) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
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
    <Animated.View style={[styles.notifBadge, animStyle]}>
      <Text style={styles.notifBadgeText}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
}

function ResumenSemanaCard({ postulantesTotal, activasCount, isDark }) {
  const mensaje = postulantesTotal > 0
    ? `${postulantesTotal} postulante${postulantesTotal !== 1 ? 's' : ''} en total`
    : activasCount > 0
    ? 'Tu vacante está activa y visible para trabajadores'
    : 'Crea una vacante para comenzar a recibir postulantes';

  return (
    <LinearGradient
      colors={isDark ? ['#0f2d1a', '#0a1f12'] : ['#1b5e20', '#2e7d32']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.resumenCard}
    >
      <View style={styles.resumenTop}>
        <Text style={styles.resumenTitle}>Resumen</Text>
        <View style={styles.resumenDot} />
      </View>

      <View style={styles.resumenStats}>
        <View style={styles.resumenStat}>
          <Text style={styles.resumenNum}>{postulantesTotal}</Text>
          <Text style={styles.resumenLabel}>Postulantes</Text>
        </View>
        <View style={styles.resumenDiv} />
        <View style={styles.resumenStat}>
          <Text style={styles.resumenNum}>{activasCount}</Text>
          <Text style={styles.resumenLabel}>Activas</Text>
        </View>
      </View>

      <View style={styles.resumenMensaje}>
        <Ionicons name="flash" size={12} color={COLORS.accent} />
        <Text style={styles.resumenMensajeText} numberOfLines={2}>{mensaje}</Text>
      </View>
    </LinearGradient>
  );
}

export default function EmpleadorVacantesScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const { contenedorMaxAncho } = useDisenoResponsive();
  const insets = useSafeAreaInsets();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState('activa');
  const [noLeidas, setNoLeidas] = useState(0);
  const [vacanteAArchivar, setVacanteAArchivar] = useState(null);
  const [archivandoId, setArchivandoId] = useState(null);
  const [modalReVerif, setModalReVerif] = useState(false);
  const [fotosReVerif, setFotosReVerif] = useState({ selfie: false, selfie_cedula: false });

  const [estadoVerif, setEstadoVerif] = useState(user?.validacion_identidad_estado || 'pendiente');
  const [trabajadores, setTrabajadores] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [enviandoContactoId, setEnviandoContactoId] = useState(null);
  const [contactosEstado, setContactosEstado] = useState({});
  const [vacanteActiva, setVacanteActiva] = useState(null);

  const firstName = (user?.nombre_completo || user?.nombre || 'Empleador').split(' ')[0];
  const nombreCompleto = user?.nombre_completo || user?.nombre || firstName;
  const estadoIdentidad = estadoVerif;
  const identidadAprobada = estadoIdentidad === 'aprobada';
  const mostrarTarjetaVerificacion = !identidadAprobada;

  const cargarNoLeidas = useCallback(async () => {
    try {
      const res = await notificacionesAPI.contarNoLeidas();
      setNoLeidas(res.data.count || 0);
    } catch (_) {}
  }, []);

  const abrirConfirmacionArchivar = (item) => {
    setVacanteAArchivar(item);
  };

  const cerrarConfirmacionArchivar = () => {
    if (archivandoId) return;
    setVacanteAArchivar(null);
  };

  const confirmarArchivar = async () => {
    if (!vacanteAArchivar?.id) return;
    try {
      setArchivandoId(Number(vacanteAArchivar.id));
      await vacantesAPI.cerrar(vacanteAArchivar.id);
      setVacanteAArchivar(null);
      await cargar();
    } catch (err) {
      setVacanteAArchivar({
        ...vacanteAArchivar,
        __error: err.response?.data?.error || 'No se pudo archivar la vacante',
      });
    } finally {
      setArchivandoId(null);
    }
  };

  const cargar = useCallback(async () => {
    try {
      const [resVac, resTrab, resEsp] = await Promise.allSettled([
        vacantesAPI.misVacantes(),
        trabajadoresAPI.listar({ orden: 'match', limit: 10 }),
        especialistasAPI.listar({ limit: 6 }),
      ]);
      const misVac = resVac.status === 'fulfilled' ? (resVac.value.data.vacantes || []) : [];
      setVacantes(misVac);
      const activa = misVac.find(v => v.estado === 'activa') || null;
      setVacanteActiva(activa ? { id: Number(activa.id), titulo: activa.titulo } : null);
      if (resTrab.status === 'fulfilled') {
        const lista = resTrab.value.data?.trabajadores || [];
        setTrabajadores(lista);
        const est = {};
        lista.forEach(t => { if (t.estado_contacto) est[t.id] = t.estado_contacto; });
        setContactosEstado(prev => ({ ...est, ...prev }));
      }
      if (resEsp.status === 'fulfilled') setEspecialistas(resEsp.value.data?.especialistas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const sincronizarVerificacion = useCallback(() => {
    authAPI.getPerfil().then(res => {
      const { validacion_identidad_estado, foto_selfie, foto_selfie_cambiada_at } = res.data.user;
      setEstadoVerif(validacion_identidad_estado || 'pendiente');
      updateUser({ validacion_identidad_estado, foto_selfie, foto_selfie_cambiada_at });
    }).catch(() => {});
  }, []);

  const openWhatsAppSupport = () => {
    Linking.openURL('https://wa.me/573108870800').catch(() => {});
  };

  useEffect(() => { cargar(); cargarNoLeidas(); sincronizarVerificacion(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      cargar();
      cargarNoLeidas();
      sincronizarVerificacion();
    });
    return unsub;
  }, [navigation, sincronizarVerificacion]);

  const contactarTrabajador = async (item) => {
    if (!vacanteActiva?.id) {
      Alert.alert('Sin vacante', 'Crea una vacante activa para contactar trabajadores.');
      return;
    }
    try {
      setEnviandoContactoId(Number(item.id));
      const res = await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteActiva.id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);
      if (estado === 'aceptada' && chatId) {
        setContactosEstado(prev => ({ ...prev, [item.id]: 'aceptada' }));
        navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chat: { id: chatId, otro_nombre: item.nombre_completo, otro_foto: item.foto_selfie } } });
        return;
      }
      setContactosEstado(prev => ({ ...prev, [item.id]: estado || 'contacto_solicitado' }));
      Alert.alert('Listo', `Solicitud enviada a ${item.nombre_completo}.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  const contactarEspecialista = async (item) => {
    try {
      setEnviandoContactoId(Number(item.id));
      const res = await especialistasAPI.contactar(item.id, { vacante_id: vacanteActiva?.id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);
      if (estado === 'aceptada' && chatId) {
        setContactosEstado(prev => ({ ...prev, [`esp_${item.id}`]: 'aceptada' }));
        navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chat: { id: chatId, otro_nombre: item.nombre_completo, otro_foto: item.foto_selfie } } });
        return;
      }
      setContactosEstado(prev => ({ ...prev, [`esp_${item.id}`]: estado || 'contacto_solicitado' }));
      Alert.alert('Listo', `Solicitud enviada a ${item.nombre_completo}.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  const activas = vacantes.filter(v => v.estado === 'activa');
  const inactivas = vacantes.filter(v => v.estado !== 'activa');
  const lista = tabActiva === 'activa' ? activas : inactivas;
  const postulantesCount = vacantes.reduce((acc, v) => acc + Number(v.total_postulaciones || 0), 0);

  const renderVacante = ({ item, index }) => {
    const isActiva = item.estado === 'activa';
    const postulantes = item.total_postulaciones || 0;
    const inicioTexto = formatVacancyStartDate(item.fecha_inicio, { fallback: '' });
    const pago = getVacancyPayDisplay(item);

    return (
      <StaggeredItem index={index}>
        <View style={[styles.card, { backgroundColor: colors.card }, !isActiva && styles.cardInactiva]}>
          {/* Action buttons */}
          <View style={styles.cardActionsOverlay}>
            <AnimatedPressable
              onPress={() => navigation.navigate('EditarVacante', { vacante: item })}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(13,27,22,0.97)' : 'rgba(255,255,255,0.95)' }]}
              scaleValue={0.85}
              haptic
              hapticStyle="light"
            >
              <Ionicons name="pencil-outline" size={16} color={COLORS.textSecondary} />
            </AnimatedPressable>
            {isActiva && (
              <AnimatedPressable
                onPress={() => abrirConfirmacionArchivar(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(13,27,22,0.97)' : 'rgba(255,255,255,0.95)' }]}
                scaleValue={0.85}
                haptic
                hapticStyle="light"
              >
                <Ionicons name="archive-outline" size={16} color={COLORS.accent} />
              </AnimatedPressable>
            )}
          </View>

          <AnimatedPressable
            style={styles.cardPressable}
            onPress={() => navigation.navigate('DetalleVacanteEmpleador', { vacante: item })}
            scaleValue={0.98}
            haptic={false}
          >
            {/* Image thumbnail */}
            <View style={styles.cardImg}>
              {item.foto_portada ? (
                <Image source={{ uri: item.foto_portada }} style={styles.img} resizeMode="cover" />
              ) : (
                <View style={styles.imgPlaceholder}>
                  <Ionicons name="leaf" size={26} color={isActiva ? COLORS.primary : COLORS.textLight} />
                </View>
              )}
              {/* Status dot on image */}
              <View style={[styles.statusDot, { backgroundColor: isActiva ? COLORS.primary : COLORS.textLight }]} />
            </View>

            {/* Content */}
            <View style={styles.cardBody}>
              <View style={styles.cardTopRow}>
                <View style={[styles.estadoBadge, !isActiva && styles.estadoBadgeInactiva, !isActiva && { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]}>
                  <View style={[styles.estadoDot, { backgroundColor: isActiva ? COLORS.primary : COLORS.textLight }]} />
                  <Text style={[styles.estadoText, !isActiva && styles.estadoTextInactiva]}>
                    {isActiva ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.cardTitle, { color: colors.textPrimary }, !isActiva && styles.cardTitleInactiva, !isActiva && { color: colors.textSecondary }]} numberOfLines={1}>
                {item.titulo}
              </Text>

              <View style={styles.cardLocationRow}>
                <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                <Text style={[styles.cardLocation, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Colombia'}
                </Text>
              </View>

              {inicioTexto ? (
                <View style={styles.startDateBadge}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.startDateBadgeText}>Inicio: {inicioTexto}</Text>
                </View>
              ) : null}

              <View style={styles.salaryRow}>
                <Ionicons name="cash-outline" size={13} color={COLORS.primary} />
                <Text style={[styles.salaryText, { color: colors.textPrimary }]} numberOfLines={1}>{pago.valor}</Text>
              </View>

              {/* Footer: postulantes + time */}
              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                {isActiva ? (
                  <View style={styles.postulantesRow}>
                    {postulantes > 0 && <AvatarStack count={postulantes} />}
                    <Text style={styles.postulantesText}>
                      {postulantes} {postulantes === 1 ? 'postulante' : 'postulantes'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cubiertoWrap}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.textLight} />
                    <Text style={styles.cubierto}>Cubierto</Text>
                  </View>
                )}
                {item.created_at && (
                  <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
                )}
              </View>
            </View>
          </AnimatedPressable>
        </View>
      </StaggeredItem>
    );
  };

  const ListHeader = useMemo(() => (
    <View>
      {/* Greeting */}
      <FadeInView delay={0}>
        <View style={[styles.greetingSection, { backgroundColor: colors.surface }]}>
          <View style={styles.greetingLeft}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrap}>
                {user?.foto_selfie ? (
                  <Image source={{ uri: user.foto_selfie }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                )}
              </View>
              {identidadAprobada ? (
                <View style={styles.verificadoBadge}>
                  <Ionicons name="checkmark" size={11} color={COLORS.white} />
                </View>
              ) : estadoIdentidad === 'rechazada' ? (
                <View style={[styles.verificadoBadge, { backgroundColor: COLORS.error }]}>
                  <Ionicons name="alert" size={11} color={COLORS.white} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.greetingLabel, { color: colors.textSecondary }]}>Hola,</Text>
              <Text style={[styles.greetingName, { color: colors.textPrimary }]}>{firstName}</Text>
            </View>
          </View>
          <View style={styles.greetingRight}>
            <AnimatedPressable
              style={[styles.greetingIconBtn, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}
              onPress={() => navigation.navigate('Notificaciones')}
              scaleValue={0.9}
              haptic
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textPrimary} />
              {noLeidas > 0 && <PulsingBadge count={noLeidas} />}
            </AnimatedPressable>
            <AnimatedPressable
              style={[styles.greetingIconBtn, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}
              onPress={openWhatsAppSupport}
              scaleValue={0.9}
              haptic
            >
              <Ionicons name="headset-outline" size={20} color={colors.textPrimary} />
            </AnimatedPressable>
          </View>
        </View>
      </FadeInView>

      {/* Title row */}
      <View style={styles.titleHeader}>
        <View style={styles.titleHeaderLeft}>
          <View style={styles.titleRow}>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Mis Vacantes</Text>
            {vacantes.length > 0 && (
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>{vacantes.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            {activas.length} activa{activas.length !== 1 ? 's' : ''} · {inactivas.length} inactiva{inactivas.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <AnimatedPressable
          style={styles.addBtnIcon}
          onPress={() => navigation.navigate('CrearVacante')}
          scaleValue={0.95}
          haptic
        >
          <Ionicons name="add" size={20} color={COLORS.white} />
        </AnimatedPressable>
      </View>

      {/* Verificacion Card */}
      {mostrarTarjetaVerificacion && (
        <FadeInView delay={50}>
          <View style={[styles.verificacionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.verificacionHeader}>
              <Ionicons
                name={estadoIdentidad === 'rechazada' ? 'alert-circle' : 'shield-outline'}
                size={18}
                color={estadoIdentidad === 'rechazada' ? COLORS.error : COLORS.primary}
              />
              <Text style={[styles.verificacionTitle, { color: colors.textPrimary }]}>
                {estadoIdentidad === 'rechazada' ? 'Verificación rechazada' : 'Verificación de identidad'}
              </Text>
            </View>
            <Text style={[styles.verificacionText, { color: colors.textSecondary }]}>
              {estadoIdentidad === 'rechazada'
                ? 'Tu verificación fue rechazada. Vuelve a tomarte la selfie y la foto con cédula para reenviar.'
                : 'Tu cédula está en proceso de verificación. Te avisaremos cuando sea aprobada.'}
            </Text>
            {estadoIdentidad === 'rechazada' ? (
              <TouchableOpacity
                style={styles.reVerifBtn}
                onPress={() => { setFotosReVerif({ selfie: false, selfie_cedula: false }); setModalReVerif(true); }}
              >
                <Ionicons name="camera" size={16} color={COLORS.white} />
                <Text style={styles.reVerifBtnText}>Volver a verificarme</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </FadeInView>
      )}

      {/* Filter chips */}
      <FadeInView delay={150}>
        <View style={styles.chipsRow}>
          {/* Postulantes chip → navega a pantalla */}
          <AnimatedPressable
            style={[styles.filterChip, { backgroundColor: isDark ? colors.surface : COLORS.white, borderColor: isDark ? colors.border : '#E5E7EB' }]}
            onPress={() => navigation.navigate('MisPostulantes')}
            scaleValue={0.95}
            haptic
            hapticStyle="light"
          >
            <View style={[styles.filterDot, { backgroundColor: COLORS.primary }]} />
            <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>Postulantes</Text>
            <Text style={[styles.filterChipCount, { color: colors.textMuted }]}>{postulantesCount}</Text>
          </AnimatedPressable>

          {[
            { key: 'activa', label: 'Activas', count: activas.length, dot: COLORS.primary },
            { key: 'inactiva', label: 'Inactivas', count: inactivas.length, dot: COLORS.textLight },
          ].map((tab) => {
            const isActive = tabActiva === tab.key;
            return (
              <AnimatedPressable
                key={tab.key}
                style={[
                  styles.filterChip,
                  isActive
                    ? { backgroundColor: '#c1ff72', borderColor: '#c1ff72' }
                    : { backgroundColor: isDark ? colors.surface : COLORS.white, borderColor: isDark ? colors.border : '#E5E7EB' },
                ]}
                onPress={() => setTabActiva(tab.key)}
                scaleValue={0.95}
                haptic
                hapticStyle="light"
              >
                <View style={[styles.filterDot, { backgroundColor: isActive ? tab.dot : tab.dot }]} />
                <Text style={[styles.filterChipText, { color: isActive ? '#0E1410' : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                <Text style={[styles.filterChipCount, { color: isActive ? 'rgba(255,255,255,0.65)' : colors.textMuted }]}>
                  {tab.count}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </FadeInView>

      <FadeInView delay={200}>
        <ResumenSemanaCard
          postulantesTotal={postulantesCount}
          activasCount={activas.length}
          isDark={isDark}
        />
      </FadeInView>

      <FadeInView delay={250}>
        <AnimatedPressable
          style={styles.explorarBtn}
          onPress={() => navigation.navigate('ExplorarVacantes')}
          scaleValue={0.97}
          haptic
        >
          <View style={styles.explorarGradient}>
            <View style={styles.explorarLeft}>
              <View style={styles.explorarIconCircle}>
                <Ionicons name="search" size={18} color="#1A1A1A" />
              </View>
              <View>
                <Text style={styles.explorarTitle}>Explorar ofertas</Text>
                <Text style={styles.explorarSub}>Inspírate en otras vacantes del sector</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
          </View>
        </AnimatedPressable>
      </FadeInView>

      {/* ── Descubre talento ── */}
      {(especialistas.length > 0 || trabajadores.length > 0) && (
        <FadeInView delay={300}>
          <View style={talentStyles.section}>
            {/* Header sección */}
            <View style={talentStyles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[talentStyles.sectionTitle, { color: colors.textPrimary }]}>Descubre talento</Text>
                <Text style={[talentStyles.sectionSub, { color: colors.textMuted }]}>Trabajadores y especialistas disponibles</Text>
              </View>
              <AnimatedPressable
                style={[talentStyles.verTodosBtn, { borderColor: COLORS.primary }]}
                onPress={() => navigation.navigate('Trabajadores')}
                scaleValue={0.95} haptic
              >
                <Text style={[talentStyles.verTodosText, { color: COLORS.primary }]}>Ver todos</Text>
              </AnimatedPressable>
            </View>

            {/* Especialistas — scroll horizontal */}
            {especialistas.length > 0 && (
              <View style={{ marginBottom: SPACING.md }}>
                <View style={talentStyles.subHeader}>
                  <View style={[talentStyles.espBadge, { backgroundColor: '#FDEAE5' }]}>
                    <Ionicons name="ribbon" size={11} color="#C0694A" />
                    <Text style={[talentStyles.espBadgeText, { color: '#C0694A' }]}>Especialistas</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={talentStyles.hScroll}>
                  {especialistas.slice(0, 6).map((esp) => (
                    <View key={esp.id} style={{ width: 280 }}>
                      <EspCard
                        item={esp}
                        colors={colors}
                        isDark={isDark}
                        onPress={(item) => navigation.navigate('Trabajadores', { screen: 'PerfilPublicoTrabajador', params: { trabajador_id: item.id, rol: 'especialista' } })}
                        onContact={contactarEspecialista}
                        loadingId={enviandoContactoId}
                        estadoContacto={contactosEstado[`esp_${esp.id}`] || null}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Trabajadores — scroll horizontal */}
            {trabajadores.length > 0 && (
              <View>
                <View style={talentStyles.subHeader}>
                  <View style={[talentStyles.espBadge, { backgroundColor: COLORS.primarySoft }]}>
                    <Ionicons name="people" size={11} color={COLORS.primary} />
                    <Text style={[talentStyles.espBadgeText, { color: COLORS.primary }]}>Trabajadores</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={talentStyles.hScroll}>
                  {trabajadores.slice(0, 8).map((t) => (
                    <View key={t.id} style={{ width: 280 }}>
                      <SocialWorkerCard
                        item={t}
                        colors={colors}
                        isDark={isDark}
                        onPress={(item) => navigation.navigate('Trabajadores', { screen: 'PerfilPublicoTrabajador', params: { trabajador_id: item.id, vacante_id: vacanteActiva?.id } })}
                        onContact={contactarTrabajador}
                        loadingContacto={Number(enviandoContactoId) === Number(t.id)}
                        estadoContacto={contactosEstado[t.id] || null}
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </FadeInView>
      )}
    </View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [trabajadores, especialistas, vacantes, user, estadoVerif, colors, isDark, mostrarTarjetaVerificacion, estadoIdentidad, postulantesCount, contactosEstado, enviandoContactoId, vacanteActiva]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.surface : '#F8FAF9' }]} edges={['top']}>
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderVacante}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(120, insets.bottom + 96) },
          { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MotiView
              from={{ translateY: 0 }}
              animate={{ translateY: -8 }}
              transition={{
                type: 'timing',
                duration: 1500,
                loop: true,
                repeatReverse: true,
              }}
            >
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={44} color={COLORS.primaryLight} />
              </View>
            </MotiView>
            <FadeInView delay={200}>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {tabActiva === 'activa' ? 'Sin vacantes activas' : 'Sin vacantes inactivas'}
              </Text>
            </FadeInView>
            <FadeInView delay={300}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {tabActiva === 'activa'
                  ? 'Crea tu primera vacante y empieza a recibir postulantes'
                  : 'Las vacantes cerradas aparecerán aquí'}
              </Text>
            </FadeInView>
            {tabActiva === 'activa' && (
              <FadeInView delay={400}>
                <AnimatedPressable
                  style={styles.emptyBtn}
                  onPress={() => navigation.navigate('CrearVacante')}
                  scaleValue={0.96}
                  haptic
                >
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
                  <Text style={styles.emptyBtnText}>Crear vacante</Text>
                </AnimatedPressable>
              </FadeInView>
            )}
          </View>
        }
      />

      <Modal
        visible={modalReVerif}
        animationType="slide"
        onRequestClose={() => setModalReVerif(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.reVerifHeader}>
            <TouchableOpacity onPress={() => setModalReVerif(false)}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.reVerifTitle, { color: colors.textPrimary }]}>Nueva verificación</Text>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView contentContainerStyle={styles.reVerifContent}>
            <Text style={[styles.reVerifDesc, { color: colors.textSecondary }]}>
              Toma las dos fotos para reenviar tu verificación de identidad. Solo se permite cámara.
            </Text>

            <Text style={[styles.reVerifSeccion, { color: colors.textPrimary }]}>1. Selfie (tu rostro)</Text>
            {fotosReVerif.selfie ? (
              <View style={styles.reVerifCheck}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Selfie enviada</Text>
              </View>
            ) : (
              <CamaraFoto
                tipo="selfie"
                label="Tomar selfie"
                modoLocal={false}
                permitirGaleria={false}
                onFotoGuardada={(tipo) => setFotosReVerif(prev => ({ ...prev, selfie: true }))}
              />
            )}

            <Text style={[styles.reVerifSeccion, { color: colors.textPrimary }]}>2. Selfie con cédula</Text>
            {fotosReVerif.selfie_cedula ? (
              <View style={styles.reVerifCheck}>
                <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Foto con cédula enviada</Text>
              </View>
            ) : (
              <CamaraFoto
                tipo="selfie_cedula"
                label="Tomar foto con cédula"
                modoLocal={false}
                permitirGaleria={false}
                onFotoGuardada={(tipo) => setFotosReVerif(prev => ({ ...prev, selfie_cedula: true }))}
              />
            )}

            {fotosReVerif.selfie && fotosReVerif.selfie_cedula && (
              <TouchableOpacity
                style={styles.reVerifEnviarBtn}
                onPress={() => {
                  updateUser({ validacion_identidad_estado: 'pendiente' });
                  setEstadoVerif('pendiente');
                  setModalReVerif(false);
                }}
              >
                <Ionicons name="shield-checkmark" size={18} color={COLORS.white} />
                <Text style={styles.reVerifEnviarText}>Listo, enviar a revisión</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(vacanteAArchivar)}
        transparent
        animationType="fade"
        onRequestClose={cerrarConfirmacionArchivar}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: isDark ? 'rgba(13,27,22,0.7)' : 'rgba(15, 23, 42, 0.45)' }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="archive-outline" size={22} color={COLORS.accent} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Archivar vacante</Text>
            <Text style={[styles.modalText, { color: colors.textPrimary }]}>
              {`¿Deseas archivar "${vacanteAArchivar?.titulo || 'esta vacante'}"?`}
            </Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Ya no aparecerá a trabajadores, pero seguirá en tu historial.
            </Text>

            {vacanteAArchivar?.__error ? (
              <View style={styles.modalErrorWrap}>
                <Ionicons name="alert-circle-outline" size={14} color={COLORS.error} />
                <Text style={styles.modalErrorText}>{vacanteAArchivar.__error}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <AnimatedPressable
                style={[styles.modalBtn, styles.modalBtnGhost, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border }]}
                onPress={cerrarConfirmacionArchivar}
                disabled={Boolean(archivandoId)}
                scaleValue={0.97}
              >
                <Text style={[styles.modalBtnGhostText, { color: colors.textSecondary }]}>Cancelar</Text>
              </AnimatedPressable>

              <AnimatedPressable
                style={[styles.modalBtn, styles.modalBtnDanger, archivandoId && styles.modalBtnDisabled]}
                onPress={confirmarArchivar}
                disabled={Boolean(archivandoId)}
                scaleValue={0.97}
                haptic
              >
                {archivandoId ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="archive" size={14} color={COLORS.white} />
                    <Text style={styles.modalBtnDangerText}>Sí, archivar</Text>
                  </>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF9' },

  /* App bar */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  appBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarLogoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  appBarLogoLetter: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  appBarLogoText: { fontSize: 16, fontWeight: '700' },
  appBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },

  /* Filter chips */
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...SHADOWS.light,
  },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  filterChipCount: { fontSize: 12, fontWeight: '600' },

  /* Explorar ofertas button */
  explorarBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    borderRadius: RADIUS.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 22,
    elevation: 4,
  },
  explorarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#c1ff72',
    borderRadius: RADIUS.lg,
  },
  explorarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  explorarIconCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  explorarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0E1410',
    letterSpacing: -0.2,
  },
  explorarSub: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.55)',
    marginTop: 1,
  },

  /* Greeting */
  greetingSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.xs,
  },
  greetingLeft: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  greetingRight: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  greetingIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },

  /* Title header */
  titleHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  titleHeaderLeft: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  titleBadge: {
    minWidth: 26, height: 24, paddingHorizontal: 8,
    borderRadius: 99, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  titleBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  screenSubtitle: { fontSize: 13, marginTop: 3 },
  avatarContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  verificadoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingLabel: {
    fontSize: 14, color: COLORS.textSecondary, fontWeight: '500',
  },
  greetingName: {
    fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 28,
  },
  notifBadge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.error,
    borderWidth: 2, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  verificacionCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    ...SHADOWS.small,
  },
  verificacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  verificacionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  verificacionText: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  verificacionAyuda: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  reVerifBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.error, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start',
    marginTop: 4,
  },
  reVerifBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  reVerifHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  reVerifTitle: { fontSize: 17, fontWeight: '700' },
  reVerifContent: { padding: SPACING.lg, gap: SPACING.sm },
  reVerifDesc: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.md },
  reVerifSeccion: { fontSize: 15, fontWeight: '700', marginTop: SPACING.md, marginBottom: 4 },
  reVerifCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  reVerifEnviarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 14, marginTop: SPACING.xl,
  },
  reVerifEnviarText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },

  /* Header */
  header: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBottomRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  countBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  addBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    ...SHADOWS.button,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  postulantesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.2, borderColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  postulantesBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  postulantesCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  postulantesCountText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  /* Tabs */
  tabs: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.md,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: COLORS.primarySoft },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabCount: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  tabCountActive: { backgroundColor: COLORS.primary },
  tabCountText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  tabCountTextActive: { color: COLORS.white },

  /* List */
  list: { paddingBottom: 100 },

  /* Card */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
    overflow: 'hidden',
    position: 'relative',
  },
  cardInactiva: { opacity: 0.7 },
  cardPressable: { flexDirection: 'row', padding: SPACING.md },
  cardActionsOverlay: {
    position: 'absolute', top: SPACING.sm + 2, right: SPACING.sm + 2,
    flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10,
  },
  actionBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.small,
  },

  cardImg: {
    width: 76, height: 76,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
    flexShrink: 0,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: {
    flex: 1, backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  statusDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.white,
  },

  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 4, paddingRight: 50,
  },
  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
  },
  estadoBadgeInactiva: { backgroundColor: '#F3F4F6' },
  estadoDot: { width: 6, height: 6, borderRadius: 3 },
  estadoText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  estadoTextInactiva: { color: COLORS.textSecondary },

  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardTitleInactiva: { color: COLORS.textSecondary },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  cardLocation: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  salaryText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  startDateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  startDateBadgeText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  postulantesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postulantesText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cubiertoWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cubierto: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  timeText: { fontSize: 11, color: COLORS.textLight },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs, textAlign: 'center' },
  emptyText: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg, paddingVertical: 13,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    ...SHADOWS.large,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  modalText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  modalSubtext: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  modalErrorWrap: {
    marginTop: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  modalActions: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modalBtnGhost: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalBtnDanger: {
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: '#E26F00',
  },
  modalBtnDangerText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalBtnDisabled: {
    opacity: 0.75,
  },

  /* Resumen card */
  resumenCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  resumenTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resumenTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  resumenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c1ff72',
  },
  resumenStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  resumenStat: {
    flex: 1,
    alignItems: 'center',
  },
  resumenNum: {
    fontSize: 38,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 44,
  },
  resumenLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    marginTop: 2,
  },
  resumenDiv: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  resumenMensaje: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  resumenMensajeText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    lineHeight: 16,
  },
});

const talentStyles = StyleSheet.create({
  section: { paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: '#E8EDE8', marginTop: SPACING.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, marginTop: 2 },
  verTodosBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1.5 },
  verTodosText: { fontSize: 13, fontWeight: '700' },
  subHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },
  espBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  espBadgeText: { fontSize: 12, fontWeight: '700' },
  hScroll: { paddingHorizontal: SPACING.md, gap: SPACING.sm, paddingBottom: 4 },
});
