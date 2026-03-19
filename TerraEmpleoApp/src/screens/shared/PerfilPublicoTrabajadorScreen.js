import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { trabajadoresAPI, chatsAPI, vacantesAPI } from '../../services/api';

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

export default function PerfilPublicoTrabajadorScreen({ route, navigation }) {
  const { trabajador_id, vacante_id, postulacion_estado } = route.params;
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => { cargarPerfil(); }, []);

  const cargarPerfil = async () => {
    try {
      const res = await trabajadoresAPI.perfilPublico(trabajador_id);
      setPerfil(res.data.trabajador);
    } catch { Alert.alert('Error', 'No se pudo cargar el perfil'); }
    finally { setCargando(false); }
  };

  const irAlChat = async () => {
    if (!vacante_id) return;
    try {
      const res = await chatsAPI.chatPorVacanteTrabajador(vacante_id, trabajador_id);
      navigation.navigate('Mensajes', { screen: 'ChatDetalle', params: { chat: { id: res.data.chat_id, otro_nombre: perfil?.nombre_completo, otro_foto: perfil?.foto_selfie } } });
    } catch { Alert.alert('Error', 'No se encontró el chat'); }
  };

  const cambiarEstado = async (estado) => {
    try {
      const res = await vacantesAPI.verPostulaciones(vacante_id);
      const post = (res.data.postulaciones || []).find(p => Number(p.trabajador_id) === Number(trabajador_id));
      if (post) {
        await vacantesAPI.actualizarPostulacion(post.id, estado);
        Alert.alert('Listo', estado === 'aceptada' ? 'Candidato aceptado' : 'Candidato rechazado');
        navigation.goBack();
      }
    } catch (err) { Alert.alert('Error', err.response?.data?.error || 'Error al actualizar'); }
  };

  if (cargando) return <View style={s.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  if (!perfil) return <View style={s.centered}><Text style={s.emptyTitle}>Perfil no disponible</Text></View>;

  const cal = parseFloat(perfil.calificacion_promedio || 0);
  const totalCal = Number(perfil.total_calificaciones || 0);
  const disponibilidad = LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad;
  const experiencia = LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia;
  const estudios = LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios;
  const especialidades = [...(perfil.habilidades || []).map(h => h.habilidad), ...(perfil.cultivos || []).map(c => c.cultivo)];
  const ubicacion = [perfil.municipio, perfil.departamento].filter(Boolean).join(', ');
  const isPendiente = postulacion_estado === 'pendiente' || postulacion_estado === 'match_auto';
  const acercaDe = perfil.acerca_de?.trim();

  const abrirHojaVida = async () => {
    if (!perfil?.hoja_vida_url) return;
    try {
      const canOpen = await Linking.canOpenURL(perfil.hoja_vida_url);
      if (!canOpen) {
        Alert.alert('No disponible', 'No se pudo abrir la hoja de vida.');
        return;
      }
      await Linking.openURL(perfil.hoja_vida_url);
    } catch (_) {
      Alert.alert('Error', 'No se pudo abrir la hoja de vida.');
    }
  };

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={s.topBarTitle}>Perfil del Candidato</Text>
          <TouchableOpacity style={s.shareBtn}><Ionicons name="share-social-outline" size={20} color={COLORS.textPrimary} /></TouchableOpacity>
        </View>

        {/* Avatar + identity */}
        <View style={s.profileCenter}>
          <View style={s.avatarWrap}>
            {perfil.foto_selfie && perfil.foto_selfie.startsWith('http') ? (
              <Image source={{ uri: perfil.foto_selfie }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}><Ionicons name="person" size={52} color={COLORS.textLight} /></View>
            )}
            <View style={s.verifiedBadge}><Ionicons name="checkmark" size={14} color={COLORS.white} /></View>
          </View>
          <Text style={s.fullName}>{perfil.nombre_completo}</Text>
          {cal > 0 && (
            <View style={s.ratingRow}><Ionicons name="star" size={16} color="#FFB300" /><Text style={s.ratingVal}>{cal.toFixed(1)}</Text><Text style={s.ratingCnt}>({totalCal} reseñas)</Text></View>
          )}
          {perfil.verificado_sms && (
            <View style={s.verPill}><Ionicons name="shield-checkmark" size={14} color={COLORS.primary} /><Text style={s.verPillTxt}>VERIFICADO</Text></View>
          )}
        </View>

        {/* ACERCA DE */}
        <View style={s.secWrap}>
          <Text style={s.secLabel}>ACERCA DE</Text>
          {acercaDe ? (
            <Text style={s.secText}>{acercaDe}</Text>
          ) : (
            <Text style={s.secTextMuted}>Este trabajador aún no ha agregado una descripción personal.</Text>
          )}
        </View>

        {perfil.hoja_vida_url ? (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>HOJA DE VIDA</Text>
            <TouchableOpacity style={s.cvBtn} onPress={abrirHojaVida} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.cvTitle}>Ver hoja de vida</Text>
                <Text style={s.cvName} numberOfLines={1}>{perfil.hoja_vida_nombre || 'Hoja de vida.pdf'}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* HABILIDADES */}
        {especialidades.length > 0 && (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>HABILIDADES Y ESPECIALIDADES</Text>
            <View style={s.chipWrap}>
              {especialidades.map((e, i) => (
                <View key={i} style={s.chipOutline}><Text style={s.chipOutlineTxt}>{e}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* EXPERIENCIA */}
        {experiencia && (
          <View style={s.secWrap}>
            <Text style={s.secLabel}>EXPERIENCIA LABORAL</Text>
            <View style={s.timeline}>
              <View style={s.tlItem}>
                <View style={s.tlDot} /><View style={s.tlLine} />
                <View style={s.tlContent}>
                  <Text style={s.tlTitle}>Experiencia Agrícola</Text>
                  <Text style={s.tlSub}>{experiencia}</Text>
                  <Text style={s.tlDesc}>Trabajo en campo, cultivos y cosecha</Text>
                </View>
              </View>
              {estudios && (
                <View style={s.tlItem}>
                  <View style={[s.tlDot, { backgroundColor: COLORS.primaryLight }]} />
                  <View style={s.tlContent}>
                    <Text style={s.tlTitle}>Formación</Text>
                    <Text style={s.tlSub}>{estudios}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={s.statRow}>
          <View style={s.statCard}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={s.statLabel}>UBICACIÓN</Text>
            <Text style={s.statVal}>{ubicacion || 'Colombia'}</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="calendar" size={20} color={COLORS.primary} />
            <Text style={s.statLabel}>DISPONIBILIDAD</Text>
            <Text style={s.statVal}>{disponibilidad || 'No indicada'}</Text>
          </View>
        </View>

        {/* DOCUMENTACIÓN */}
        <View style={s.secWrap}>
          <Text style={s.secLabel}>DOCUMENTACIÓN VERIFICADA</Text>
          <View style={s.verList}>
            <View style={s.verItem}><View style={s.verIcon}><Ionicons name="card-outline" size={18} color={COLORS.primary} /></View><Text style={s.verText}>Cédula de Ciudadanía</Text><Ionicons name="checkmark-circle" size={20} color={COLORS.primary} /></View>
            <View style={s.verItem}><View style={s.verIcon}><Ionicons name="ribbon-outline" size={18} color={COLORS.primary} /></View><Text style={s.verText}>Certificados de Competencia</Text><Ionicons name="checkmark-circle" size={20} color={COLORS.primary} /></View>
          </View>
        </View>
      </ScrollView>

      {/* Footer actions */}
      {isPendiente && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <TouchableOpacity style={s.rejectBtn} onPress={() => cambiarEstado('rechazada')} activeOpacity={0.88}>
            <Text style={s.rejectBtnTxt}>Rechazar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={() => cambiarEstado('aceptada')} activeOpacity={0.88}>
            <Text style={s.acceptBtnTxt}>Aceptar Candidato</Text>
          </TouchableOpacity>
        </View>
      )}
      {postulacion_estado === 'aceptada' && (
        <View style={[s.footer, { paddingBottom: insets.bottom + SPACING.sm }]}>
          <TouchableOpacity style={s.chatBtn} onPress={irAlChat} activeOpacity={0.88}>
            <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.white} /><Text style={s.chatBtnTxt}>Ir al chat</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  shareBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  profileCenter: { alignItems: 'center', paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: COLORS.primarySoft, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: { position: 'absolute', bottom: 4, right: 4, width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white },
  fullName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  ratingVal: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  ratingCnt: { fontSize: 14, color: COLORS.textSecondary },
  verPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 5 },
  verPillTxt: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.5 },

  secWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  secLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, letterSpacing: 1, marginBottom: SPACING.sm },
  secText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  secTextMuted: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  cvBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  cvTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  cvName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOutline: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  chipOutlineTxt: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  timeline: { paddingLeft: 4 },
  tlItem: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary, marginTop: 4, flexShrink: 0 },
  tlLine: { position: 'absolute', left: 6, top: 20, width: 2, height: 50, backgroundColor: COLORS.primarySoft },
  tlContent: { flex: 1 },
  tlTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  tlSub: { fontSize: 13, fontWeight: '600', color: COLORS.primary, marginTop: 2 },
  tlDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },

  statRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
  statCard: { flex: 1, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.borderLight },
  statLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.8 },
  statVal: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },

  verList: { gap: SPACING.sm },
  verItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#F8FAF9', borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.borderLight },
  verIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  verText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderColor: COLORS.borderLight, ...SHADOWS.large, flexDirection: 'row', gap: SPACING.sm },
  rejectBtn: { flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border },
  rejectBtnTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary },
  acceptBtn: { flex: 2, alignItems: 'center', paddingVertical: 15, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, ...SHADOWS.button },
  acceptBtnTxt: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: 15, borderRadius: RADIUS.full, backgroundColor: COLORS.primary, ...SHADOWS.button },
  chatBtnTxt: { fontSize: 17, fontWeight: '700', color: COLORS.white },
});
