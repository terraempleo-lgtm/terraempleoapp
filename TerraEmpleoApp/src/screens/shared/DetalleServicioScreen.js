import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Dimensions, Modal, Pressable, Linking, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { serviciosAPI, especialistasAPI, chatsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert } from '../../utils/alertService';

const W = Dimensions.get('window').width;
const HERO_H = 300;

export default function DetalleServicioScreen({ route, navigation }) {
  const { servicio_id, servicio: servicioParam } = route.params || {};
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [servicio, setServicio] = useState(servicioParam || null);
  const [cargando, setCargando] = useState(!servicioParam);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [fotoModal, setFotoModal] = useState(null);
  const [contactando, setContactando] = useState(false);

  useEffect(() => {
    if (!servicio && servicio_id) cargar();
  }, [servicio_id]);

  const cargar = async () => {
    try {
      const res = await serviciosAPI.detalle(servicio_id);
      setServicio(res.data.servicio);
    } catch (e) {
      showAlert('Error', 'No se pudo cargar el servicio');
    } finally {
      setCargando(false);
    }
  };

  const irAlChat = async () => {
    if (!servicio) return;
    try {
      setContactando(true);
      const res = await especialistasAPI.contactarDirecto(servicio.especialista_id);
      const chatId = res.data?.chat_id;
      if (chatId) {
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: { chat: { id: chatId, otro_nombre: servicio.nombre_completo, otro_foto: servicio.foto_selfie } },
        });
      }
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'No se pudo abrir el chat');
    } finally {
      setContactando(false);
    }
  };

  const llamarEspecialista = () => {
    const cel = servicio?.celular;
    if (!cel) { showAlert('Sin número', 'El especialista no tiene número registrado.'); return; }
    const url = `tel:${cel}`;
    if (Platform.OS === 'web') {
      Alert.alert('Llamar', `Número: ${cel}`);
      return;
    }
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else showAlert('Error', 'No se pudo realizar la llamada.');
    });
  };

  if (cargando) return (
    <View style={[st.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  if (!servicio) return (
    <View style={[st.centered, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.textMuted }}>Servicio no disponible</Text>
    </View>
  );

  const fotos = servicio.fotos || [];
  const carouselRef = useRef(null);

  const onCarouselScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setFotoIdx(idx);
  };

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── HERO CARRUSEL ── */}
        <View style={st.heroWrap}>
          {fotos.length > 0 ? (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onCarouselScroll}
              style={{ width: W, height: HERO_H }}
            >
              {fotos.map((f, i) => (
                <TouchableOpacity key={i} activeOpacity={0.92} onPress={() => setFotoModal(f.url)} style={{ width: W, height: HERO_H }}>
                  <Image source={{ uri: f.url }} style={{ width: W, height: HERO_H }} resizeMode="cover" />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={st.heroOverlay} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <LinearGradient colors={['#1B5E20', '#2E7D32', '#43A047']} style={st.heroImg} />
          )}

          {/* Back btn */}
          <TouchableOpacity style={[st.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Dots carrusel */}
          {fotos.length > 1 && (
            <View style={st.dotsRow}>
              {fotos.map((_, i) => (
                <View key={i} style={[st.dot, { backgroundColor: i === fotoIdx ? '#fff' : 'rgba(255,255,255,0.45)', width: i === fotoIdx ? 18 : 6 }]} />
              ))}
            </View>
          )}

          {/* Título encima del hero */}
          <View style={st.heroBottom}>
            <Text style={st.heroTitulo}>{servicio.titulo}</Text>
            {fotos.length > 1 && (
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{fotoIdx + 1} / {fotos.length}</Text>
            )}
          </View>
        </View>

        {/* ── CARD ESPECIALISTA ── */}
        <TouchableOpacity
          style={[st.espCard, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: servicio.especialista_id, rol: 'especialista' })}
          activeOpacity={0.85}
        >
          {servicio.foto_selfie ? (
            <Image source={{ uri: servicio.foto_selfie }} style={st.espAvatar} />
          ) : (
            <View style={[st.espAvatarFallback, { backgroundColor: COLORS.primary }]}>
              <Text style={st.espInitials}>{(servicio.nombre_completo || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[st.espNombre, { color: colors.textPrimary }]}>{servicio.nombre_completo}</Text>
            <Text style={[st.espTitulo, { color: colors.textSecondary }]}>{servicio.titulo_profesional || 'Especialista'}</Text>
            {(servicio.municipio || servicio.departamento) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                <Text style={[st.espLoc, { color: colors.textMuted }]}>
                  {[servicio.municipio, servicio.departamento].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={[st.verPerfil, { color: COLORS.primary }]}>Ver perfil</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        <View style={{ paddingHorizontal: SPACING.md, gap: 14 }}>
          {/* Cultivos */}
          {servicio.cultivos?.length > 0 && (
            <View style={[st.section, { backgroundColor: colors.surface }]}>
              <View style={st.sectionHeader}>
                <LinearGradient colors={['#16A34A', '#22C55E']} style={st.sectionIcon}>
                  <Ionicons name="leaf" size={14} color="#fff" />
                </LinearGradient>
                <Text style={[st.sectionTitle, { color: colors.textPrimary }]}>Cultivos / Áreas</Text>
              </View>
              <View style={st.chips}>
                {servicio.cultivos.map((c, i) => (
                  <View key={i} style={[st.chip, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name="leaf-outline" size={11} color={COLORS.primary} />
                    <Text style={[st.chipTxt, { color: COLORS.primary }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Descripción */}
          {servicio.descripcion ? (
            <View style={[st.section, { backgroundColor: colors.surface }]}>
              <View style={st.sectionHeader}>
                <LinearGradient colors={['#0284C7', '#0EA5E9']} style={st.sectionIcon}>
                  <Ionicons name="document-text-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={[st.sectionTitle, { color: colors.textPrimary }]}>Descripción del servicio</Text>
              </View>
              <Text style={[st.descTxt, { color: colors.textSecondary }]}>{servicio.descripcion}</Text>
            </View>
          ) : null}

          {/* Precio y modalidad */}
          {(servicio.precio_desde || servicio.precio_hasta || servicio.modalidad) && (
            <View style={[st.section, { backgroundColor: colors.surface }]}>
              <View style={st.sectionHeader}>
                <LinearGradient colors={['#D97706', '#F59E0B']} style={st.sectionIcon}>
                  <Ionicons name="cash-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={[st.sectionTitle, { color: colors.textPrimary }]}>Precio</Text>
              </View>
              {(servicio.precio_desde || servicio.precio_hasta) && (
                <Text style={[st.precioTxt, { color: COLORS.primary }]}>
                  {servicio.precio_desde ? `$${Number(servicio.precio_desde).toLocaleString()}` : ''}
                  {servicio.precio_desde && servicio.precio_hasta ? ' – ' : ''}
                  {servicio.precio_hasta ? `$${Number(servicio.precio_hasta).toLocaleString()}` : ''}
                  {' COP'}
                </Text>
              )}
              {servicio.modalidad && (
                <View style={[st.chip, { backgroundColor: '#E0F2FE', alignSelf: 'flex-start', marginTop: 8 }]}>
                  <Text style={[st.chipTxt, { color: '#0284C7' }]}>{servicio.modalidad}</Text>
                </View>
              )}
            </View>
          )}

          {/* Galería fotos */}
          {fotos.length > 1 && (
            <View style={[st.section, { backgroundColor: colors.surface }]}>
              <View style={st.sectionHeader}>
                <LinearGradient colors={['#7C3AED', '#A855F7']} style={st.sectionIcon}>
                  <Ionicons name="images-outline" size={14} color="#fff" />
                </LinearGradient>
                <Text style={[st.sectionTitle, { color: colors.textPrimary }]}>Galería de trabajos</Text>
              </View>
              <View style={st.galeria}>
                {fotos.map((f, i) => (
                  <TouchableOpacity key={i} onPress={() => setFotoModal(f.url)} activeOpacity={0.88} style={st.galeriaItem}>
                    <Image source={{ uri: f.url }} style={st.galeriaImg} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA — solo para empleadores */}
      {user?.rol === 'empleador' && (
        <View style={[st.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[st.ctaBtnCall, { borderColor: COLORS.primary }]}
            onPress={llamarEspecialista}
            activeOpacity={0.8}
          >
            <Ionicons name="call" size={20} color={COLORS.primary} />
            <Text style={[st.ctaTxtCall, { color: COLORS.primary }]}>Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.ctaBtn, { backgroundColor: COLORS.primary, opacity: contactando ? 0.7 : 1, flex: 1 }]}
            onPress={irAlChat}
            disabled={contactando}
            activeOpacity={0.85}
          >
            {contactando ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />}
            <Text style={st.ctaTxt}>{contactando ? 'Abriendo...' : 'Ir al chat'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Foto fullscreen */}
      <Modal visible={!!fotoModal} transparent animationType="fade" onRequestClose={() => setFotoModal(null)}>
        <Pressable style={st.fotoFullscreen} onPress={() => setFotoModal(null)}>
          {fotoModal && <Image source={{ uri: fotoModal }} style={st.fotoFull} resizeMode="contain" />}
          <Text style={st.fotoHint}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { height: HERO_H, position: 'relative' },
  heroImg: { width: '100%', height: HERO_H },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  backBtn: { position: 'absolute', left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { position: 'absolute', bottom: 56, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md },
  heroTitulo: { fontSize: 22, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  // Especialista card
  espCard: { flexDirection: 'row', alignItems: 'center', margin: SPACING.md, borderRadius: 16, padding: 14, gap: 12, ...SHADOWS.medium },
  espAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: COLORS.primary + '40' },
  espAvatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  espInitials: { color: '#fff', fontSize: 20, fontWeight: '800' },
  espNombre: { fontSize: 15, fontWeight: '700' },
  espTitulo: { fontSize: 12, marginTop: 2 },
  espLoc: { fontSize: 11 },
  verPerfil: { fontSize: 13, fontWeight: '600' },
  // Sections
  section: { borderRadius: 16, padding: SPACING.md, ...SHADOWS.light },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  descTxt: { fontSize: 14, lineHeight: 22 },
  precioTxt: { fontSize: 20, fontWeight: '800' },
  galeria: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galeriaItem: { borderRadius: 10, overflow: 'hidden' },
  galeriaImg: { width: (W - SPACING.md * 2 - SPACING.md * 2 - 8) / 2, height: 120 },
  // Footer
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.md, borderTopWidth: 1, flexDirection: 'row', gap: 10 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, padding: 15 },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ctaBtnCall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16, padding: 15, borderWidth: 2, paddingHorizontal: 18 },
  ctaTxtCall: { fontWeight: '700', fontSize: 15 },
  // Foto fullscreen
  fotoFullscreen: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  fotoFull: { width: W, height: W * 1.2 },
  fotoHint: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 13 },
});
