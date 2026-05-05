import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Linking, Pressable, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, chatsAPI, vacantesAPI } from '../../services/api';
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
  const { trabajador_id, vacante_id, postulacion_estado } = route.params;
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [estadoActual, setEstadoActual] = useState(postulacion_estado || null);
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  useEffect(() => {
    cargarPerfil();
    syncEstadoPostulacion();
  }, [trabajador_id, vacante_id]);

  const cargarPerfil = async () => {
    try {
      const res = await trabajadoresAPI.perfilPublico(trabajador_id);
      setPerfil(res.data.trabajador);
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
  const cultivos = (perfil.cultivos || []).map(c => c.cultivo);
  const habilidades = (perfil.habilidades || []).map(h => h.habilidad);
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

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hasFooter ? 110 : 32 }}
      >
        {/* Top bar */}
              <View style={[s.topBar, { paddingTop: insets.top + SPACING.sm, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <AnimatedPressable style={[s.iconBtn, { backgroundColor: colors.surface }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </AnimatedPressable>
          <Text style={[s.topBarTitle, { color: colors.textPrimary }]}>Perfil del Candidato</Text>
          <View style={s.iconBtn} />
        </View>

        {/* HERO — avatar + identidad */}
        <View style={[s.hero, { backgroundColor: colors.surface }]}>
          {/* Avatar */}
          <View style={s.avatarWrap}>
            {perfil.foto_selfie && perfil.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: perfil.foto_selfie }} style={[s.avatar, { borderColor: colors.primary }]} />
            ) : (
              <View style={[s.avatarFallback, { borderColor: colors.primary, backgroundColor: colors.primary + '1A' }]}>
                <Text style={[s.initials, { color: colors.primary }]}>{initials}</Text>
              </View>
            )}
            {perfil.validacion_identidad_estado === 'aprobada' && (
              <View style={[s.verifiedBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            )}
          </View>

          {/* Nombre */}
          <Text style={[s.fullName, { color: colors.textPrimary }]}>{perfil.nombre_completo}</Text>

          {/* Subtítulo: disponibilidad */}
          {disponibilidad ? (
            <Text style={[s.heroSubtitle, { color: colors.textSecondary }]}>{disponibilidad}</Text>
          ) : null}

          {/* Ubicación */}
          {ubicacion ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text style={[s.metaText, { color: colors.textMuted }]}>{ubicacion}</Text>
            </View>
          ) : null}

          {/* Disponibilidad chip verde */}
          <View style={s.pillRow}>
            <View style={[s.disponPill, { backgroundColor: COLORS.badgeActive }]}>
              <View style={[s.disponDot, { backgroundColor: COLORS.badgeActiveText }]} />
              <Text style={[s.disponPillTxt, { color: COLORS.badgeActiveText }]}>Disponible</Text>
            </View>
            {perfil.verificado_sms ? (
              <View style={[s.verPill, { borderColor: colors.primary }]}>
                <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
                <Text style={[s.verPillTxt, { color: colors.primary }]}>VERIFICADO</Text>
              </View>
            ) : null}
          </View>

          {/* Stats row */}
          <View style={[s.statsRow, { borderTopColor: colors.border }]}>
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>
                {cal > 0 ? cal.toFixed(1) : '—'}
              </Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Calificación</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
              <Text style={[s.statNum, { color: colors.primary }]}>{totalCal}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Reseñas</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.border }]} />
            <View style={s.statItem}>
                    <Text style={[s.statNum, s.statNumExp, { color: colors.primary }]}> 
                      {experiencia || '—'}
              </Text>
                    <Text style={[s.statLabel, { color: colors.textMuted }]}>Experiencia</Text>
            </View>
          </View>
        </View>

        {/* Estrellas de calificación */}
        {cal > 0 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="star-outline" title="Calificación" colors={colors} />
            <View style={s.ratingWrap}>
              <Text style={[s.ratingBig, { color: colors.primary }]}>{cal.toFixed(1)}</Text>
              <View style={s.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons
                    key={i}
                    name={i <= Math.round(cal) ? 'star' : 'star-outline'}
                    size={22}
                    color={i <= Math.round(cal) ? COLORS.star : COLORS.starEmpty}
                  />
                ))}
              </View>
              <Text style={[s.ratingCnt, { color: colors.textMuted }]}>{totalCal} reseña{totalCal !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        )}

        {/* Acerca de */}
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SectionHeader icon="person-circle-outline" title="Acerca de" colors={colors} />
          {acercaDe ? (
            <Text style={[s.bodyText, { color: colors.textSecondary }]}>{acercaDe}</Text>
          ) : (
            <Text style={[s.bodyText, { color: colors.textMuted }]}>Este trabajador aún no ha agregado una descripción personal.</Text>
          )}
        </View>

        {/* Hoja de vida */}
        {perfil.hoja_vida_url ? (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="document-text-outline" title="Hoja de vida" colors={colors} />
            <AnimatedPressable
              style={[s.cvBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
              onPress={abrirHojaVida}
            >
              <View style={[s.cvIconBox, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cvTitle, { color: colors.textPrimary }]}>Ver hoja de vida</Text>
                <Text style={[s.cvName, { color: colors.textMuted }]} numberOfLines={1}>
                  {perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
            </AnimatedPressable>
          </View>
        ) : null}

        {/* Cultivos */}
        {cultivos.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="leaf-outline" title="Cultivos" colors={colors} />
            <View style={s.chipWrap}>
              {cultivos.map((c, i) => (
                <View key={i} style={[s.chipGreen, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[s.chipGreenTxt, { color: colors.primary }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Habilidades */}
        {habilidades.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="construct-outline" title="Habilidades" colors={colors} />
            <View style={s.chipWrap}>
              {habilidades.map((h, i) => (
                <View key={i} style={[s.chipNeutral, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.chipNeutralTxt, { color: colors.textSecondary }]}>{h}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Experiencia y formación */}
        {(experiencia || estudios) && (
          <View style={[s.card, { backgroundColor: colors.surface }]}>
            <SectionHeader icon="briefcase-outline" title="Experiencia y Formación" colors={colors} />
            {experiencia ? (
              <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                <View style={[s.infoIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Experiencia agrícola</Text>
                  <Text style={[s.infoValue, { color: colors.textPrimary }]}>{experiencia}</Text>
                </View>
              </View>
            ) : null}
            {estudios ? (
              <View style={[s.infoRow, { borderBottomColor: perfil.titulo_estudio ? colors.border : 'transparent' }]}>
                <View style={[s.infoIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="school-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Nivel de estudios</Text>
                  <Text style={[s.infoValue, { color: colors.textPrimary }]}>{estudios}</Text>
                </View>
              </View>
            ) : null}
            {perfil.titulo_estudio ? (
              <View style={[s.infoRow, { borderBottomColor: 'transparent' }]}>
                <View style={[s.infoIconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
                </View>
                <View style={s.infoContent}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Título</Text>
                  <Text style={[s.infoValue, { color: colors.textPrimary }]}>{perfil.titulo_estudio}</Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Info extra: ubicación y disponibilidad */}
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SectionHeader icon="information-circle-outline" title="Información" colors={colors} />
          {ubicacion ? (
            <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
              <View style={[s.infoIconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
              </View>
              <View style={s.infoContent}>
                <Text style={[s.infoLabel, { color: colors.textMuted }]}>Ubicación</Text>
                <Text style={[s.infoValue, { color: colors.textPrimary }]}>{ubicacion}</Text>
              </View>
            </View>
          ) : null}
          {disponibilidad ? (
            <View style={[s.infoRow, { borderBottomColor: 'transparent' }]}>
              <View style={[s.infoIconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
              <View style={s.infoContent}>
                <Text style={[s.infoLabel, { color: colors.textMuted }]}>Disponibilidad</Text>
                <Text style={[s.infoValue, { color: colors.textPrimary }]}>{disponibilidad}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Documentación verificada */}
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <SectionHeader icon="shield-checkmark-outline" title="Documentación Verificada" colors={colors} />
          <View style={[s.docItem, { borderColor: colors.border }]}>
            <View style={[s.docIconBox, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="card-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[s.docText, { color: colors.textPrimary }]}>Cédula de Ciudadanía</Text>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
          <View style={[s.docItem, { borderColor: colors.border }]}>
            <View style={[s.docIconBox, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[s.docText, { color: colors.textPrimary }]}>Certificados de Competencia</Text>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
        </View>
      </ScrollView>

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
});
