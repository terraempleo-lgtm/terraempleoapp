import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Linking, Pressable, Alert, Share, Dimensions, Modal, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, chatsAPI, vacantesAPI, especialistasAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';

const LABELS_EXPERIENCIA = {
  sin: 'Sin experiencia', sin_experiencia: 'Sin experiencia', menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años', '3_5': '3 a 5 años', '5_10': '5 a 10 años', mas_10: 'Más de 10 años',
};
const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo', por_dias: 'Por días',
  temporada_cosecha: 'Por temporada / cosecha', fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Inmediata', inmediata: 'Inmediata',
};
const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios', primaria_completa: 'Primaria completa', bachiller: 'Bachiller',
  tecnico_tecnologo: 'Técnico / Tecnólogo', universitario: 'Universitario',
};

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

const W = Dimensions.get('window').width;
const FT_SIZE = (W - SPACING.md * 2 - SPACING.sm * 2) / 3;

function FotosTrabajoGrid({ fotos, colors }) {
  const [preview, setPreview] = useState(null);
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
        {fotos.map((f) => (
          <TouchableOpacity key={f.id} onPress={() => setPreview(f.url)} activeOpacity={0.85}>
            <Image source={{ uri: f.url }} style={{ width: FT_SIZE, height: FT_SIZE, borderRadius: RADIUS.md, backgroundColor: '#E5E7EB' }} />
          </TouchableOpacity>
        ))}
      </View>
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setPreview(null)}>
          {preview && <Image source={{ uri: preview }} style={{ width: W - 32, height: W - 32, borderRadius: RADIUS.lg }} resizeMode="contain" />}
          <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 13 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </>
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
  headerTitle: { fontSize: 15, fontWeight: '700' },
});

export default function PerfilPublicoTrabajadorScreen({ route, navigation }) {
  const { trabajador_id, vacante_id, postulacion_estado, rol: rolParam } = route.params;
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const esEspecialista = rolParam === 'especialista';
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [estadoActual, setEstadoActual] = useState(postulacion_estado || null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  useEffect(() => {
    cargarPerfil();
    syncEstadoPostulacion();
  }, [trabajador_id, vacante_id]);

  const cargarPerfil = async () => {
    try {
      if (esEspecialista) {
        const res = await especialistasAPI.perfil(trabajador_id);
        const d = res.data.especialista || res.data;
        setPerfil({ ...d, _esEspecialista: true });
      } else {
        const res = await trabajadoresAPI.perfilPublico(trabajador_id);
        setPerfil(res.data.trabajador);
      }
    } catch { showAlert('Error', 'No se pudo cargar el perfil'); }
    finally { setCargando(false); }
  };

  const syncEstadoPostulacion = async () => {
    if (!vacante_id) {
      setEstadoActual(postulacion_estado || null);
      return;
    }
    try {
      const res = await vacantesAPI.verPostulaciones(vacante_id);
      const post = (res.data.postulaciones || []).find((p) => Number(p.trabajador_id) === Number(trabajador_id));
      setEstadoActual(post?.estado || postulacion_estado || null);
    } catch {
      setEstadoActual(postulacion_estado || null);
    }
  };

  const irAlChat = async () => {
    if (!vacante_id) return;
    try {
      const res = await chatsAPI.chatPorVacanteTrabajador(vacante_id, trabajador_id);
      navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chat: { id: res.data.chat_id, otro_nombre: perfil?.nombre_completo, otro_foto: perfil?.foto_selfie } } });
    } catch { showAlert('Error', 'No se encontró el chat'); }
  };

  const cambiarEstado = async (estado) => {
    try {
      const res = await vacantesAPI.verPostulaciones(vacante_id);
      const post = (res.data.postulaciones || []).find(p => Number(p.trabajador_id) === Number(trabajador_id));
      if (post) {
        await vacantesAPI.actualizarPostulacion(post.id, estado);
        setEstadoActual(estado);
        showAlert('Listo', estado === 'aceptada' ? 'Candidato aceptado' : 'Candidato rechazado');
        navigation.goBack();
      }
    } catch (err) { showAlert('Error', err.response?.data?.error || 'Error al actualizar'); }
  };

  const solicitarContacto = async () => {
    if (enviandoSolicitud) return;
    if (!vacante_id) {
      Alert.alert('Sin vacante activa', 'Necesitas publicar una vacante antes de poder contactar trabajadores.');
      return;
    }
    try {
      setEnviandoSolicitud(true);
      const res = await trabajadoresAPI.contactar(trabajador_id, { vacante_id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);

      if (estado) setEstadoActual(estado);

      if (estado === 'aceptada' && chatId) {
        showAlert('Listo', 'El chat ya está habilitado con este trabajador.');
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: {
            chat: {
              id: chatId,
              otro_nombre: perfil?.nombre_completo,
              otro_foto: perfil?.foto_selfie,
            },
          },
        });
        return;
      }

      showAlert('Listo', 'Solicitud de contacto enviada. Si el trabajador acepta, se habilitará el chat.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud de contacto');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const abrirHojaVida = async () => {
    if (!perfil?.hoja_vida_url) return;
    try {
      const canOpen = await Linking.canOpenURL(perfil.hoja_vida_url);
      if (!canOpen) { showAlert('No disponible', 'No se pudo abrir la hoja de vida.'); return; }
      await Linking.openURL(perfil.hoja_vida_url);
    } catch (_) {
      showAlert('Error', 'No se pudo abrir la hoja de vida.');
    }
  };

  if (cargando) return (
    <View style={[s.centered, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
  if (!perfil) return (
    <View style={[s.centered, { backgroundColor: colors.background }]}>
      <Ionicons name="person-outline" size={48} color={colors.textMuted} />
      <Text style={[s.emptyTitle, { color: colors.textMuted }]}>Perfil no disponible</Text>
    </View>
  );

  const cal = parseFloat(perfil.calificacion_promedio || 0);
  const totalCal = Number(perfil.total_calificaciones || 0);
  const disponibilidad = LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad;
  const experiencia = LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia;
  const estudios = LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios;
  const cultivos = (perfil.cultivos || []).map(c => c.cultivo || c);
  const habilidades = (perfil.habilidades || []).map(h => h.habilidad || h);
  const ubicacion = [perfil.municipio, perfil.departamento].filter(Boolean).join(', ');
  const isPendiente = estadoActual === 'pendiente' || estadoActual === 'match_auto';
  const isSolicitudContacto = estadoActual === 'contacto_solicitado';
  const acercaDe = perfil.acerca_de?.trim();
  const initials = (perfil.nombre_completo || 'T')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hasFooter = isPendiente || estadoActual === 'aceptada' || !estadoActual || isSolicitudContacto;

  const solicitarContactoEspecialista = async () => {
    if (enviandoSolicitud) return;
    try {
      setEnviandoSolicitud(true);
      const res = await especialistasAPI.contactar(trabajador_id, { vacante_id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);
      if (estado) setEstadoActual(estado);
      if (estado === 'aceptada' && chatId) {
        Alert.alert('Listo', 'El chat ya está habilitado con este especialista.');
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: { chat: { id: chatId, otro_nombre: perfil?.nombre_completo, otro_foto: perfil?.foto_selfie } },
        });
        return;
      }
      Alert.alert('Listo', 'Solicitud enviada. Si el especialista acepta, se habilitará el chat.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  // ── Render especialista público ──
  if (perfil._esEspecialista) {
    const espEspecialidades = perfil.especialidades || [];
    const espCultivos = perfil.cultivos || [];
    const espFotos = perfil.fotos_trabajo || [];
    const NIVEL_LABELS = { empirico: 'Empírico / experiencia', tecnico_tecnologo: 'Técnico / Tecnólogo', profesional: 'Profesional' };
    const MODAL_LABELS = { por_proyecto: 'Por proyecto', por_dias: 'Por días', mensual: 'Mensual', asesoria_puntual: 'Asesoría puntual' };
    const RADIO_LABELS = { municipio: 'Solo mi municipio', departamento: 'Mi departamento', eje_cafetero: 'Eje Cafetero', nacional: 'Todo Colombia' };
    const EXP_LABELS = { menos_1: 'Menos de 1 año', '1_3': '1 a 3 años', '3_5': '3 a 5 años', '5_10': '5 a 10 años', mas_10: 'Más de 10 años' };
    const initEsp = (perfil.nombre_completo || 'E').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const espCal = parseFloat(perfil.calificacion_promedio || 0);
    const espTotalCal = Number(perfil.total_calificaciones || 0);
    const espExp = EXP_LABELS[perfil.anios_experiencia] || null;
    const hasFooterEsp = !estadoActual || estadoActual === 'aceptada' || estadoActual === 'contacto_solicitado';
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hasFooterEsp ? 120 : 40 }}>

          {/* HERO ESPECIALISTA — terracota */}
          <View style={r.heroOuter}>
            <LinearGradient colors={['#8B3A2A','#C0694A','#D4845A']} start={{x:0,y:0}} end={{x:1,y:1}} style={[r.heroGradient, { paddingTop: insets.top + 12 }]}>
              <AnimatedPressable style={r.backBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </AnimatedPressable>
              <View style={r.avatarOuter}>
                {perfil.foto_selfie?.startsWith('http') ? (
                  <Image source={{ uri: perfil.foto_selfie }} style={r.avatar} />
                ) : (
                  <View style={[r.avatarFallback, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={r.avatarInitials}>{initEsp}</Text>
                  </View>
                )}
                {perfil.verificado && <View style={r.verBadge}><Ionicons name="checkmark" size={11} color="#fff" /></View>}
              </View>
              <Text style={r.heroName}>{perfil.nombre_completo}</Text>
              {ubicacion ? (
                <View style={r.heroMeta}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={r.heroMetaTxt}>{ubicacion}</Text>
                </View>
              ) : null}
              <View style={r.pillsRow}>
                <View style={[r.disponPill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Ionicons name="ribbon" size={12} color="#FFD700" />
                  <Text style={r.disponTxt}>Especialista</Text>
                </View>
                {perfil.modalidad_trabajo && (
                  <View style={r.infoPill}>
                    <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.9)" />
                    <Text style={r.infoPillTxt}>{MODAL_LABELS[perfil.modalidad_trabajo] || perfil.modalidad_trabajo}</Text>
                  </View>
                )}
                {perfil.radio_cobertura && (
                  <View style={r.infoPill}>
                    <Ionicons name="navigate-outline" size={12} color="rgba(255,255,255,0.9)" />
                    <Text style={r.infoPillTxt}>{RADIO_LABELS[perfil.radio_cobertura] || perfil.radio_cobertura}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>

            {/* Stats flotantes */}
            <View style={[r.statsCard, { backgroundColor: colors.surface }]}>
              <View style={r.statItem}>
                <View style={[r.statIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="star" size={16} color="#D97706" />
                </View>
                <Text style={[r.statNum, { color: colors.textPrimary }]}>{espCal > 0 ? espCal.toFixed(1) : '—'}</Text>
                <Text style={[r.statLbl, { color: colors.textMuted }]}>Calificación</Text>
              </View>
              <View style={[r.statDivider, { backgroundColor: colors.border }]} />
              <View style={r.statItem}>
                <View style={[r.statIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="chatbubble-outline" size={16} color="#2563EB" />
                </View>
                <Text style={[r.statNum, { color: colors.textPrimary }]}>{espTotalCal}</Text>
                <Text style={[r.statLbl, { color: colors.textMuted }]}>Reseñas</Text>
              </View>
              <View style={[r.statDivider, { backgroundColor: colors.border }]} />
              <View style={r.statItem}>
                <View style={[r.statIcon, { backgroundColor: '#FDEAE5' }]}>
                  <Ionicons name="briefcase-outline" size={16} color="#C0694A" />
                </View>
                <Text style={[r.statNum, { color: colors.textPrimary }]} numberOfLines={1}>{espExp ? espExp.split(' ')[0] + (espExp.includes('año') ? ' años' : '') : '—'}</Text>
                <Text style={[r.statLbl, { color: colors.textMuted }]}>Experiencia</Text>
              </View>
            </View>
          </View>

          {/* Descripción */}
          {perfil.descripcion_servicio ? (
            <View style={[r.card, { backgroundColor: colors.surface }]}>
              <View style={r.cardHeader}>
                <LinearGradient colors={['#8B3A2A','#C0694A']} style={r.cardIconGrad}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Sobre el especialista</Text>
              </View>
              <Text style={[r.bodyText, { color: colors.textSecondary }]}>{perfil.descripcion_servicio}</Text>
              <View style={[r.chipRow, { marginTop: SPACING.sm }]}>
                {perfil.nivel_formacion && <View style={[r.chipNeutral, { backgroundColor: '#FDEAE5', borderColor: '#F5C4B5' }]}><Ionicons name="school-outline" size={11} color="#C0694A" /><Text style={[r.chipNeutralTxt, { color: '#8B3A2A' }]}>{NIVEL_LABELS[perfil.nivel_formacion] || perfil.nivel_formacion}</Text></View>}
                {perfil.titulo_certificacion && <View style={[r.chipNeutral, { backgroundColor: '#FDEAE5', borderColor: '#F5C4B5' }]}><Ionicons name="ribbon-outline" size={11} color="#C0694A" /><Text style={[r.chipNeutralTxt, { color: '#8B3A2A' }]}>{perfil.titulo_certificacion}</Text></View>}
              </View>
            </View>
          ) : null}

          {/* Hoja de vida */}
          {perfil.hoja_vida_url ? (
            <AnimatedPressable onPress={async () => {
              try { await Linking.openURL(perfil.hoja_vida_url); } catch {}
            }} activeOpacity={0.88}>
              <LinearGradient colors={['#8B3A2A','#C0694A']} start={{x:0,y:0}} end={{x:1,y:0}} style={r.cvCard}>
                <View style={r.cvIconWrap}><Ionicons name="document-text" size={26} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={r.cvLabel}>Hoja de vida disponible</Text>
                  <Text style={r.cvName} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
                </View>
                <View style={r.cvArrow}><Ionicons name="open-outline" size={18} color="#fff" /></View>
              </LinearGradient>
            </AnimatedPressable>
          ) : null}

          {/* Especialidades */}
          {espEspecialidades.length > 0 && (
            <View style={[r.card, { backgroundColor: colors.surface }]}>
              <View style={r.cardHeader}>
                <LinearGradient colors={['#8B3A2A','#C0694A']} style={r.cardIconGrad}>
                  <Ionicons name="ribbon-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Especialidades</Text>
              </View>
              <View style={r.chipRow}>
                {espEspecialidades.map((e, i) => (
                  <View key={i} style={[r.chipGreen, { backgroundColor: '#FDEAE5', borderColor: '#F5C4B5' }]}>
                    <Ionicons name="star-outline" size={11} color="#C0694A" />
                    <Text style={[r.chipGreenTxt, { color: '#8B3A2A' }]}>{e}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Cultivos */}
          {espCultivos.length > 0 && (
            <View style={[r.card, { backgroundColor: colors.surface }]}>
              <View style={r.cardHeader}>
                <LinearGradient colors={['#2E7D32','#43A047']} style={r.cardIconGrad}>
                  <Ionicons name="leaf-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Cultivos y producciones</Text>
              </View>
              <View style={r.chipRow}>
                {espCultivos.map((c, i) => (
                  <View key={i} style={[r.chipGreen, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
                    <Ionicons name="leaf" size={11} color={COLORS.primary} />
                    <Text style={[r.chipGreenTxt, { color: COLORS.primary }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Experiencias laborales especialista */}
          {(perfil.experiencias || []).length > 0 && (
            <View style={[r.card, { backgroundColor: colors.surface }]}>
              <View style={r.cardHeader}>
                <LinearGradient colors={['#7C3AED','#6D28D9']} style={r.cardIconGrad}>
                  <Ionicons name="briefcase" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Experiencias laborales</Text>
              </View>
              {perfil.experiencias.map((exp, i) => (
                <View key={exp.id || i} style={[r.expRow, { borderBottomColor: colors.border, borderBottomWidth: i < perfil.experiencias.length - 1 ? 1 : 0 }]}>
                  <View style={[r.expDot, { backgroundColor: '#EDE9FE' }]}><Ionicons name="business-outline" size={15} color="#7C3AED" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[r.expValue, { color: colors.textPrimary }]}>{exp.entidad}</Text>
                    {!!exp.duracion && <Text style={[r.expLabel, { color: colors.textMuted }]}>{exp.duracion}</Text>}
                    {!!exp.descripcion && <Text style={[r.expLabel, { color: colors.textSecondary, marginTop: 2 }]}>{exp.descripcion}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Fotos de trabajo */}
          {espFotos.length > 0 && (
            <View style={[r.card, { backgroundColor: colors.surface }]}>
              <View style={r.cardHeader}>
                <LinearGradient colors={['#B45309','#D97706']} style={r.cardIconGrad}>
                  <Ionicons name="images-outline" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Fotos de trabajo</Text>
              </View>
              <View style={r.fotosGrid}>
                {espFotos.map((f, i) => (
                  <TouchableOpacity key={f.id || i} onPress={() => setFotoPreview(f.url)} activeOpacity={0.88} style={r.fotoWrap}>
                    <Image source={{ uri: f.url }} style={r.fotoImg} />
                    <LinearGradient colors={['transparent','rgba(0,0,0,0.35)']} style={r.fotoOverlay} />
                    <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.9)" style={r.fotoExpandIcon} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Preview foto fullscreen */}
        <Modal visible={!!fotoPreview} transparent animationType="fade" onRequestClose={() => setFotoPreview(null)}>
          <Pressable style={r.fotoModal} onPress={() => setFotoPreview(null)}>
            {fotoPreview && <Image source={{ uri: fotoPreview }} style={r.fotoModalImg} resizeMode="contain" />}
            <Text style={r.fotoModalHint}>Toca para cerrar</Text>
          </Pressable>
        </Modal>

        {/* Footer CTA */}
        {estadoActual === 'aceptada' ? (
          <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <AnimatedPressable style={[s.primaryBtn, { backgroundColor: colors.primary }]} onPress={irAlChat}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
              <Text style={s.primaryBtnTxt}>Ir al chat</Text>
            </AnimatedPressable>
          </View>
        ) : estadoActual === 'contacto_solicitado' ? (
          <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[s.infoPill, { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warning + '40' }]}>
              <Ionicons name="hourglass-outline" size={16} color={COLORS.warning} />
              <Text style={[s.infoPillTxt, { color: COLORS.warning }]}>Solicitud enviada. Esperando respuesta del especialista.</Text>
            </View>
          </View>
        ) : !estadoActual ? (
          <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <AnimatedPressable
              style={[s.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={solicitarContactoEspecialista}
              disabled={enviandoSolicitud}
            >
              <Ionicons name={enviandoSolicitud ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={20} color="#fff" />
              <Text style={s.primaryBtnTxt}>{enviandoSolicitud ? 'Enviando...' : 'Contactar especialista'}</Text>
            </AnimatedPressable>
          </View>
        ) : null}
      </View>
    );
  }

  const fotosTrabajo = perfil.fotos_trabajo || [];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hasFooter ? 120 : 40 }}>

        {/* ── HERO CON GRADIENTE ── */}
        <View style={r.heroOuter}>
          <LinearGradient colors={['#1B5E20','#2E7D32','#43A047']} start={{x:0,y:0}} end={{x:1,y:1}} style={[r.heroGradient, { paddingTop: insets.top + 12 }]}>
            {/* Back btn */}
            <AnimatedPressable style={r.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </AnimatedPressable>

            {/* Avatar */}
            <View style={r.avatarOuter}>
              {perfil.foto_selfie?.startsWith('http') ? (
                <Image source={{ uri: perfil.foto_selfie }} style={r.avatar} />
              ) : (
                <View style={[r.avatarFallback, { backgroundColor: '#fff2' }]}>
                  <Text style={r.avatarInitials}>{initials}</Text>
                </View>
              )}
              {perfil.validacion_identidad_estado === 'aprobada' && (
                <View style={r.verBadge}><Ionicons name="checkmark" size={11} color="#fff" /></View>
              )}
            </View>

            {/* Nombre */}
            <Text style={r.heroName}>{perfil.nombre_completo}</Text>

            {/* Ubicación */}
            {ubicacion ? (
              <View style={r.heroMeta}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
                <Text style={r.heroMetaTxt}>{ubicacion}</Text>
              </View>
            ) : null}

            {/* Pills */}
            <View style={r.pillsRow}>
              <View style={r.disponPill}>
                <View style={r.disponDot} />
                <Text style={r.disponTxt}>Disponible</Text>
              </View>
              {disponibilidad ? (
                <View style={r.infoPill}>
                  <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.9)" />
                  <Text style={r.infoPillTxt}>{disponibilidad}</Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {/* Stats flotantes */}
          <View style={[r.statsCard, { backgroundColor: colors.surface }]}>
            <View style={r.statItem}>
              <View style={[r.statIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="star" size={16} color="#D97706" />
              </View>
              <Text style={[r.statNum, { color: colors.textPrimary }]}>{cal > 0 ? cal.toFixed(1) : '—'}</Text>
              <Text style={[r.statLbl, { color: colors.textMuted }]}>Calificación</Text>
            </View>
            <View style={[r.statDivider, { backgroundColor: colors.border }]} />
            <View style={r.statItem}>
              <View style={[r.statIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="chatbubble-outline" size={16} color="#2563EB" />
              </View>
              <Text style={[r.statNum, { color: colors.textPrimary }]}>{totalCal}</Text>
              <Text style={[r.statLbl, { color: colors.textMuted }]}>Reseñas</Text>
            </View>
            <View style={[r.statDivider, { backgroundColor: colors.border }]} />
            <View style={r.statItem}>
              <View style={[r.statIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="briefcase-outline" size={16} color="#059669" />
              </View>
              <Text style={[r.statNum, { color: colors.textPrimary }]} numberOfLines={1}>{experiencia ? experiencia.split(' ')[0] + (experiencia.includes('año') ? ' años' : '') : '—'}</Text>
              <Text style={[r.statLbl, { color: colors.textMuted }]}>Experiencia</Text>
            </View>
          </View>
        </View>

        {/* ── ACERCA DE ── */}
        {acercaDe ? (
          <View style={[r.card, { backgroundColor: colors.surface }]}>
            <View style={r.cardHeader}>
              <LinearGradient colors={['#2E7D32','#43A047']} style={r.cardIconGrad}>
                <Ionicons name="person-circle-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Acerca de</Text>
            </View>
            <Text style={[r.bodyText, { color: colors.textSecondary }]}>{acercaDe}</Text>
          </View>
        ) : null}

        {/* ── HOJA DE VIDA ── */}
        {perfil.hoja_vida_url ? (
          <AnimatedPressable onPress={abrirHojaVida} activeOpacity={0.88}>
            <LinearGradient colors={['#1B5E20','#2E7D32']} start={{x:0,y:0}} end={{x:1,y:0}} style={r.cvCard}>
              <View style={r.cvIconWrap}>
                <Ionicons name="document-text" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={r.cvLabel}>Hoja de vida disponible</Text>
                <Text style={r.cvName} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
              </View>
              <View style={r.cvArrow}>
                <Ionicons name="open-outline" size={18} color="#fff" />
              </View>
            </LinearGradient>
          </AnimatedPressable>
        ) : null}

        {/* ── CULTIVOS & HABILIDADES ── */}
        {(cultivos.length > 0 || habilidades.length > 0) && (
          <View style={[r.card, { backgroundColor: colors.surface }]}>
            <View style={r.cardHeader}>
              <LinearGradient colors={['#2E7D32','#43A047']} style={r.cardIconGrad}>
                <Ionicons name="leaf-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Cultivos y Habilidades</Text>
            </View>
            {cultivos.length > 0 && (
              <>
                <Text style={[r.chipGroupLabel, { color: colors.textMuted }]}>Cultivos</Text>
                <View style={r.chipRow}>
                  {cultivos.map((c, i) => (
                    <View key={i} style={[r.chipGreen, { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary + '30' }]}>
                      <Ionicons name="leaf" size={11} color={COLORS.primary} />
                      <Text style={[r.chipGreenTxt, { color: COLORS.primary }]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {habilidades.length > 0 && (
              <>
                <Text style={[r.chipGroupLabel, { color: colors.textMuted, marginTop: cultivos.length > 0 ? 10 : 0 }]}>Habilidades</Text>
                <View style={r.chipRow}>
                  {habilidades.map((h, i) => (
                    <View key={i} style={[r.chipNeutral, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Ionicons name="construct-outline" size={11} color={colors.textMuted} />
                      <Text style={[r.chipNeutralTxt, { color: colors.textSecondary }]}>{h}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* ── EXPERIENCIA Y FORMACIÓN ── */}
        {(experiencia || estudios || perfil.titulo_estudio) && (
          <View style={[r.card, { backgroundColor: colors.surface }]}>
            <View style={r.cardHeader}>
              <LinearGradient colors={['#1565C0','#1976D2']} style={r.cardIconGrad}>
                <Ionicons name="briefcase-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Experiencia y Formación</Text>
            </View>
            {experiencia && (
              <View style={[r.expRow, { borderBottomColor: colors.border, borderBottomWidth: estudios || perfil.titulo_estudio ? 1 : 0 }]}>
                <View style={[r.expDot, { backgroundColor: '#D1FAE5' }]}><Ionicons name="time-outline" size={15} color="#059669" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[r.expLabel, { color: colors.textMuted }]}>Experiencia agrícola</Text>
                  <Text style={[r.expValue, { color: colors.textPrimary }]}>{experiencia}</Text>
                </View>
              </View>
            )}
            {estudios && (
              <View style={[r.expRow, { borderBottomColor: colors.border, borderBottomWidth: perfil.titulo_estudio ? 1 : 0 }]}>
                <View style={[r.expDot, { backgroundColor: '#DBEAFE' }]}><Ionicons name="school-outline" size={15} color="#2563EB" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[r.expLabel, { color: colors.textMuted }]}>Nivel de estudios</Text>
                  <Text style={[r.expValue, { color: colors.textPrimary }]}>{estudios}</Text>
                </View>
              </View>
            )}
            {perfil.titulo_estudio && (
              <View style={[r.expRow, { borderBottomWidth: 0 }]}>
                <View style={[r.expDot, { backgroundColor: '#F3E8FF' }]}><Ionicons name="ribbon-outline" size={15} color="#7C3AED" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[r.expLabel, { color: colors.textMuted }]}>Título</Text>
                  <Text style={[r.expValue, { color: colors.textPrimary }]}>{perfil.titulo_estudio}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── EXPERIENCIAS LABORALES (trabajador) ── */}
        {(perfil.experiencias || []).length > 0 && (
          <View style={[r.card, { backgroundColor: colors.surface }]}>
            <View style={r.cardHeader}>
              <LinearGradient colors={['#7C3AED','#6D28D9']} style={r.cardIconGrad}>
                <Ionicons name="briefcase" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Experiencias laborales</Text>
            </View>
            {perfil.experiencias.map((exp, i) => (
              <View key={exp.id || i} style={[r.expRow, { borderBottomColor: colors.border, borderBottomWidth: i < perfil.experiencias.length - 1 ? 1 : 0 }]}>
                <View style={[r.expDot, { backgroundColor: '#EDE9FE' }]}><Ionicons name="business-outline" size={15} color="#7C3AED" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[r.expValue, { color: colors.textPrimary }]}>{exp.entidad}</Text>
                  {!!exp.duracion && <Text style={[r.expLabel, { color: colors.textMuted }]}>{exp.duracion}</Text>}
                  {!!exp.descripcion && <Text style={[r.expLabel, { color: colors.textSecondary, marginTop: 2 }]}>{exp.descripcion}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── FOTOS DE TRABAJO ── */}
        {fotosTrabajo.length > 0 && (
          <View style={[r.card, { backgroundColor: colors.surface }]}>
            <View style={r.cardHeader}>
              <LinearGradient colors={['#B45309','#D97706']} style={r.cardIconGrad}>
                <Ionicons name="images-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Fotos de trabajo</Text>
              <Text style={[r.chipGroupLabel, { color: colors.textMuted, marginLeft: 'auto', marginBottom: 0 }]}>{fotosTrabajo.length} foto{fotosTrabajo.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={r.fotosGrid}>
              {fotosTrabajo.map((f, i) => (
                <TouchableOpacity key={f.id || i} onPress={() => setFotoPreview(f.url)} activeOpacity={0.88} style={r.fotoWrap}>
                  <Image source={{ uri: f.url }} style={r.fotoImg} />
                  <LinearGradient colors={['transparent','rgba(0,0,0,0.35)']} style={r.fotoOverlay} />
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.9)" style={r.fotoExpandIcon} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── DISPONIBILIDAD & UBICACIÓN ── */}
        <View style={[r.card, { backgroundColor: colors.surface }]}>
          <View style={r.cardHeader}>
            <LinearGradient colors={['#0F766E','#0D9488']} style={r.cardIconGrad}>
              <Ionicons name="information-circle-outline" size={16} color="#fff" />
            </LinearGradient>
            <Text style={[r.cardTitle, { color: colors.textPrimary }]}>Información</Text>
          </View>
          <View style={r.infoGrid}>
            {ubicacion ? (
              <View style={[r.infoChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                <Text style={[r.infoChipTxt, { color: colors.textSecondary }]}>{ubicacion}</Text>
              </View>
            ) : null}
            {disponibilidad ? (
              <View style={[r.infoChip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={[r.infoChipTxt, { color: colors.textSecondary }]}>{disponibilidad}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Preview foto fullscreen */}
      <Modal visible={!!fotoPreview} transparent animationType="fade" onRequestClose={() => setFotoPreview(null)}>
        <Pressable style={r.fotoModal} onPress={() => setFotoPreview(null)}>
          {fotoPreview && <Image source={{ uri: fotoPreview }} style={r.fotoModalImg} resizeMode="contain" />}
          <Text style={r.fotoModalHint}>Toca para cerrar</Text>
        </Pressable>
      </Modal>

      {/* Footer actions */}
      {isPendiente && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <AnimatedPressable
            style={[s.rejectBtn, { borderColor: colors.border }]}
            onPress={() => cambiarEstado('rechazada')}
          >
            <Text style={[s.rejectBtnTxt, { color: colors.textSecondary }]}>Rechazar</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[s.acceptBtn, { backgroundColor: colors.primary }]}
            onPress={() => cambiarEstado('aceptada')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.acceptBtnTxt}>Aceptar Candidato</Text>
          </AnimatedPressable>
        </View>
      )}
      {estadoActual === 'aceptada' && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <AnimatedPressable
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={irAlChat}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            <Text style={s.primaryBtnTxt}>Ir al chat</Text>
          </AnimatedPressable>
        </View>
      )}
      {!estadoActual && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <AnimatedPressable
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={solicitarContacto}
            disabled={enviandoSolicitud}
          >
            <Ionicons name={enviandoSolicitud ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={20} color="#fff" />
            <Text style={s.primaryBtnTxt}>{enviandoSolicitud ? 'Enviando...' : 'Contactar'}</Text>
          </AnimatedPressable>
        </View>
      )}
      {isSolicitudContacto && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[s.infoPill, { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warning + '40' }]}>
            <Ionicons name="hourglass-outline" size={16} color={COLORS.warning} />
            <Text style={[s.infoPillTxt, { color: COLORS.warning }]}>Solicitud enviada. Esperando respuesta del trabajador.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Estilos del rediseño del perfil público trabajador ──
const FOTO_W = (W - SPACING.md * 2 - SPACING.sm) / 2;
const r = StyleSheet.create({
  heroOuter: { marginBottom: SPACING.md },
  heroGradient: { paddingHorizontal: SPACING.md, paddingBottom: 70, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  avatarOuter: { position: 'relative', marginBottom: SPACING.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#fff' },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: '800', color: '#fff' },
  verBadge: { position: 'absolute', bottom: 2, right: 2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#16A34A', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  heroMetaTxt: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  disponPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5 },
  disponDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  disponTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 5 },
  infoPillTxt: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  statsCard: { marginHorizontal: SPACING.md, marginTop: -44, borderRadius: RADIUS.xl, padding: SPACING.md, flexDirection: 'row', ...SHADOWS.card },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statNum: { fontSize: 15, fontWeight: '800' },
  statLbl: { fontSize: 11, fontWeight: '500' },
  statDivider: { width: 1, height: 48, alignSelf: 'center' },
  card: { marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.xl, padding: SPACING.md, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  cardIconGrad: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  bodyText: { fontSize: 14, lineHeight: 22 },
  cvCard: { marginHorizontal: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.xl, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cvIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  cvLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cvName: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  cvArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  chipGroupLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chipGreen: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipGreenTxt: { fontSize: 12, fontWeight: '600' },
  chipNeutral: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipNeutralTxt: { fontSize: 12, fontWeight: '500' },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm },
  expDot: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  expLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  expValue: { fontSize: 14, fontWeight: '700' },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  fotoWrap: { width: FOTO_W, height: FOTO_W * 0.75, borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative' },
  fotoImg: { width: '100%', height: '100%' },
  fotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  fotoExpandIcon: { position: 'absolute', bottom: 6, right: 6 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.lg, borderWidth: 1 },
  infoChipTxt: { fontSize: 13, fontWeight: '500' },
  fotoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', justifyContent: 'center', alignItems: 'center' },
  fotoModalImg: { width: W - 24, height: W - 24, borderRadius: RADIUS.lg },
  fotoModalHint: { color: 'rgba(255,255,255,0.45)', marginTop: 16, fontSize: 13 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: SPACING.sm },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: 17, fontWeight: '700' },
  iconBtn: { width: 40, height: 40, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center' },

  /* HERO */
  hero: { alignItems: 'center', paddingTop: SPACING.xl, paddingBottom: 0, marginBottom: SPACING.sm, ...SHADOWS.card },
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5 },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 2.5,
    justifyContent: 'center', alignItems: 'center',
  },
  initials: { fontSize: 28, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2,
  },
  fullName: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  heroSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  metaText: { fontSize: 13 },
  pillRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, flexWrap: 'wrap', justifyContent: 'center' },
  disponPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  disponDot: { width: 7, height: 7, borderRadius: 4 },
  disponPillTxt: { fontSize: 12, fontWeight: '700' },
  verPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  verPillTxt: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },

  /* Stats row */
  statsRow: {
    flexDirection: 'row', width: '100%',
    borderTopWidth: 1, marginTop: 4, paddingVertical: SPACING.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statNum: { fontSize: 22, fontWeight: '800' },
  statNumExp: { fontSize: 16, textAlign: 'center', lineHeight: 18 },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, marginVertical: 4 },

  /* Cards */
  card: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    borderRadius: RADIUS.xl, padding: SPACING.md,
    ...SHADOWS.small,
  },

  /* Rating */
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  ratingBig: { fontSize: 42, fontWeight: '800', lineHeight: 48 },
  starsRow: { flexDirection: 'row', gap: 3, flex: 1 },
  ratingCnt: { fontSize: 13 },

  bodyText: { fontSize: 14, lineHeight: 22 },

  /* CV */
  cvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1,
  },
  cvIconBox: { width: 40, height: 40, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  cvTitle: { fontSize: 14, fontWeight: '700' },
  cvName: { fontSize: 12, marginTop: 2 },

  /* Chips */
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipGreen: { borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  chipGreenTxt: { fontSize: 13, fontWeight: '600' },
  chipNeutral: { borderWidth: 1.5, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 7 },
  chipNeutralTxt: { fontSize: 13, fontWeight: '600' },

  /* Info rows */
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm, borderBottomWidth: 1,
  },
  infoIconBox: { width: 38, height: 38, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '700' },

  /* Doc items */
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  docIconBox: { width: 36, height: 36, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  docText: { flex: 1, fontSize: 14, fontWeight: '600' },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
    borderTopWidth: 1, flexDirection: 'row', gap: SPACING.sm, ...SHADOWS.large,
  },
  rejectBtn: { flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: RADIUS.full, borderWidth: 1.5 },
  rejectBtnTxt: { fontSize: 15, fontWeight: '700' },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 15, borderRadius: RADIUS.full, ...SHADOWS.button,
  },
  acceptBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
  primaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 15, borderRadius: RADIUS.full, ...SHADOWS.button,
  },
  primaryBtnTxt: { fontSize: 17, fontWeight: '700', color: '#fff' },
  infoPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, borderWidth: 1,
  },
  infoPillTxt: { flex: 1, fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 4, borderRadius: RADIUS.full },
  chipTxt: { fontSize: 13, fontWeight: '600' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1 },
  infoChipTxt: { fontSize: 12, fontWeight: '600' },
  bioText: { fontSize: 14, lineHeight: 22 },
});
